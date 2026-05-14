// Module Engins - matériel et réservations
window.Engins = (function () {
  function render(container) {
    const engins = Store.state.engins || [];

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">🚜 Engins & Locations</h1>
          <p class="view-subtitle">${engins.length} engin${engins.length > 1 ? 's' : ''} — détection automatique des conflits</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="engReserv">📅 Toutes réservations</button>
          <button class="btn btn--primary" id="engAdd">+ Nouvel engin</button>
        </div>
      </div>

      ${engins.length === 0 ? UI.emptyState({
        icon: '🚜', title: 'Aucun engin',
        message: 'Ajoutez vos engins (nacelles, échafaudages, camions...).',
        action: '<button class="btn btn--primary" onclick="Engins._add()">+ Nouvel engin</button>'
      }) : `<div class="engins-grid">${engins.map(renderCard).join('')}</div>`}
    `;

    document.getElementById('engAdd')?.addEventListener('click', () => openForm());
    document.getElementById('engReserv')?.addEventListener('click', openAllReservations);

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
    const e = existing || { nom: '', type: '', modele: '', proprietaire: '', icone: '🚜', coutJournalier: 0 };

    Modal.open({
      title: existing ? 'Modifier l\'engin' : 'Nouvel engin',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field">
            <label>Icône</label>
            <select id="f_icone" class="form-select">
              ${['🚜', '🚛', '🏗️', '🪜', '🛠️', '🔧', '⚙️'].map(i =>
                `<option value="${i}" ${e.icone === i ? 'selected' : ''}>${i}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(e.nom)}" autofocus>
          </div>
          <div class="form-field">
            <label>Type</label>
            <select id="f_type" class="form-select">
              ${['', 'Nacelle', 'Échafaudage', 'Camion grue', 'Chariot', 'Outillage', 'Autre']
                .map(t => `<option value="${t}" ${e.type === t ? 'selected' : ''}>${t || '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Modèle</label>
            <input id="f_modele" class="form-input" value="${Helpers.esc(e.modele || '')}">
          </div>
          <div class="form-field">
            <label>Propriétaire / Loueur</label>
            <input id="f_prop" class="form-input" value="${Helpers.esc(e.proprietaire || '')}">
          </div>
          <div class="form-field">
            <label>Coût journalier (€)</label>
            <input id="f_cout" class="form-input mono" type="number" step="0.01" min="0" value="${e.coutJournalier || 0}">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="eSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.getElementById('eSave').addEventListener('click', () => {
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            type: document.getElementById('f_type').value,
            modele: document.getElementById('f_modele').value.trim(),
            proprietaire: document.getElementById('f_prop').value.trim(),
            icone: document.getElementById('f_icone').value,
            coutJournalier: parseFloat(document.getElementById('f_cout').value) || 0
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
            ${engin.type ? `<dt>Type</dt><dd>${Helpers.esc(engin.type)}</dd>` : ''}
            ${engin.modele ? `<dt>Modèle</dt><dd>${Helpers.esc(engin.modele)}</dd>` : ''}
            ${engin.proprietaire ? `<dt>Propriétaire</dt><dd>${Helpers.esc(engin.proprietaire)}</dd>` : ''}
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

  return { render, _add: () => openForm(), _delRes };
})();
