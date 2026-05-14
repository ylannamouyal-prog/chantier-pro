/* =================================================================
   DASHBOARD — Vue d'ensemble + KPI + graphiques
   ================================================================= */

const Dashboard = {
  _charts: [],

  render(container) {
    // Cleanup charts précédents
    this._charts.forEach(c => c.destroy?.());
    this._charts = [];

    const s = Store.state;
    const now = new Date();

    // Calculs KPI
    const enCours = s.chantiers.filter(c => Helpers.computeStatus(c) === 'en-cours').length;
    const prevus  = s.chantiers.filter(c => Helpers.computeStatus(c) === 'prevu').length;
    const termines = s.chantiers.filter(c => Helpers.computeStatus(c) === 'termine').length;

    // Stock critique
    const stockAlertes = s.fournitures.filter(f => {
      const t = Store.getStockTotal(f.id).total;
      return t <= f.seuilAlerte;
    });

    // Valeur stock
    const valeurStock = s.fournitures.reduce((acc, f) => {
      return acc + Store.getStockTotal(f.id).total * (f.prixUnitaire || 0);
    }, 0);

    // Chantiers récents
    const chantiersRecents = [...s.chantiers]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    container.innerHTML = `
      ${UI.viewHeader({
        title: 'Tableau de bord',
        subtitle: `Vue d'ensemble · ${Format.dateLong(now)}`,
        actions: `<button class="btn btn--secondary" id="dashRefresh"><span class="btn-icon">↻</span> Actualiser</button>`
      })}

      <div class="dashboard-grid">
        ${UI.statCard({ label: 'Chantiers en cours', value: enCours, sub: `${prevus} prévus à venir`, accent: '#F59E0B', icon: '⚡' })}
        ${UI.statCard({ label: 'Clients actifs',     value: s.clients.length, sub: `${s.chantiers.length} chantiers au total`, accent: '#3B82F6', icon: '◉' })}
        ${UI.statCard({ label: 'Alertes stock',      value: stockAlertes.length, sub: stockAlertes.length ? 'Réapprovisionnement nécessaire' : 'Stock OK', accent: stockAlertes.length ? '#EF4444' : '#10B981', icon: '▤' })}
        ${UI.statCard({ label: 'Valeur stock',       value: Format.euro(valeurStock), sub: `${s.fournitures.length} références`, accent: '#10B981', icon: '€' })}
      </div>

      <div class="dashboard-row">
        <div class="card">
          <div class="card__header">
            <div class="card__title">Activité des chantiers</div>
            <div class="tabs">
              <button class="tab active" data-chart-range="month">Mois</button>
              <button class="tab" data-chart-range="year">Année</button>
            </div>
          </div>
          <div class="card__body">
            <div class="dashboard-chart"><canvas id="chartChantiers"></canvas></div>
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <div class="card__title">Répartition par statut</div>
          </div>
          <div class="card__body">
            <div class="dashboard-chart"><canvas id="chartStatuts"></canvas></div>
          </div>
        </div>
      </div>

      <div class="dashboard-row">
        <div class="card">
          <div class="card__header">
            <div class="card__title">Chantiers récents</div>
            <a href="#/chantiers" class="btn btn--ghost btn--sm">Tout voir →</a>
          </div>
          <div>
            ${chantiersRecents.length === 0
              ? UI.emptyState({ icon: '⏍', title: 'Aucun chantier', message: 'Créez votre premier chantier pour commencer.' })
              : chantiersRecents.map(c => this._renderRecentChantier(c)).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <div class="card__title">Alertes stock</div>
            <a href="#/stocks" class="btn btn--ghost btn--sm">Stocks →</a>
          </div>
          <div class="card__body" style="padding:0">
            ${stockAlertes.length === 0
              ? UI.emptyState({ icon: '✓', title: 'Tout est en ordre', message: 'Aucune alerte de stock.' })
              : stockAlertes.slice(0, 6).map(f => {
                  const total = Store.getStockTotal(f.id).total;
                  const critical = total === 0;
                  return `
                    <div class="recent-chantier">
                      <div class="recent-chantier__color" style="background:${critical ? '#EF4444' : '#F59E0B'}"></div>
                      <div class="recent-chantier__info">
                        <div class="recent-chantier__title">${Helpers.esc(f.designation)}</div>
                        <div class="recent-chantier__meta">${f.reference} · ${total} ${f.unite}</div>
                      </div>
                      <span class="stock-alert ${critical ? 'stock-alert--critical' : 'stock-alert--low'}">
                        ${critical ? 'Rupture' : 'Faible'}
                      </span>
                    </div>`;
                }).join('')}
          </div>
        </div>
      </div>
    `;

    // Render charts
    this._renderChartChantiers();
    this._renderChartStatuts();

    // Refresh
    $('#dashRefresh')?.addEventListener('click', () => {
      Toast.info('Données actualisées');
      this.render(container);
    });
  },

  _renderRecentChantier(c) {
    const statut = Helpers.computeStatus(c);
    const client = Store.getClient(c.clientId);
    const cond = Store.state.conducteurs.find(cd => cd.id === c.conducteurId);
    return `
      <div class="recent-chantier" data-route="chantiers/${c.id}">
        <div class="recent-chantier__color" style="background:${cond?.couleur || '#94A3B8'}"></div>
        <div class="recent-chantier__info">
          <div class="recent-chantier__title">${Helpers.esc(c.titre)}</div>
          <div class="recent-chantier__meta">
            ${c.numero} · ${client?.nom || '—'} · ${Format.dateRange(c.dateDebut, c.dateFin)}
          </div>
        </div>
        ${UI.statusBadge(statut)}
      </div>
    `;
  },

  _renderChartChantiers() {
    const ctx = $('#chartChantiers');
    if (!ctx) return;

    // Données simulées sur 6 derniers mois
    const labels = [];
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleDateString('fr-FR', { month: 'short' }));
      const month = d.getMonth();
      const year = d.getFullYear();
      data.push(Store.state.chantiers.filter(c => {
        if (!c.dateDebut) return false;
        const cd = new Date(c.dateDebut);
        return cd.getMonth() === month && cd.getFullYear() === year;
      }).length);
    }

    const isDark = document.documentElement.dataset.theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const txtColor  = isDark ? '#94A3B8' : '#475569';

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Chantiers',
          data,
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderColor: '#3B82F6',
          borderWidth: 2,
          borderRadius: 8,
          maxBarThickness: 48
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: txtColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: txtColor, font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
        }
      }
    });
    this._charts.push(chart);
  },

  _renderChartStatuts() {
    const ctx = $('#chartStatuts');
    if (!ctx) return;

    const statuts = ['en-attente-cotes','en-attente-devis','commande','prevu','en-cours','termine','reporte'];
    const counts = statuts.map(s =>
      Store.state.chantiers.filter(c => Helpers.computeStatus(c) === s).length
    );
    const labels = statuts.map(Helpers.statusLabel);
    const colors = statuts.map(Helpers.statusColor);

    const isDark = document.documentElement.dataset.theme === 'dark';

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderColor: isDark ? '#111827' : '#FFFFFF',
          borderWidth: 3,
          spacing: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10, boxHeight: 10, padding: 12,
              color: isDark ? '#94A3B8' : '#475569',
              font: { size: 11 }
            }
          }
        }
      }
    });
    this._charts.push(chart);
  }
};

window.Dashboard = Dashboard;
