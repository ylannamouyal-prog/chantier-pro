// Module Rendez-vous - création/édition/détail
window.RendezVous = (function () {

  const TYPES = {
    metre: { label: 'Métré', icon: '📐' },
    visite: { label: 'Visite client', icon: '👤' },
    devis: { label: 'Devis', icon: '📋' },
    livraison: { label: 'Livraison', icon: '🚚' },
    autre: { label: 'Autre', icon: '📅' }
  };

  function typeInfo(t) { return TYPES[t] || TYPES.autre; }

  function openForm(rdvId = null, prefillDate = null) {
    const existing = rdvId ? Store.state.rendezVous.find(r => r.id === rdvId) : null;
    const r = existing || {
      titre: '',
      type: 'visite',
      date: prefillDate || new Date().toISOString().split('T')[0],
      heureDebut: '09:00',
      heureFin: '10:00',
      conducteurId: '',
      clientId: '',
      adresse: '',
      telephone: '',
      notes: ''
    };

    Modal.open({
      title: existing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Titre *</label>
            <input id="rdv_titre" class="form-input" value="${Helpers.esc(r.titre)}" placeholder="Ex: Métré salon Mme Dupont" autofocus>
          </div>

          <div class="form-field">
            <label>Type *</label>
            <select id="rdv_type" class="form-select">
              ${Object.entries(TYPES).map(([k, v]) => `
                <option value="${k}" ${r.type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-field">
            <label>Date *</label>
            <input id="rdv_date" class="form-input" type="date" value="${r.date}">
          </div>

          <div class="form-field">
            <label>Heure de début *</label>
            <input id="rdv_heureDebut" class="form-input mono" type="time" value="${r.heureDebut}">
          </div>

          <div class="form-field">
            <label>Heure de fin *</label>
            <input id="rdv_heureFin" class="form-input mono" type="time" value="${r.heureFin}">
          </div>

          <div class="form-field form-field--full">
            <label>Conducteur *</label>
            <select id="rdv_conducteur" class="form-select">
              <option value="">— Choisir un conducteur —</option>
              ${Store.state.conducteurs.map(c => `
                <option value="${c.id}" ${r.conducteurId === c.id ? 'selected' : ''}>${Helpers.esc(c.nom)}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-field form-field--full">
            <label>Client (optionnel)</label>
            <select id="rdv_client" class="form-select">
              <option value="">— Aucun client —</option>
              ${Store.state.clients.map(c => `
                <option value="${c.id}" ${r.clientId === c.id ? 'selected' : ''}>${Helpers.esc(c.nom)}${c.ville ? ' — ' + Helpers.esc(c.ville) : ''}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-field form-field--full">
            <label>Adresse</label>
            <input id="rdv_adresse" class="form-input" value="${Helpers.esc(r.adresse || '')}" placeholder="Ex: 12 rue de la République, Lyon">
          </div>

          <div class="form-field form-field--full">
            <label>Téléphone du contact sur place</label>
            <input id="rdv_telephone" class="form-input" value="${Helpers.esc(r.telephone || '')}" placeholder="06 12 34 56 78">
          </div>

          <div class="form-field form-field--full">
            <label>Notes / Description</label>
            <textarea id="rdv_notes" class="form-textarea" rows="3" placeholder="Détails du rendez-vous...">${Helpers.esc(r.notes || '')}</textarea>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="rdvSave">${existing ? 'Mettre à jour' : 'Créer le rendez-vous'}</button>
      `,
      onOpen: () => {
        // Quand on choisit un client, pré-remplir l'adresse et le téléphone si vides
        document.getElementById('rdv_client')?.addEventListener('change', (e) => {
          const client = Store.state.clients.find(c => c.id === e.target.value);
          if (!client) return;
          const addrInput = document.getElementById('rdv_adresse');
          const telInput = document.getElementById('rdv_telephone');
          if (!addrInput.value.trim() && client.adresse) {
            const cityPart = [client.codePostal, client.ville].filter(Boolean).join(' ');
            addrInput.value = client.adresse + (cityPart ? ', ' + cityPart : '');
          }
          if (!telInput.value.trim() && client.telephone) {
            telInput.value = client.telephone;
          }
        });

        // Sauvegarder
        document.getElementById('rdvSave').addEventListener('click', () => {
          const data = {
            titre: document.getElementById('rdv_titre').value.trim(),
            type: document.getElementById('rdv_type').value,
            date: document.getElementById('rdv_date').value,
            heureDebut: document.getElementById('rdv_heureDebut').value,
            heureFin: document.getElementById('rdv_heureFin').value,
            conducteurId: document.getElementById('rdv_conducteur').value || null,
            clientId: document.getElementById('rdv_client').value || null,
            adresse: document.getElementById('rdv_adresse').value.trim(),
            telephone: document.getElementById('rdv_telephone').value.trim(),
            notes: document.getElementById('rdv_notes').value.trim()
          };

          // Validations
          if (!data.titre) { Toast.warning('Le titre est requis'); return; }
          if (!data.date) { Toast.warning('La date est requise'); return; }
          if (!data.heureDebut || !data.heureFin) { Toast.warning('Les heures sont requises'); return; }
          if (data.heureFin <= data.heureDebut) { Toast.warning('L\'heure de fin doit être après l\'heure de début'); return; }
          if (!data.conducteurId) { Toast.warning('Veuillez choisir un conducteur'); return; }

          if (existing) {
            Store.updateRdv(existing.id, data);
            Toast.success('Rendez-vous mis à jour');
          } else {
            Store.addRdv(data);
            Toast.success('Rendez-vous créé');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openDetail(id) {
    const r = Store.state.rendezVous.find(x => x.id === id);
    if (!r) return;
    const conducteur = Store.state.conducteurs.find(c => c.id === r.conducteurId);
    const client = r.clientId ? Store.state.clients.find(c => c.id === r.clientId) : null;
    const t = typeInfo(r.type);

    Modal.open({
      title: `${t.icon} ${r.titre}`,
      size: 'medium',
      body: `
        <div class="detail-section">
          <div class="rdv-detail-header">
            <span class="badge badge--info">${t.icon} ${t.label}</span>
            ${conducteur ? `<span class="motif-tag" style="background:${conducteur.couleur}20;color:${conducteur.couleur}">👤 ${Helpers.esc(conducteur.nom)}</span>` : ''}
          </div>

          <h3>📅 Quand</h3>
          <dl class="detail-list">
            <dt>Date</dt><dd><strong>${Format.dateShort(r.date)}</strong></dd>
            <dt>Horaires</dt><dd class="mono"><strong>${r.heureDebut}</strong> → <strong>${r.heureFin}</strong></dd>
          </dl>
        </div>

        ${(r.adresse || r.telephone) ? `
          <div class="detail-section">
            <h3>📍 Lieu & contact</h3>
            <dl class="detail-list">
              ${r.adresse ? `
                <dt>Adresse</dt>
                <dd class="copyable-field">
                  <span>${Helpers.esc(r.adresse)}</span>
                  <button class="btn-icon btn-icon--copy" data-copy="${Helpers.esc(r.adresse)}" title="Copier l'adresse">📋</button>
                </dd>
              ` : ''}
              ${r.telephone ? `
                <dt>Téléphone</dt>
                <dd class="copyable-field">
                  <a href="tel:${Helpers.esc(r.telephone)}">${Format.phone(r.telephone)}</a>
                  <button class="btn-icon btn-icon--copy" data-copy="${Helpers.esc(r.telephone)}" title="Copier le numéro">📋</button>
                </dd>
              ` : ''}
            </dl>
          </div>
        ` : ''}

        ${client ? `
          <div class="detail-section">
            <h3>👤 Client lié</h3>
            <dl class="detail-list">
              <dt>Nom</dt><dd><strong>${Helpers.esc(client.nom)}</strong></dd>
              ${client.entreprise ? `<dt>Entreprise</dt><dd>${Helpers.esc(client.entreprise)}</dd>` : ''}
            </dl>
          </div>
        ` : ''}

        ${r.notes ? `
          <div class="detail-section">
            <h3>📝 Notes</h3>
            <p style="white-space:pre-wrap;margin:0">${Helpers.esc(r.notes)}</p>
          </div>
        ` : ''}
      `,
      footer: `
        <button class="btn btn--danger" onclick="RendezVous._delete('${r.id}')">🗑 Supprimer</button>
        <button class="btn btn--ghost" onclick="RendezVous._edit('${r.id}')">✎ Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `,
      onOpen: () => {
        // Bind les boutons copier
        document.querySelectorAll('.btn-icon--copy').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.dataset.copy;
            navigator.clipboard.writeText(text).then(() => {
              Toast.success('Copié dans le presse-papier');
              btn.textContent = '✓';
              setTimeout(() => { btn.textContent = '📋'; }, 1500);
            }).catch(() => {
              Toast.error('Copie impossible');
            });
          });
        });
      }
    });
  }

  function _delete(id) {
    Modal.confirm({
      title: 'Supprimer ce rendez-vous ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteRdv(id);
        Toast.success('Rendez-vous supprimé');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  function _edit(id) {
    Modal.close();
    setTimeout(() => openForm(id), 100);
  }

  return { openForm, openDetail, _delete, _edit, TYPES, typeInfo };
})();
