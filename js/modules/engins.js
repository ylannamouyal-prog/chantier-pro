// Module Engins - matériel et réservations
window.Engins = (function () {
  function render(container) {
    const engins = Store.state.engins || [];
    const atelier = engins.filter(e => (e.disponibilite || 'atelier') === 'atelier');
    const location = engins.filter(e => e.disponibilite === 'location');

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">🚜 Engins & Locations</h1>
          <p class="view-subtitle">${engins.length} engin${engins.length > 1 ? 's' : ''} — ${atelier.length} à l'atelier · ${location.length} en location</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="engExport">📥 Exporter réservations</button>
          <button class="btn btn--ghost" id="engReserv">📅 Toutes réservations</button>
          <button class="btn btn--primary" id="engAdd">+ Nouvel engin</button>
        </div>
      </div>

      ${engins.length === 0 ? UI.emptyState({
        icon: '🚜', title: 'Aucun engin',
        message: 'Ajoutez vos engins (nacelles, échafaudages, camions...).',
        action: '<button class="btn btn--primary" onclick="Engins._add()">+ Nouvel engin</button>'
      }) : `
        <div class="engins-section">
          <div class="engins-section__title">🏭 Engins à l'atelier <span class="hint">(${atelier.length})</span></div>
          ${atelier.length === 0 ? '<p class="hint" style="padding:var(--s-2)">Aucun engin à l\'atelier.</p>' :
            `<div class="engins-grid">${atelier.map(renderCard).join('')}</div>`}
        </div>

        <div class="engins-section">
          <div class="engins-section__title">🔑 Engins à louer <span class="hint">(${location.length})</span></div>
          ${location.length === 0 ? '<p class="hint" style="padding:var(--s-2)">Aucun engin en location. Ajoutez-en un et choisissez "À louer".</p>' :
            `<div class="engins-grid">${location.map(renderCard).join('')}</div>`}
        </div>
      `}
    `;

    document.getElementById('engAdd')?.addEventListener('click', () => openForm());
    document.getElementById('engReserv')?.addEventListener('click', openAllReservations);
    document.getElementById('engExport')?.addEventListener('click', openExportReservations);

    container.querySelectorAll('[data-engin-id]').forEach(card => {
      card.querySelector('[data-eng-edit]')?.addEventListener('click', () => openForm(card.dataset.enginId));
      card.querySelector('[data-eng-reserve]')?.addEventListener('click', () => openReservation(card.dataset.enginId));
      card.querySelector('[data-eng-delete]')?.addEventListener('click', () => deleteEngin(card.dataset.enginId));
      card.querySelector('[data-eng-view]')?.addEventListener('click', () => openDetail(card.dataset.enginId));
    });
  }

  function renderCard(engin) {
    const reservations = (Store.state.reservationsEngins || []).filter(r => r.enginId === engin.id);
    const now = new Date();
    const currentRes = reservations.find(r => new Date(r.dateDebut) <= now && new Date(r.dateFin) >= now);
    const upcoming = reservations.filter(r => new Date(r.dateDebut) > now)
      .sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut))[0];

    return `
      <div class="engin-card" data-engin-id="${engin.id}">
        <div class="engin-card__header">
          <div class="engin-icon">${engin.icone || '🚜'}</div>
          <div class="engin-card__title">
            <h3>${Helpers.esc(engin.nom)}</h3>
            <span class="engin-type">${Helpers.esc(engin.type || '')}</span>
          </div>
          ${currentRes ? '<span class="badge badge--warning">Réservé</span>' : '<span class="badge badge--success">Libre</span>'}
        </div>
        <div class="engin-card__meta">
          ${engin.modele ? `<div>📋 ${Helpers.esc(engin.modele)}</div>` : ''}
          ${engin.proprietaire ? `<div>🏢 ${Helpers.esc(engin.proprietaire)}</div>` : ''}
          ${engin.disponibilite === 'location' && engin.loueurTel ? `<div>📞 ${Format.phone(engin.loueurTel)}</div>` : ''}
          ${engin.disponibilite === 'location' && engin.loueurEmail ? `<div>✉ ${Helpers.esc(engin.loueurEmail)}</div>` : ''}
          ${engin.coutJournalier ? `<div>💶 ${Format.euro(engin.coutJournalier)}/jour</div>` : ''}
        </div>
        ${currentRes ? `
          <div class="engin-current">
            <strong>En cours :</strong>
            ${Helpers.esc(getChantierTitle(currentRes.chantierId))}
            <span>jusqu'au ${Format.dateShort(currentRes.dateFin)}</span>
          </div>
        ` : upcoming ? `
          <div class="engin-upcoming">
            <strong>Prochaine :</strong>
            ${Helpers.esc(getChantierTitle(upcoming.chantierId))}
            <span>${Format.dateShort(upcoming.dateDebut)}</span>
          </div>
        ` : ''}
        <div class="engin-card__actions">
          <button class="btn btn--ghost btn--sm" data-eng-view>Détail</button>
          <button class="btn btn--ghost btn--sm" data-eng-reserve>📅 Réserver</button>
          <button class="btn-icon" data-eng-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-eng-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function getChantierTitle(id) {
    return Store.state.chantiers.find(c => c.id === id)?.titre || '—';
  }

  function openForm(id = null) {
    const existing = id ? Store.state.engins.find(e => e.id === id) : null;
    const e = existing || { nom: '', type: '', modele: '', proprietaire: '', icone: '🚜', coutJournalier: 0, disponibilite: 'atelier', loueurTel: '', loueurEmail: '' };

    Modal.open({
      title: existing ? 'Modifier l\'engin' : 'Nouvel engin',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Disponibilité *</label>
            <div class="dispo-choice">
              <label class="dispo-option ${(e.disponibilite || 'atelier') === 'atelier' ? 'is-selected' : ''}">
                <input type="radio" name="f_dispo" value="atelier" ${(e.disponibilite || 'atelier') === 'atelier' ? 'checked' : ''}>
                <span class="dispo-icon">🏭</span>
                <span><strong>À l'atelier</strong><br><span class="hint">Engin que vous possédez</span></span>
              </label>
              <label class="dispo-option ${e.disponibilite === 'location' ? 'is-selected' : ''}">
                <input type="radio" name="f_dispo" value="location" ${e.disponibilite === 'location' ? 'checked' : ''}>
                <span class="dispo-icon">🔑</span>
                <span><strong>À louer</strong><br><span class="hint">Engin loué chez un tiers</span></span>
              </label>
            </div>
          </div>

          <div class="form-field">
            <label>Icône</label>
            <select id="f_icone" class="form-select">
              ${['🚜', '🚛', '🏗️', '🪜', '🛠️', '🔧', '⚙️'].map(i =>
                `<option value="${i}" ${e.icone === i ? 'selected' : ''}>${i}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Type</label>
            <select id="f_type" class="form-select">
              ${['', 'Nacelle', 'Échafaudage', 'Camion grue', 'Chariot', 'Outillage', 'Autre']
                .map(t => `<option value="${t}" ${e.type === t ? 'selected' : ''}>${t || '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(e.nom)}" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Modèle</label>
            <input id="f_modele" class="form-input" value="${Helpers.esc(e.modele || '')}">
          </div>

          <div class="form-field form-field--full" id="loueurSection">
            <div class="loueur-block">
              <div class="loueur-block__title">🔑 Informations du loueur</div>
              <div class="form-grid">
                <div class="form-field form-field--full">
                  <label>Nom du loueur</label>
                  <input id="f_prop" class="form-input" value="${Helpers.esc(e.proprietaire || '')}" placeholder="Ex: Loxam, Kiloutou...">
                </div>
                <div class="form-field">
                  <label>Téléphone</label>
                  <input id="f_loueurTel" class="form-input" value="${Helpers.esc(e.loueurTel || '')}" placeholder="01 23 45 67 89">
                </div>
                <div class="form-field">
                  <label>Email</label>
                  <input id="f_loueurEmail" class="form-input" type="email" value="${Helpers.esc(e.loueurEmail || '')}" placeholder="contact@loueur.fr">
                </div>
                <div class="form-field form-field--full">
                  <label>Coût de location (€/jour)</label>
                  <input id="f_cout" class="form-input mono" type="number" step="0.01" min="0" value="${e.coutJournalier || 0}">
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="eSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        const loueurSection = document.getElementById('loueurSection');
        const updateLoueurVisibility = () => {
          const dispo = document.querySelector('input[name="f_dispo"]:checked')?.value;
          // Pour un engin atelier, on peut quand même renseigner le propriétaire mais on cache le bloc loueur détaillé
          if (dispo === 'location') {
            loueurSection.querySelector('.loueur-block__title').textContent = '🔑 Informations du loueur';
            loueurSection.style.display = '';
          } else {
            loueurSection.querySelector('.loueur-block__title').textContent = '💶 Informations complémentaires';
            loueurSection.style.display = '';
          }
        };
        document.querySelectorAll('input[name="f_dispo"]').forEach(r => {
          r.addEventListener('change', () => {
            document.querySelectorAll('.dispo-option').forEach(o => o.classList.remove('is-selected'));
            r.closest('.dispo-option').classList.add('is-selected');
            updateLoueurVisibility();
          });
        });
        updateLoueurVisibility();

        document.getElementById('eSave').addEventListener('click', () => {
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            type: document.getElementById('f_type').value,
            modele: document.getElementById('f_modele').value.trim(),
            proprietaire: document.getElementById('f_prop').value.trim(),
            icone: document.getElementById('f_icone').value,
            coutJournalier: parseFloat(document.getElementById('f_cout').value) || 0,
            disponibilite: document.querySelector('input[name="f_dispo"]:checked')?.value || 'atelier',
            loueurTel: document.getElementById('f_loueurTel').value.trim(),
            loueurEmail: document.getElementById('f_loueurEmail').value.trim()
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateEngin(existing.id, data);
            Toast.success('Engin mis à jour');
          } else {
            Store.addEngin(data);
            Toast.success('Engin créé');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openReservation(enginId) {
    const engin = Store.state.engins.find(e => e.id === enginId);
    if (!engin) return;
    const chantiers = Store.state.chantiers.filter(c => Helpers.computeStatus(c) !== 'termine');

    Modal.open({
      title: `📅 Réserver ${engin.nom}`,
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Chantier *</label>
            <select id="r_chantier" class="form-select">
              <option value="">— Choisir un chantier —</option>
              ${chantiers.map(c => `<option value="${c.id}">${Helpers.esc(c.numero)} — ${Helpers.esc(c.titre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Date début *</label>
            <input id="r_debut" class="form-input" type="date">
          </div>
          <div class="form-field">
            <label>Date fin *</label>
            <input id="r_fin" class="form-input" type="date">
          </div>
          <div class="form-field form-field--full">
            <p class="hint">💡 Les dates se remplissent avec celles du chantier — modifiables si besoin.</p>
          </div>
          <div class="form-field form-field--full">
            <label>Notes</label>
            <textarea id="r_notes" class="form-textarea" rows="2"></textarea>
          </div>
          <div class="form-field form-field--full">
            <div id="conflictAlert"></div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="rSave">Réserver</button>
      `,
      onOpen: () => {
        const checkConflict = () => {
          const debut = document.getElementById('r_debut').value;
          const fin = document.getElementById('r_fin').value;
          const alert = document.getElementById('conflictAlert');
          if (!debut || !fin) { alert.innerHTML = ''; return; }
          const conflicts = detectConflicts(enginId, debut, fin);
          if (conflicts.length > 0) {
            alert.innerHTML = `<div class="alert alert--warning">
              ⚠️ <strong>Conflit détecté</strong> avec ${conflicts.length} réservation(s) :
              <ul>${conflicts.map(c => `<li>${Helpers.esc(getChantierTitle(c.chantierId))} (${Format.dateShort(c.dateDebut)} → ${Format.dateShort(c.dateFin)})</li>`).join('')}</ul>
            </div>`;
          } else {
            alert.innerHTML = `<div class="alert alert--success">✓ Aucun conflit sur cette période</div>`;
          }
        };
        document.getElementById('r_debut')?.addEventListener('change', checkConflict);
        document.getElementById('r_fin')?.addEventListener('change', checkConflict);

        // Pré-remplit les dates avec celles du chantier sélectionné
        document.getElementById('r_chantier')?.addEventListener('change', (e) => {
          const chantier = Store.state.chantiers.find(c => c.id === e.target.value);
          if (chantier && chantier.dateDebut && chantier.dateFin) {
            document.getElementById('r_debut').value = (chantier.dateDebut || '').slice(0, 10);
            document.getElementById('r_fin').value = (chantier.dateFin || '').slice(0, 10);
            checkConflict();
          }
        });

        document.getElementById('rSave').addEventListener('click', () => {
          const chantierId = document.getElementById('r_chantier').value;
          const dateDebut = document.getElementById('r_debut').value;
          const dateFin = document.getElementById('r_fin').value;
          const notes = document.getElementById('r_notes').value.trim();
          if (!chantierId || !dateDebut || !dateFin) { Toast.warning('Chantier et dates requis'); return; }
          if (new Date(dateFin) < new Date(dateDebut)) { Toast.warning('Date fin invalide'); return; }
          Store.reserveEngin({ enginId, chantierId, dateDebut, dateFin, notes });
          Toast.success('Réservation enregistrée');
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function detectConflicts(enginId, debut, fin) {
    const d = new Date(debut), f = new Date(fin);
    return (Store.state.reservationsEngins || []).filter(r => {
      if (r.enginId !== enginId) return false;
      const rd = new Date(r.dateDebut), rf = new Date(r.dateFin);
      return !(f < rd || d > rf);
    });
  }

  function openDetail(id) {
    const engin = Store.state.engins.find(e => e.id === id);
    if (!engin) return;
    const reservations = (Store.state.reservationsEngins || [])
      .filter(r => r.enginId === id)
      .sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));

    Modal.open({
      title: `${engin.icone} ${engin.nom}`,
      size: 'large',
      body: `
        <div class="detail-section">
          <h3>Caractéristiques</h3>
          <dl class="detail-list">
            <dt>Disponibilité</dt><dd>${engin.disponibilite === 'location' ? '🔑 À louer' : '🏭 À l\'atelier'}</dd>
            ${engin.type ? `<dt>Type</dt><dd>${Helpers.esc(engin.type)}</dd>` : ''}
            ${engin.modele ? `<dt>Modèle</dt><dd>${Helpers.esc(engin.modele)}</dd>` : ''}
            ${engin.proprietaire ? `<dt>${engin.disponibilite === 'location' ? 'Loueur' : 'Propriétaire'}</dt><dd>${Helpers.esc(engin.proprietaire)}</dd>` : ''}
            ${engin.loueurTel ? `<dt>Téléphone</dt><dd><span class="mono">${Format.phone(engin.loueurTel)}</span> <a href="tel:${Helpers.esc(engin.loueurTel)}" class="btn-icon" title="Appeler">📞</a></dd>` : ''}
            ${engin.loueurEmail ? `<dt>Email</dt><dd>${Helpers.esc(engin.loueurEmail)} <a href="mailto:${Helpers.esc(engin.loueurEmail)}" class="btn-icon" title="Email">✉</a></dd>` : ''}
            ${engin.coutJournalier ? `<dt>Coût</dt><dd>${Format.euro(engin.coutJournalier)} / jour</dd>` : ''}
          </dl>
        </div>
        <div class="detail-section">
          <h3>Historique des réservations (${reservations.length})</h3>
          ${reservations.length === 0 ? '<p class="hint">Aucune réservation.</p>' : `
            <table class="table">
              <thead><tr><th>Période</th><th>Chantier</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                ${reservations.map(r => `
                  <tr>
                    <td>${Format.dateShort(r.dateDebut)} → ${Format.dateShort(r.dateFin)}</td>
                    <td>${Helpers.esc(getChantierTitle(r.chantierId))}</td>
                    <td>${Helpers.esc(r.notes || '—')}</td>
                    <td><button class="btn-icon btn-icon--danger" onclick="Engins._delRes('${r.id}')">🗑</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `,
      footer: `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
    });
  }

  function _delRes(id) {
    Store.deleteReservationEngin(id);
    Toast.success('Réservation supprimée');
    Modal.close();
    if (window.Router) Router.refresh();
  }

  function deleteEngin(id) {
    Modal.confirm({
      title: 'Supprimer cet engin ?',
      message: 'Toutes les réservations associées seront perdues.',
      danger: true,
      onConfirm: () => {
        Store.deleteEngin(id);
        Toast.success('Engin supprimé');
        if (window.Router) Router.refresh();
      }
    });
  }

  function openAllReservations() {
    const all = [...(Store.state.reservationsEngins || [])].sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
    Modal.open({
      title: '📅 Toutes les réservations',
      size: 'large',
      body: all.length === 0 ? '<p class="hint">Aucune réservation.</p>' : `
        <table class="table">
          <thead><tr><th>Période</th><th>Engin</th><th>Chantier</th><th>Notes</th></tr></thead>
          <tbody>
            ${all.map(r => {
              const engin = Store.state.engins.find(e => e.id === r.enginId);
              return `<tr>
                <td>${Format.dateShort(r.dateDebut)} → ${Format.dateShort(r.dateFin)}</td>
                <td>${engin?.icone || ''} ${Helpers.esc(engin?.nom || '?')}</td>
                <td>${Helpers.esc(getChantierTitle(r.chantierId))}</td>
                <td>${Helpers.esc(r.notes || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `,
      footer: `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
    });
  }

  // ============================================================
  // EXPORT DES RÉSERVATIONS (PDF / Excel, par période)
  // ============================================================
  function openExportReservations() {
    const reservations = Store.state.reservationsEngins || [];
    const annees = [...new Set(reservations.map(r => new Date(r.dateDebut).getFullYear()))].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!annees.includes(currentYear)) annees.unshift(currentYear);
    const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    Modal.open({
      title: '📥 Exporter les réservations',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Période</label>
            <select id="exp_periode" class="form-select">
              <option value="all">Toutes les réservations</option>
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
                <span class="export-format-icon">📄</span><span>PDF</span>
              </label>
              <label class="export-format-option">
                <input type="radio" name="exp_format" value="excel">
                <span class="export-format-icon">📊</span><span>Excel</span>
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
          if (periode === 'year') filter = { year: parseInt(document.getElementById('exp_year').value) };
          else if (periode === 'month') filter = { year: parseInt(document.getElementById('exp_year').value), month: parseInt(document.getElementById('exp_month').value) };

          Modal.close();
          if (format === 'pdf') window.PdfExport?.reservationsEngins(filter);
          else window.ExcelExport?.reservationsEngins(filter);
        });
      }
    });
  }

  return { render, _add: () => openForm(), _delRes };
})();
