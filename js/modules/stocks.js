// Module Stocks - atelier + camions par équipe
window.Stocks = (function () {
  let activeTab = 'atelier';
  let searchQuery = '';

  function render(container) {
    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📦 Stocks</h1>
          <p class="view-subtitle">Gestion de l'atelier et des camions des équipes</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="stkMvt">📋 Mouvements</button>
          <button class="btn btn--ghost" id="stkExportMvt">📥 Exporter mouvements</button>
          <button class="btn btn--ghost" id="stkExportEtat">📄 État du stock (PDF)</button>
          <button class="btn btn--primary" id="stkAdd">+ Nouvelle fourniture</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${activeTab === 'atelier' ? 'tab--active' : ''}" data-tab="atelier">🏭 Atelier</button>
        ${Store.state.equipes.map(eq => `
          <button class="tab ${activeTab === eq.id ? 'tab--active' : ''}" data-tab="${eq.id}">
            <span class="color-dot" style="background:${eq.couleur}"></span>
            🚚 ${Helpers.esc(eq.nom)}
          </button>
        `).join('')}
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="stkSearch" placeholder="🔍 Rechercher une fourniture..." value="${Helpers.esc(searchQuery)}">
      </div>

      <div id="stockContent"></div>
    `;

    document.getElementById('stkAdd')?.addEventListener('click', openAddFourniture);
    document.getElementById('stkMvt')?.addEventListener('click', openMouvements);
    document.getElementById('stkExportMvt')?.addEventListener('click', openExportMouvements);
    document.getElementById('stkExportEtat')?.addEventListener('click', () => window.PdfExport?.stockEtat());

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render(container);
      });
    });

    const search = document.getElementById('stkSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        searchQuery = search.value;
        renderContent();
        document.getElementById('stkSearch')?.focus();
      }, 200));
    }

    renderContent();
  }

  function renderContent() {
    const content = document.getElementById('stockContent');
    if (!content) return;

    const fournitures = filterFournitures(Store.state.fournitures);
    const isAtelier = activeTab === 'atelier';
    const equipe = isAtelier ? null : Store.state.equipes.find(e => e.id === activeTab);

    // Calcul valeur totale
    let totalValue = 0;
    let alertCount = 0;
    fournitures.forEach(f => {
      const qte = isAtelier ? (Store.state.stockAtelier[f.id] || 0) : (Store.state.stockCamions[activeTab]?.[f.id] || 0);
      totalValue += qte * (f.prixUnitaire || 0);
      if (qte <= (f.seuilAlerte || 0)) alertCount++;
    });

    content.innerHTML = `
      <div class="stock-summary">
        <div class="stat-card">
          <div class="stat-card__label">Références</div>
          <div class="stat-card__value">${fournitures.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Valeur estimée</div>
          <div class="stat-card__value">${Format.euro(totalValue)}</div>
        </div>
        <div class="stat-card ${alertCount > 0 ? 'stat-card--warning' : ''}">
          <div class="stat-card__label">Alertes seuil</div>
          <div class="stat-card__value">${alertCount}</div>
        </div>
        ${equipe ? `
          <div class="stat-card" style="border-left:4px solid ${equipe.couleur}">
            <div class="stat-card__label">Équipe</div>
            <div class="stat-card__value">${Helpers.esc(equipe.nom)}</div>
          </div>
        ` : ''}
      </div>

      ${fournitures.length === 0 ? UI.emptyState({
        icon: '📦', title: 'Aucune fourniture',
        message: searchQuery ? 'Aucun résultat pour cette recherche.' : 'Ajoutez vos premières fournitures.'
      }) : `
        <div class="table-wrap">
          <table class="table table--stock">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Catégorie</th>
                <th>Unité</th>
                <th>Quantité</th>
                <th>Niveau</th>
                <th>Seuil</th>
                <th>Valeur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${fournitures.map(f => renderStockRow(f, isAtelier, equipe)).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    content.querySelectorAll('[data-fourniture]').forEach(row => {
      row.querySelectorAll('[data-stk-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = row.dataset.fourniture;
          const action = btn.dataset.stkAction;
          if (action === 'in') openMouvement(id, 'entree');
          else if (action === 'out') openMouvement(id, 'sortie');
          else if (action === 'transfer') openTransfert(id);
          else if (action === 'edit') openAddFourniture(id);
          else if (action === 'delete') deleteFourniture(id);
        });
      });
    });
  }

  function filterFournitures(list) {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(f =>
      (f.nom || '').toLowerCase().includes(q) ||
      (f.reference || '').toLowerCase().includes(q) ||
      (f.categorie || '').toLowerCase().includes(q)
    );
  }

  function renderStockRow(f, isAtelier, equipe) {
    const qte = isAtelier ? (Store.state.stockAtelier[f.id] || 0) : (Store.state.stockCamions[activeTab]?.[f.id] || 0);
    const seuil = f.seuilAlerte || 0;
    const max = Math.max(seuil * 3, qte, 10);
    const pct = Math.min(100, (qte / max) * 100);
    const alert = qte <= seuil;
    const value = qte * (f.prixUnitaire || 0);

    return `
      <tr data-fourniture="${f.id}" class="${alert ? 'stock-row--alert' : ''}">
        <td>
          <div class="stock-name">
            <strong>${Helpers.esc(f.nom)}</strong>
            ${f.reference ? `<span class="mono small">${Helpers.esc(f.reference)}</span>` : ''}
          </div>
        </td>
        <td>${f.categorie ? `<span class="badge badge--info">${Helpers.esc(f.categorie)}</span>` : '—'}</td>
        <td>${Helpers.esc(f.unite || 'pcs')}</td>
        <td><strong class="mono ${alert ? 'text-danger' : ''}">${Format.num(qte)}</strong></td>
        <td>
          <div class="stock-bar">
            <div class="stock-bar__fill ${alert ? 'stock-bar__fill--alert' : ''}" style="width:${pct}%"></div>
          </div>
        </td>
        <td class="mono small">${seuil}</td>
        <td class="mono">${Format.euro(value)}</td>
        <td class="actions-cell">
          <button class="btn-icon" data-stk-action="in" title="Entrée">➕</button>
          <button class="btn-icon" data-stk-action="out" title="Sortie">➖</button>
          <button class="btn-icon" data-stk-action="transfer" title="Transfert">⇄</button>
          <button class="btn-icon" data-stk-action="edit" title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-stk-action="delete" title="Supprimer">🗑</button>
        </td>
      </tr>
    `;
  }

  function openAddFourniture(id = null) {
    const existing = id ? Store.state.fournitures.find(f => f.id === id) : null;
    const f = existing || { nom: '', reference: '', categorie: '', unite: 'pcs', prixUnitaire: 0, seuilAlerte: 5 };

    Modal.open({
      title: existing ? 'Modifier la fourniture' : 'Nouvelle fourniture',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(f.nom)}" autofocus>
          </div>
          <div class="form-field">
            <label>Référence</label>
            <input id="f_ref" class="form-input mono" value="${Helpers.esc(f.reference || '')}">
          </div>
          <div class="form-field">
            <label>Catégorie</label>
            <select id="f_cat" class="form-select">
              ${['', 'Vitrage', 'Joint', 'Visserie', 'Bois', 'Store', 'Quincaillerie', 'Consommable', 'Autre']
                .map(c => `<option value="${c}" ${f.categorie === c ? 'selected' : ''}>${c || '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Unité</label>
            <select id="f_unite" class="form-select">
              ${['pcs', 'm', 'm²', 'kg', 'L', 'boîte'].map(u =>
                `<option value="${u}" ${f.unite === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Prix unitaire (€)</label>
            <input id="f_prix" class="form-input mono" type="number" step="0.01" min="0" value="${f.prixUnitaire || 0}">
          </div>
          <div class="form-field">
            <label>Seuil d'alerte</label>
            <input id="f_seuil" class="form-input mono" type="number" min="0" value="${f.seuilAlerte || 0}">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="fSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.getElementById('fSave').addEventListener('click', () => {
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            reference: document.getElementById('f_ref').value.trim(),
            categorie: document.getElementById('f_cat').value,
            unite: document.getElementById('f_unite').value,
            prixUnitaire: parseFloat(document.getElementById('f_prix').value) || 0,
            seuilAlerte: parseInt(document.getElementById('f_seuil').value) || 0
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateFourniture(existing.id, data);
            Toast.success('Fourniture mise à jour');
          } else {
            Store.addFourniture(data);
            Toast.success('Fourniture créée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openMouvement(fournitureId, type) {
    const f = Store.state.fournitures.find(f => f.id === fournitureId);
    if (!f) return;
    const isAtelier = activeTab === 'atelier';
    const current = isAtelier ? (Store.state.stockAtelier[fournitureId] || 0)
                              : (Store.state.stockCamions[activeTab]?.[fournitureId] || 0);

    Modal.open({
      title: `${type === 'entree' ? '➕ Entrée' : '➖ Sortie'} — ${f.nom}`,
      size: 'small',
      body: `
        <p class="hint">Stock actuel : <strong class="mono">${current} ${f.unite}</strong></p>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Quantité *</label>
            <input id="m_qte" class="form-input mono" type="number" min="1" placeholder="0" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Motif</label>
            <input id="m_motif" class="form-input" placeholder="${type === 'entree' ? 'Livraison fournisseur, retour chantier...' : 'Utilisation chantier...'}">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="mSave">Valider</button>
      `,
      onOpen: () => {
        document.getElementById('mSave').addEventListener('click', () => {
          const qte = parseInt(document.getElementById('m_qte').value);
          const motif = document.getElementById('m_motif').value.trim();
          if (!qte || qte <= 0) { Toast.warning('Quantité invalide'); return; }
          const delta = type === 'entree' ? qte : -qte;
          const newQte = current + delta;
          if (newQte < 0) { Toast.warning('Stock insuffisant'); return; }

          if (isAtelier) Store.setStockAtelier(fournitureId, newQte);
          else Store.setStockCamion(activeTab, fournitureId, newQte);

          Store.addMouvement({
            fournitureId, type,
            quantite: qte,
            emplacement: isAtelier ? 'atelier' : activeTab,
            motif,
            date: new Date().toISOString()
          });

          Toast.success(`${type === 'entree' ? 'Entrée' : 'Sortie'} enregistrée`);
          Modal.close();
          renderContent();
        });
      }
    });
  }

  function openTransfert(fournitureId) {
    const f = Store.state.fournitures.find(f => f.id === fournitureId);
    if (!f) return;
    const current = activeTab === 'atelier' ? (Store.state.stockAtelier[fournitureId] || 0)
                                            : (Store.state.stockCamions[activeTab]?.[fournitureId] || 0);
    const sourceLabel = activeTab === 'atelier' ? 'Atelier' : Store.state.equipes.find(e => e.id === activeTab)?.nom;
    const destinations = ['atelier', ...Store.state.equipes.map(e => e.id)].filter(d => d !== activeTab);

    Modal.open({
      title: `⇄ Transfert — ${f.nom}`,
      size: 'small',
      body: `
        <p class="hint">Disponible dans ${sourceLabel} : <strong class="mono">${current} ${f.unite}</strong></p>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Destination *</label>
            <select id="t_dest" class="form-select">
              ${destinations.map(d => {
                const label = d === 'atelier' ? '🏭 Atelier' : `🚚 ${Store.state.equipes.find(e => e.id === d)?.nom}`;
                return `<option value="${d}">${label}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Quantité *</label>
            <input id="t_qte" class="form-input mono" type="number" min="1" max="${current}" autofocus>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="tSave">Transférer</button>
      `,
      onOpen: () => {
        document.getElementById('tSave').addEventListener('click', () => {
          const qte = parseInt(document.getElementById('t_qte').value);
          const dest = document.getElementById('t_dest').value;
          if (!qte || qte <= 0 || qte > current) { Toast.warning('Quantité invalide'); return; }

          // Sortie source
          if (activeTab === 'atelier') Store.setStockAtelier(fournitureId, current - qte);
          else Store.setStockCamion(activeTab, fournitureId, current - qte);

          // Entrée dest
          const destCurrent = dest === 'atelier' ? (Store.state.stockAtelier[fournitureId] || 0)
                                                 : (Store.state.stockCamions[dest]?.[fournitureId] || 0);
          if (dest === 'atelier') Store.setStockAtelier(fournitureId, destCurrent + qte);
          else Store.setStockCamion(dest, fournitureId, destCurrent + qte);

          Store.addMouvement({
            fournitureId, type: 'transfert',
            quantite: qte,
            emplacement: activeTab,
            destination: dest,
            date: new Date().toISOString()
          });

          Toast.success('Transfert effectué');
          Modal.close();
          renderContent();
        });
      }
    });
  }

  function deleteFourniture(id) {
    Modal.confirm({
      title: 'Supprimer cette fourniture ?',
      message: 'Tous les stocks et mouvements associés seront perdus.',
      danger: true,
      onConfirm: () => {
        Store.deleteFourniture(id);
        Toast.success('Fourniture supprimée');
        if (window.Router) Router.refresh();
      }
    });
  }

  function openMouvements() {
    const mvts = [...Store.state.mouvements].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
    Modal.open({
      title: '📋 Historique des mouvements',
      size: 'large',
      body: mvts.length === 0 ? '<p class="hint">Aucun mouvement enregistré.</p>' : `
        <table class="table">
          <thead><tr><th>Date</th><th>Type</th><th>Fourniture</th><th>Qté</th><th>Emplacement</th><th>Motif</th></tr></thead>
          <tbody>
            ${mvts.map(m => {
              const f = Store.state.fournitures.find(x => x.id === m.fournitureId);
              const empLabel = m.emplacement === 'atelier' ? '🏭 Atelier' : `🚚 ${Store.state.equipes.find(e => e.id === m.emplacement)?.nom || '?'}`;
              const typeLabel = { entree: '➕ Entrée', sortie: '➖ Sortie', transfert: '⇄ Transfert' }[m.type] || m.type;
              return `<tr>
                <td>${Format.dateShort(m.date)}</td>
                <td>${typeLabel}</td>
                <td>${Helpers.esc(f?.nom || '?')}</td>
                <td class="mono">${m.quantite}</td>
                <td>${empLabel}</td>
                <td>${Helpers.esc(m.motif || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `,
      footer: `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
    });
  }

  // ============================================================
  // EXPORT MOUVEMENTS (choix période + format)
  // ============================================================
  function openExportMouvements() {
    const mvts = Store.state.mouvements || [];
    // Années disponibles
    const annees = [...new Set(mvts.map(m => new Date(m.date).getFullYear()))].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!annees.includes(currentYear)) annees.unshift(currentYear);

    const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    Modal.open({
      title: '📥 Exporter les mouvements',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Période</label>
            <select id="exp_periode" class="form-select">
              <option value="all">Tous les mouvements</option>
              <option value="year">Une année entière</option>
              <option value="month" selected>Un mois précis</option>
            </select>
          </div>

          <div class="form-field" id="exp_year_wrap">
            <label>Année</label>
            <select id="exp_year" class="form-select">
              ${annees.map(a => `<option value="${a}" ${a === currentYear ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>

          <div class="form-field" id="exp_month_wrap">
            <label>Mois</label>
            <select id="exp_month" class="form-select">
              ${MOIS.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>

          <div class="form-field form-field--full">
            <label>Format</label>
            <div class="export-format-choice">
              <label class="export-format-option">
                <input type="radio" name="exp_format" value="pdf" checked>
                <span class="export-format-icon">📄</span>
                <span>PDF</span>
              </label>
              <label class="export-format-option">
                <input type="radio" name="exp_format" value="excel">
                <span class="export-format-icon">📊</span>
                <span>Excel</span>
              </label>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="exp_go">Télécharger</button>
      `,
      onOpen: () => {
        const periodeSelect = document.getElementById('exp_periode');
        const yearWrap = document.getElementById('exp_year_wrap');
        const monthWrap = document.getElementById('exp_month_wrap');

        const updateVisibility = () => {
          const v = periodeSelect.value;
          yearWrap.style.display = (v === 'year' || v === 'month') ? '' : 'none';
          monthWrap.style.display = (v === 'month') ? '' : 'none';
        };
        periodeSelect.addEventListener('change', updateVisibility);
        updateVisibility();

        document.getElementById('exp_go').addEventListener('click', () => {
          const periode = periodeSelect.value;
          const format = document.querySelector('input[name="exp_format"]:checked').value;
          let filter = null;

          if (periode === 'year') {
            filter = { year: parseInt(document.getElementById('exp_year').value) };
          } else if (periode === 'month') {
            filter = {
              year: parseInt(document.getElementById('exp_year').value),
              month: parseInt(document.getElementById('exp_month').value)
            };
          }

          Modal.close();
          if (format === 'pdf') {
            window.PdfExport?.mouvements(filter);
          } else {
            window.ExcelExport?.mouvements(filter);
          }
        });
      }
    });
  }

  return { render };
})();
