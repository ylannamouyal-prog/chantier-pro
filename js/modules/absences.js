// Module Absences - gestion des congés / maladie / etc.
window.Absences = (function () {

  function openForm(absenceId = null, prefill = null) {
    const existing = absenceId ? Store.state.absences.find(a => a.id === absenceId) : null;
    const a = existing || prefill || {
      personnelId: '',
      typeId: 'conges',
      dateDebut: new Date().toISOString().split('T')[0],
      dateFin: new Date().toISOString().split('T')[0],
      notes: ''
    };

    const personnel = (Store.state.personnel || []).filter(p => p.actif !== false);
    const types = Store.getTypesAbsence();

    Modal.open({
      title: existing ? 'Modifier l\'absence' : 'Nouvelle absence',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Personne concernée *</label>
            <select id="f_personnel" class="form-select">
              <option value="">— Choisir une personne —</option>
              ${personnel.map(p => {
                const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;
                const role = Personnel.ROLES[p.role] || Personnel.ROLES.autre;
                return `<option value="${p.id}" ${a.personnelId === p.id ? 'selected' : ''}>${role.icon} ${Helpers.esc(fullName)} (${role.label})</option>`;
              }).join('')}
            </select>
            ${personnel.length === 0 ? '<p class="hint" style="margin-top:4px;color:#ef4444">Aucune personne dans le personnel. <a href="#/personnel">Ajoutez-en une d\'abord</a>.</p>' : ''}
          </div>

          <div class="form-field form-field--full">
            <label>Type d'absence *</label>
            <div class="absence-types-grid">
              ${types.map(t => `
                <label class="absence-type-option ${a.typeId === t.id ? 'is-selected' : ''}" style="--type-color:${t.couleur}">
                  <input type="radio" name="f_typeId" value="${t.id}" ${a.typeId === t.id ? 'checked' : ''}>
                  <span class="absence-type-icon">${t.icon}</span>
                  <span class="absence-type-label">${Helpers.esc(t.label)}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-field">
            <label>Date de début *</label>
            <input id="f_dateDebut" class="form-input" type="date" value="${a.dateDebut}">
          </div>
          <div class="form-field">
            <label>Date de fin *</label>
            <input id="f_dateFin" class="form-input" type="date" value="${a.dateFin}">
          </div>

          <div class="form-field form-field--full">
            <label>Notes (optionnel)</label>
            <textarea id="f_notes" class="form-textarea" rows="2" placeholder="Précisions...">${Helpers.esc(a.notes || '')}</textarea>
          </div>

          <div class="form-field form-field--full">
            <div id="absenceConflictAlert"></div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="absSave">${existing ? 'Mettre à jour' : 'Créer l\'absence'}</button>
      `,
      onOpen: () => {
        // Options de type cliquables
        document.querySelectorAll('.absence-type-option').forEach(opt => {
          opt.addEventListener('click', () => {
            document.querySelectorAll('.absence-type-option').forEach(o => o.classList.remove('is-selected'));
            opt.classList.add('is-selected');
            opt.querySelector('input').checked = true;
          });
        });

        // Vérification des conflits chantier au changement
        const checkConflicts = () => {
          const personnelId = document.getElementById('f_personnel').value;
          const dateDebut = document.getElementById('f_dateDebut').value;
          const dateFin = document.getElementById('f_dateFin').value;
          const alert = document.getElementById('absenceConflictAlert');
          if (!personnelId || !dateDebut || !dateFin) { alert.innerHTML = ''; return; }

          // Trouver les chantiers attribués à cette personne durant la période
          const d1 = new Date(dateDebut);
          const d2 = new Date(dateFin);
          const personnel = Store.state.personnel.find(p => p.id === personnelId);
          if (!personnel) return;

          const conflits = Store.state.chantiers.filter(c => {
            if (c.conducteurId !== personnel.id && c.conducteurId !== personnel._legacyConducteurId) return false;
            if (!c.dateDebut || !c.dateFin) return false;
            const cd = new Date(c.dateDebut);
            const cf = new Date(c.dateFin);
            return cd <= d2 && cf >= d1;
          });

          if (conflits.length > 0) {
            alert.innerHTML = `<div class="alert alert--warning">
              ⚠️ <strong>${conflits.length} chantier(s) attribué(s)</strong> à cette personne durant cette période :
              <ul>${conflits.map(c => `<li>${Helpers.esc(c.numero)} — ${Helpers.esc(c.titre)} (${Format.dateShort(c.dateDebut)} → ${Format.dateShort(c.dateFin)})</li>`).join('')}</ul>
              <p style="margin:6px 0 0">Pensez à réattribuer ces chantiers à quelqu'un d'autre.</p>
            </div>`;
          } else {
            alert.innerHTML = '';
          }
        };
        document.getElementById('f_personnel')?.addEventListener('change', checkConflicts);
        document.getElementById('f_dateDebut')?.addEventListener('change', checkConflicts);
        document.getElementById('f_dateFin')?.addEventListener('change', checkConflicts);
        checkConflicts();

        document.getElementById('absSave').addEventListener('click', () => {
          const data = {
            personnelId: document.getElementById('f_personnel').value,
            typeId: document.querySelector('input[name="f_typeId"]:checked')?.value || 'conges',
            dateDebut: document.getElementById('f_dateDebut').value,
            dateFin: document.getElementById('f_dateFin').value,
            notes: document.getElementById('f_notes').value.trim()
          };

          if (!data.personnelId) { Toast.warning('Choisissez une personne'); return; }
          if (!data.dateDebut || !data.dateFin) { Toast.warning('Dates requises'); return; }
          if (new Date(data.dateFin) < new Date(data.dateDebut)) {
            Toast.warning('La date de fin doit être après la date de début'); return;
          }

          if (existing) {
            Store.updateAbsence(existing.id, data);
            Toast.success('Absence mise à jour');
          } else {
            Store.addAbsence(data);
            Toast.success('Absence enregistrée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openDetail(id) {
    const a = Store.state.absences.find(x => x.id === id);
    if (!a) return;
    const p = Store.state.personnel.find(x => x.id === a.personnelId);
    const type = Store.getTypeAbsence(a.typeId);
    const fullName = p ? ([p.prenom, p.nom].filter(Boolean).join(' ') || p.nom) : 'Personne inconnue';

    Modal.open({
      title: `${type.icon} ${type.label}`,
      size: 'small',
      body: `
        <div class="detail-section">
          <dl class="detail-list">
            <dt>Personne</dt>
            <dd><strong>${Helpers.esc(fullName)}</strong></dd>
            <dt>Type</dt>
            <dd><span class="badge" style="background:${type.couleur}22;color:${type.couleur}">${type.icon} ${type.label}</span></dd>
            <dt>Période</dt>
            <dd>${Format.dateShort(a.dateDebut)} → ${Format.dateShort(a.dateFin)}</dd>
            ${a.notes ? `<dt>Notes</dt><dd>${Helpers.esc(a.notes)}</dd>` : ''}
          </dl>
        </div>
      `,
      footer: `
        <button class="btn btn--danger" onclick="Absences._delete('${a.id}')">🗑 Supprimer</button>
        <button class="btn btn--ghost" onclick="Absences._edit('${a.id}')">✎ Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `
    });
  }

  function _edit(id) {
    Modal.close();
    setTimeout(() => openForm(id), 100);
  }

  function _delete(id) {
    Modal.confirm({
      title: 'Supprimer cette absence ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteAbsence(id);
        Toast.success('Absence supprimée');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  return { openForm, openDetail, _edit, _delete };
})();
