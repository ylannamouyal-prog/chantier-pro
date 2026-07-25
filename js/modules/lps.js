/* =================================================================
   LAST PLANNER SYSTEM (LPS)
   Engagements hebdomadaires, levée de contraintes, causes de
   non-réalisation, PPC (Pourcentage de Promesses Complétées)
   ================================================================= */

window.LPS = (function () {
  let semaineCourante = null;
  let chartPPC = null;
  let chartCauses = null;

  const JOURS = [
    { n: 1, label: 'Lun' },
    { n: 2, label: 'Mar' },
    { n: 3, label: 'Mer' },
    { n: 4, label: 'Jeu' },
    { n: 5, label: 'Ven' }
  ];

  const STATUTS = {
    'en-attente':   { label: 'En attente',   cls: 'lps-badge--attente',  icon: '⏳' },
    'engagee':      { label: 'Engagée',      cls: 'lps-badge--engagee',  icon: '🤝' },
    'terminee':     { label: 'Terminée',     cls: 'lps-badge--terminee', icon: '✅' },
    'non-realisee': { label: 'Non réalisée', cls: 'lps-badge--echec',    icon: '❌' }
  };

  function couleurPPC(ppc) {
    if (ppc === null || ppc === undefined) return '#64748b';
    if (ppc >= 80) return '#10b981';
    if (ppc >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function classePPC(ppc) {
    if (ppc === null || ppc === undefined) return 'lps-ppc--neutre';
    if (ppc >= 80) return 'lps-ppc--bon';
    if (ppc >= 60) return 'lps-ppc--moyen';
    return 'lps-ppc--faible';
  }

  function labelSemaine(key) {
    const { lundi, dimanche } = Store.getSemaineDates(key);
    const num = key.split('-W')[1];
    return `Semaine ${num} — du ${Format.dateShort(lundi.toISOString())} au ${Format.dateShort(dimanche.toISOString())}`;
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================
  function render(container) {
    if (!semaineCourante) semaineCourante = Store.getSemaineKey(new Date());

    // Synchronise automatiquement les chantiers planifiables de la semaine
    if (Store.syncLPSFromChantiers) Store.syncLPSFromChantiers(semaineCourante);

    const taches = Store.getTachesLPSBySemaine(semaineCourante);
    const stats = Store.calculerPPC(semaineCourante);
    const semaineActuelle = Store.getSemaineKey(new Date());

    container.innerHTML = `
      <div class="lps-wrap">

        <!-- Navigation semaine + PPC -->
        <div class="lps-topbar">
          <div class="lps-nav">
            <button class="btn btn--ghost btn--sm" id="lpsPrev">‹ Semaine préc.</button>
            <div class="lps-nav__label">
              <strong>${labelSemaine(semaineCourante)}</strong>
              ${semaineCourante === semaineActuelle ? '<span class="badge badge--info">Semaine en cours</span>' : ''}
            </div>
            <button class="btn btn--ghost btn--sm" id="lpsNext">Semaine suiv. ›</button>
            ${semaineCourante !== semaineActuelle ? '<button class="btn btn--ghost btn--sm" id="lpsToday">Aujourd\'hui</button>' : ''}
          </div>
          <button class="btn btn--primary" id="lpsAddTache">+ Nouvel engagement</button>
        </div>

        <!-- KPI de la semaine -->
        <div class="lps-kpis">
          <div class="lps-kpi lps-kpi--ppc ${classePPC(stats.ppc)}">
            <span class="lps-kpi__label">PPC de la semaine</span>
            <span class="lps-kpi__value">${stats.ppc === null ? '—' : stats.ppc + ' %'}</span>
            <span class="lps-kpi__sub">${stats.terminees} terminée(s) / ${stats.engagees} engagée(s)</span>
          </div>
          <div class="lps-kpi">
            <span class="lps-kpi__label">⏳ En attente</span>
            <span class="lps-kpi__value">${stats.enAttente}</span>
            <span class="lps-kpi__sub">contraintes à lever</span>
          </div>
          <div class="lps-kpi">
            <span class="lps-kpi__label">🤝 Engagées</span>
            <span class="lps-kpi__value">${taches.filter(t => t.statut === 'engagee').length}</span>
            <span class="lps-kpi__sub">en cours de réalisation</span>
          </div>
          <div class="lps-kpi">
            <span class="lps-kpi__label">❌ Non réalisées</span>
            <span class="lps-kpi__value">${stats.nonRealisees}</span>
            <span class="lps-kpi__sub">causes analysées</span>
          </div>
        </div>

        <!-- Liste des engagements -->
        <div class="lps-section">
          <div class="lps-section__head">
            <h3 class="lps-section__title">📋 Engagements de la semaine</h3>
            <span class="hint">🔄 Les chantiers planifiables (commandés, prévus, en cours) sont ajoutés automatiquement.</span>
          </div>
          ${taches.length === 0 ? `
            <div class="lps-empty">
              <span class="lps-empty__icon">📋</span>
              <p><strong>Aucun engagement cette semaine</strong></p>
              <p class="hint">Aucun chantier planifiable n'est actif cette semaine. Les chantiers commandés, prévus ou en cours apparaîtront ici automatiquement. Vous pouvez aussi ajouter une tâche manuellement.</p>
              <button class="btn btn--primary" id="lpsAddTache2">+ Nouvel engagement</button>
            </div>
          ` : `
            <div class="lps-taches">
              ${taches.map(renderTacheCard).join('')}
            </div>
          `}
        </div>

        <!-- Graphiques -->
        <div class="lps-charts">
          <div class="lps-chart-card">
            <h3 class="lps-section__title">📈 Évolution du PPC</h3>
            <p class="hint">Objectif : rester au-dessus de 80 %.</p>
            <div class="lps-chart"><canvas id="lpsChartPPC"></canvas></div>
          </div>
          <div class="lps-chart-card">
            <h3 class="lps-section__title">🔍 Causes de non-réalisation</h3>
            <p class="hint">Sur les 12 dernières semaines — identifiez les problèmes récurrents.</p>
            <div class="lps-chart"><canvas id="lpsChartCauses"></canvas></div>
          </div>
        </div>

      </div>
    `;

    bindEvents(container);
    setTimeout(() => { renderCharts(); }, 50);
  }

  function renderTacheCard(t) {
    const chantier = Store.state.chantiers.find(c => c.id === t.chantierId);
    const equipe = (Store.state.equipes || []).find(e => e.id === t.equipeId);
    const st = STATUTS[t.statut] || STATUTS['en-attente'];
    const bloquantes = Store.getContraintesBloquantes(t);
    const joursLabel = (t.jours || []).length > 0
      ? JOURS.filter(j => t.jours.includes(j.n)).map(j => j.label).join(', ')
      : '—';

    return `
      <div class="lps-tache" data-lps-id="${t.id}">
        <div class="lps-tache__head">
          <div class="lps-tache__title">
            <strong>${Helpers.esc(t.description || '(Sans description)')}</strong>
            <span class="lps-badge ${st.cls}">${st.icon} ${st.label}</span>
            ${t.source === 'auto' ? '<span class="lps-badge lps-badge--auto" title="Généré automatiquement depuis le chantier">🔄 auto</span>' : ''}
          </div>
          <div class="lps-tache__actions">
            <button class="btn-icon" data-lps-edit title="Modifier">✎</button>
            <button class="btn-icon btn-icon--danger" data-lps-del title="Supprimer">🗑</button>
          </div>
        </div>

        <div class="lps-tache__info">
          ${chantier ? `<span>🏗️ ${Helpers.esc(chantier.numero || '')} — ${Helpers.esc(chantier.titre || '')}</span>` : '<span class="hint">Chantier non défini</span>'}
          ${equipe ? `<span>👷 ${Helpers.esc(equipe.nom)}</span>` : ''}
          <span>📅 ${joursLabel}</span>
        </div>

        ${t.statut === 'en-attente' ? `
          <div class="lps-contraintes">
            ${bloquantes.length === 0 ? `
              <div class="lps-contraintes__ok">
                ✅ Toutes les contraintes sont levées — la tâche peut être engagée.
                <button class="btn btn--primary btn--sm" data-lps-engager>🤝 Engager la tâche</button>
              </div>
            ` : `
              <div class="lps-contraintes__ko">
                <strong>⚠️ ${bloquantes.length} contrainte(s) bloquante(s)</strong>
                <div class="lps-contraintes__list">
                  ${bloquantes.map(b => `
                    <span class="lps-contrainte-badge" ${b.detail ? `title="${Helpers.esc(b.detail)}"` : ''}>
                      ${b.icon} ${Helpers.esc(b.label)}${b.detail ? ' — ' + Helpers.esc(b.detail) : ''}
                    </span>
                  `).join('')}
                </div>
                <button class="btn btn--ghost btn--sm" data-lps-checklist>📋 Voir / lever les contraintes</button>
              </div>
            `}
          </div>
        ` : ''}

        ${t.statut === 'engagee' ? `
          <div class="lps-tache__resolve">
            <button class="btn btn--primary btn--sm" data-lps-terminee>✅ Marquer terminée</button>
            <button class="btn btn--ghost btn--sm" data-lps-echec>❌ Non réalisée</button>
          </div>
        ` : ''}

        ${t.statut === 'non-realisee' && t.cause ? `
          <div class="lps-cause">
            <strong>Cause :</strong> ${Helpers.esc(causeLabel(t.cause.code))}
            ${t.cause.detail ? ` — ${Helpers.esc(t.cause.detail)}` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  function causeLabel(code) {
    const c = Store.CAUSES_LPS.find(x => x.id === code);
    return c ? c.label : code;
  }

  // ============================================================
  // ÉVÉNEMENTS
  // ============================================================
  function bindEvents(container) {
    const rerender = () => render(container);

    document.getElementById('lpsPrev')?.addEventListener('click', () => {
      semaineCourante = Store.decalerSemaine(semaineCourante, -1);
      rerender();
    });
    document.getElementById('lpsNext')?.addEventListener('click', () => {
      semaineCourante = Store.decalerSemaine(semaineCourante, 1);
      rerender();
    });
    document.getElementById('lpsToday')?.addEventListener('click', () => {
      semaineCourante = Store.getSemaineKey(new Date());
      rerender();
    });
    document.getElementById('lpsAddTache')?.addEventListener('click', () => openTacheForm(null, rerender));
    document.getElementById('lpsAddTache2')?.addEventListener('click', () => openTacheForm(null, rerender));

    container.querySelectorAll('[data-lps-id]').forEach(card => {
      const id = card.dataset.lpsId;

      card.querySelector('[data-lps-edit]')?.addEventListener('click', () => openTacheForm(id, rerender));

      card.querySelector('[data-lps-del]')?.addEventListener('click', () => {
        const t = (Store.state.tachesLPS || []).find(x => x.id === id);
        const estAuto = t && t.source === 'auto';
        Modal.confirm({
          title: 'Retirer cet engagement ?',
          message: estAuto
            ? 'Ce chantier a été ajouté automatiquement. Il ne réapparaîtra plus pour cette semaine (vous pourrez le rajouter manuellement si besoin).'
            : 'Cette action est irréversible.',
          danger: true,
          onConfirm: () => {
            Store.deleteTacheLPS(id);
            Toast.success('Engagement retiré');
            rerender();
          }
        });
      });

      card.querySelector('[data-lps-checklist]')?.addEventListener('click', () => openChecklist(id, rerender));

      card.querySelector('[data-lps-engager]')?.addEventListener('click', () => {
        const t = (Store.state.tachesLPS || []).find(x => x.id === id);
        const bloquantes = Store.getContraintesBloquantes(t);
        if (bloquantes.length > 0) {
          Toast.warning('Des contraintes ne sont pas levées');
          return;
        }
        Store.updateTacheLPS(id, { statut: 'engagee' });
        Toast.success('Tâche engagée 🤝');
        rerender();
      });

      card.querySelector('[data-lps-terminee]')?.addEventListener('click', () => {
        Store.updateTacheLPS(id, { statut: 'terminee', cause: null });
        Toast.success('Tâche terminée ✅');
        rerender();
      });

      card.querySelector('[data-lps-echec]')?.addEventListener('click', () => openCauseForm(id, rerender));
    });
  }

  // ============================================================
  // FORMULAIRE D'ENGAGEMENT
  // ============================================================
  function openTacheForm(tacheId, onDone) {
    const existing = tacheId ? (Store.state.tachesLPS || []).find(t => t.id === tacheId) : null;
    const t = existing || {
      description: '', chantierId: null, equipeId: null,
      semaine: semaineCourante, jours: [], contraintes: {}
    };

    const chantiers = (Store.state.chantiers || []).filter(c => Helpers.computeStatus(c) !== 'termine');
    const equipes = Store.state.equipes || [];

    Modal.open({
      title: existing ? "Modifier l'engagement" : '📋 Nouvel engagement',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Description de la tâche *</label>
            <input id="lps_desc" class="form-input" value="${Helpers.esc(t.description)}"
              placeholder="Ex: Pose des menuiseries niveau 1" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Chantier *</label>
            <select id="lps_chantier" class="form-select">
              <option value="">— Choisir —</option>
              ${chantiers.map(c => `<option value="${c.id}" ${t.chantierId === c.id ? 'selected' : ''}>${Helpers.esc(c.numero || '')} — ${Helpers.esc(c.titre || '')}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Équipe assignée</label>
            <select id="lps_equipe" class="form-select">
              <option value="">— Aucune —</option>
              ${equipes.map(e => `<option value="${e.id}" ${t.equipeId === e.id ? 'selected' : ''}>${Helpers.esc(e.nom)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Jours prévus</label>
            <div class="lps-jours-picker">
              ${JOURS.map(j => `
                <label class="lps-jour-chk">
                  <input type="checkbox" class="lps-jour" value="${j.n}" ${(t.jours || []).includes(j.n) ? 'checked' : ''}>
                  <span>${j.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
        <p class="hint" style="margin-top:var(--s-2)">
          La tâche sera créée <strong>en attente</strong> : vous devrez lever les contraintes avant de l'engager.
        </p>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="lpsSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.getElementById('lpsSave').addEventListener('click', () => {
          const jours = Array.from(document.querySelectorAll('.lps-jour:checked')).map(c => parseInt(c.value, 10));
          const data = {
            description: document.getElementById('lps_desc').value.trim(),
            chantierId: document.getElementById('lps_chantier').value || null,
            equipeId: document.getElementById('lps_equipe').value || null,
            jours,
            semaine: existing ? existing.semaine : semaineCourante
          };
          if (!data.description) { Toast.warning('La description est requise'); return; }
          if (!data.chantierId) { Toast.warning('Choisissez un chantier'); return; }

          if (existing) {
            Store.updateTacheLPS(existing.id, data);
            Toast.success('Engagement mis à jour');
          } else {
            Store.addTacheLPS(data);
            Toast.success('Engagement créé');
          }
          Modal.close();
          onDone();
        });
      }
    });
  }

  // ============================================================
  // CHECKLIST DE LEVÉE DE CONTRAINTES
  // ============================================================
  function openChecklist(tacheId, onDone) {
    const t = (Store.state.tachesLPS || []).find(x => x.id === tacheId);
    if (!t) return;
    const auto = Store.verifierContraintesAuto(t);

    Modal.open({
      title: '📋 Levée de contraintes',
      size: 'medium',
      body: `
        <p class="hint" style="margin-bottom:var(--s-3)">
          <strong>${Helpers.esc(t.description)}</strong><br>
          Toutes les contraintes doivent être levées avant d'engager la tâche.
        </p>
        <div class="lps-checklist">
          ${Store.CONTRAINTES_LPS.map(c => {
            if (c.auto) {
              const ok = auto[c.id] !== false;
              const detail = auto.details[c.id];
              return `
                <div class="lps-check-row ${ok ? 'is-ok' : 'is-ko'}">
                  <span class="lps-check-icon">${ok ? '✅' : '⚠️'}</span>
                  <div class="lps-check-info">
                    <strong>${c.icon} ${Helpers.esc(c.label)}</strong>
                    <span class="hint">${ok ? 'Vérifié automatiquement — OK' : Helpers.esc(detail || 'Problème détecté')}</span>
                  </div>
                  <span class="badge ${ok ? 'badge--success' : 'badge--danger'}">${ok ? 'Levée' : 'Bloquante'}</span>
                </div>
              `;
            }
            const coche = !!(t.contraintes && t.contraintes[c.id]);
            return `
              <label class="lps-check-row lps-check-row--manuel ${coche ? 'is-ok' : ''}">
                <input type="checkbox" class="lps-contrainte-chk" data-contrainte="${c.id}" ${coche ? 'checked' : ''}>
                <div class="lps-check-info">
                  <strong>${c.icon} ${Helpers.esc(c.label)}</strong>
                  <span class="hint">À confirmer manuellement</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Fermer</button>
        <button class="btn btn--primary" id="lpsCheckSave">Enregistrer</button>
      `,
      onOpen: () => {
        document.getElementById('lpsCheckSave').addEventListener('click', () => {
          const contraintes = { ...(t.contraintes || {}) };
          document.querySelectorAll('.lps-contrainte-chk').forEach(chk => {
            contraintes[chk.dataset.contrainte] = chk.checked;
          });
          Store.updateTacheLPS(tacheId, { contraintes });

          const maj = (Store.state.tachesLPS || []).find(x => x.id === tacheId);
          const reste = Store.getContraintesBloquantes(maj);
          if (reste.length === 0) {
            Toast.success('Toutes les contraintes sont levées ✅');
          } else {
            Toast.info(`${reste.length} contrainte(s) encore bloquante(s)`);
          }
          Modal.close();
          onDone();
        });
      }
    });
  }

  // ============================================================
  // CAUSE DE NON-RÉALISATION (obligatoire)
  // ============================================================
  function openCauseForm(tacheId, onDone) {
    const t = (Store.state.tachesLPS || []).find(x => x.id === tacheId);
    if (!t) return;

    Modal.open({
      title: '❌ Cause de non-réalisation',
      size: 'small',
      body: `
        <p class="hint" style="margin-bottom:var(--s-3)">
          <strong>${Helpers.esc(t.description)}</strong><br>
          Indiquez la cause racine : elle sera analysée pour éviter que le problème se répète.
        </p>
        <div class="lps-causes-list">
          ${Store.CAUSES_LPS.map(c => `
            <label class="lps-cause-option">
              <input type="radio" name="lps_cause" value="${c.id}">
              <span class="lps-cause-dot" style="background:${c.couleur}"></span>
              <span>${Helpers.esc(c.label)}</span>
            </label>
          `).join('')}
        </div>
        <div class="form-field form-field--full" style="margin-top:var(--s-3)">
          <label>Précision (obligatoire si « Autre »)</label>
          <input id="lps_cause_detail" class="form-input" placeholder="Détail de la cause...">
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--danger" id="lpsCauseSave">Valider</button>
      `,
      onOpen: () => {
        document.getElementById('lpsCauseSave').addEventListener('click', () => {
          const sel = document.querySelector('input[name="lps_cause"]:checked');
          if (!sel) { Toast.warning('Sélectionnez une cause'); return; }
          const detail = document.getElementById('lps_cause_detail').value.trim();
          if (sel.value === 'autre' && !detail) {
            Toast.warning('Précisez la cause dans le champ « Précision »');
            return;
          }
          Store.updateTacheLPS(tacheId, {
            statut: 'non-realisee',
            cause: { code: sel.value, detail }
          });
          Toast.info('Cause enregistrée — elle apparaîtra dans l\'analyse');
          Modal.close();
          onDone();
        });
      }
    });
  }

  // ============================================================
  // GRAPHIQUES
  // ============================================================
  function renderCharts() {
    if (typeof Chart === 'undefined') return;

    // --- Évolution du PPC ---
    const canvasPPC = document.getElementById('lpsChartPPC');
    if (canvasPPC) {
      if (chartPPC) { chartPPC.destroy(); chartPPC = null; }
      const hist = Store.getPPCHistorique(8, semaineCourante);
      const labels = hist.map(h => 'S' + h.semaine.split('-W')[1]);
      const data = hist.map(h => h.ppc);

      chartPPC = new Chart(canvasPPC, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'PPC (%)',
            data,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.12)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            spanGaps: true,
            pointRadius: 5,
            pointBackgroundColor: data.map(v => couleurPPC(v)),
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ctx.parsed.y === null ? 'Pas de données' : `PPC : ${ctx.parsed.y} %`
              }
            }
          },
          scales: {
            y: {
              min: 0, max: 100,
              ticks: { callback: v => v + ' %' },
              grid: { color: 'rgba(148,163,184,0.15)' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // --- Causes de non-réalisation ---
    const canvasCauses = document.getElementById('lpsChartCauses');
    if (canvasCauses) {
      if (chartCauses) { chartCauses.destroy(); chartCauses = null; }
      const stats = Store.getCausesStatsLPS(semaineCourante, 12);

      if (stats.length === 0) {
        canvasCauses.parentElement.innerHTML =
          '<p class="hint" style="text-align:center;padding:var(--s-4)">Aucune tâche non réalisée sur les 12 dernières semaines. 👍</p>';
        return;
      }

      chartCauses = new Chart(canvasCauses, {
        type: 'doughnut',
        data: {
          labels: stats.map(s => s.label),
          datasets: [{
            data: stats.map(s => s.count),
            backgroundColor: stats.map(s => s.couleur),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } }
          }
        }
      });
    }
  }

  /** Détruit les graphiques (appelé quand on quitte la vue LPS) */
  function destroy() {
    if (chartPPC) { chartPPC.destroy(); chartPPC = null; }
    if (chartCauses) { chartCauses.destroy(); chartCauses = null; }
  }

  return { render, destroy, couleurPPC, classePPC };
})();
