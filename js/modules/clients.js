// Module Clients
window.Clients = (function () {
  let searchQuery = '';

  function render(container) {
    const clients = filterClients(Store.state.clients);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">👥 Clients</h1>
          <p class="view-subtitle">${Store.state.clients.length} client${Store.state.clients.length > 1 ? 's' : ''} enregistré${Store.state.clients.length > 1 ? 's' : ''}</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="cliExcel">📊 Excel</button>
          <button class="btn btn--primary" id="cliAdd">+ Nouveau client</button>
        </div>
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="cliSearch" placeholder="🔍 Rechercher par nom, ville, email, téléphone..." value="${Helpers.esc(searchQuery)}">
      </div>

      ${clients.length === 0 ? UI.emptyState({
        icon: '👥',
        title: searchQuery ? 'Aucun résultat' : 'Aucun client',
        message: searchQuery ? 'Essayez une autre recherche.' : 'Commencez par créer votre premier client.',
        action: !searchQuery ? '<button class="btn btn--primary" onclick="Clients.openCreate()">+ Nouveau client</button>' : ''
      }) : `<div class="clients-grid">${clients.map(renderCard).join('')}</div>`}
    `;

    document.getElementById('cliAdd')?.addEventListener('click', () => openCreate());
    document.getElementById('cliExcel')?.addEventListener('click', () => window.ExcelExport?.clients());

    const search = document.getElementById('cliSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        searchQuery = search.value;
        render(container);
        document.getElementById('cliSearch')?.focus();
      }, 200));
    }

    container.querySelectorAll('[data-client-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openDetail(el.dataset.clientId);
      });
    });
  }

  function filterClients(list) {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(c =>
      (c.nom || '').toLowerCase().includes(q) ||
      (c.ville || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telephone || '').toLowerCase().includes(q) ||
      (c.adresse || '').toLowerCase().includes(q)
    );
  }

  function renderCard(client) {
    const chantiers = Store.state.chantiers.filter(c => c.clientId === client.id);
    const enCours = chantiers.filter(c => Helpers.computeStatus(c) === 'en-cours').length;

    return `
      <div class="client-card" data-client-id="${client.id}">
        <div class="client-card__top">
          ${UI.avatar(client.nom, 'lg')}
          <div class="client-card__info">
            <h3>${Helpers.esc(client.nom)}</h3>
            ${client.entreprise ? `<span class="client-card__org">${Helpers.esc(client.entreprise)}</span>` : ''}
            ${client.ville ? `<span class="client-card__city">📍 ${Helpers.esc(client.ville)}</span>` : ''}
          </div>
        </div>
        <div class="client-card__meta">
          ${client.telephone ? `<div>📞 ${Format.phone(client.telephone)}</div>` : ''}
          ${client.email ? `<div>✉ ${Helpers.esc(client.email)}</div>` : ''}
        </div>
        <div class="client-card__stats">
          <div><strong>${chantiers.length}</strong><span>chantier${chantiers.length > 1 ? 's' : ''}</span></div>
          ${enCours > 0 ? `<div class="client-stat-active"><strong>${enCours}</strong><span>en cours</span></div>` : ''}
        </div>
      </div>
    `;
  }

  function openCreate() { openForm(); }
  function openEdit(id) { openForm(id); }

  function openForm(clientId = null) {
    const existing = clientId ? Store.state.clients.find(c => c.id === clientId) : null;
    const c = existing || { nom: '', entreprise: '', email: '', telephone: '', adresse: '', ville: '', codePostal: '', notes: '' };

    Modal.open({
      title: existing ? 'Modifier le client' : 'Nouveau client',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom / Raison sociale *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(c.nom)}" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Entreprise (si différent)</label>
            <input id="f_entreprise" class="form-input" value="${Helpers.esc(c.entreprise || '')}">
          </div>
          <div class="form-field">
            <label>Téléphone</label>
            <input id="f_tel" class="form-input" value="${Helpers.esc(c.telephone || '')}">
          </div>
          <div class="form-field">
            <label>Email</label>
            <input id="f_email" class="form-input" type="email" value="${Helpers.esc(c.email || '')}">
          </div>
          <div class="form-field form-field--full">
            <label>Adresse</label>
            <input id="f_adresse" class="form-input" value="${Helpers.esc(c.adresse || '')}">
          </div>
          <div class="form-field">
            <label>Code postal</label>
            <input id="f_cp" class="form-input" value="${Helpers.esc(c.codePostal || '')}">
          </div>
          <div class="form-field">
            <label>Ville</label>
            <input id="f_ville" class="form-input" value="${Helpers.esc(c.ville || '')}">
          </div>
          <div class="form-field form-field--full">
            <label>Notes</label>
            <textarea id="f_notes" class="form-textarea" rows="3">${Helpers.esc(c.notes || '')}</textarea>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="cliSave">${existing ? 'Mettre à jour' : 'Créer le client'}</button>
      `,
      onOpen: () => {
        document.getElementById('cliSave').addEventListener('click', () => {
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            entreprise: document.getElementById('f_entreprise').value.trim(),
            telephone: document.getElementById('f_tel').value.trim(),
            email: document.getElementById('f_email').value.trim(),
            adresse: document.getElementById('f_adresse').value.trim(),
            codePostal: document.getElementById('f_cp').value.trim(),
            ville: document.getElementById('f_ville').value.trim(),
            notes: document.getElementById('f_notes').value.trim()
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }

          // Détection doublons
          if (!existing) {
            const dup = Store.state.clients.find(c =>
              c.nom.toLowerCase() === data.nom.toLowerCase() ||
              (data.telephone && c.telephone === data.telephone) ||
              (data.email && c.email && c.email.toLowerCase() === data.email.toLowerCase())
            );
            if (dup) {
              if (!confirm(`Un client similaire existe déjà : "${dup.nom}". Créer quand même ?`)) return;
            }
          }

          if (existing) {
            Store.updateClient(existing.id, data);
            Toast.success('Client mis à jour');
          } else {
            Store.addClient(data);
            Toast.success('Client créé');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openDetail(id) {
    const client = Store.state.clients.find(c => c.id === id);
    if (!client) return;
    const chantiers = Store.state.chantiers.filter(c => c.clientId === id)
      .sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));

    Modal.open({
      title: client.nom,
      size: 'large',
      body: `
        <div class="detail-grid">
          <div class="detail-section">
            <h3>Coordonnées</h3>
            <dl class="detail-list">
              ${client.entreprise ? `<dt>Entreprise</dt><dd>${Helpers.esc(client.entreprise)}</dd>` : ''}
              ${client.telephone ? `<dt>Téléphone</dt><dd>${Format.phone(client.telephone)}</dd>` : ''}
              ${client.email ? `<dt>Email</dt><dd><a href="mailto:${Helpers.esc(client.email)}">${Helpers.esc(client.email)}</a></dd>` : ''}
              ${client.adresse ? `<dt>Adresse</dt><dd>${Helpers.esc(client.adresse)}<br>${Helpers.esc(client.codePostal || '')} ${Helpers.esc(client.ville || '')}</dd>` : ''}
            </dl>
          </div>
          ${client.notes ? `<div class="detail-section"><h3>Notes</h3><p>${Helpers.esc(client.notes)}</p></div>` : ''}
          <div class="detail-section">
            <h3>Historique des chantiers (${chantiers.length})</h3>
            ${chantiers.length === 0 ? '<p class="hint">Aucun chantier pour ce client.</p>' :
              `<div class="chantiers-history">
                ${chantiers.map(ch => {
                  const status = Helpers.computeStatus(ch);
                  return `
                    <div class="history-item" data-chantier="${ch.id}">
                      <div class="history-num mono">${ch.numero}</div>
                      <div class="history-info">
                        <strong>${Helpers.esc(ch.titre)}</strong>
                        <span>${Format.dateRange(ch.dateDebut, ch.dateFin)}</span>
                      </div>
                      ${UI.statusBadge(status)}
                    </div>
                  `;
                }).join('')}
              </div>`
            }
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--danger" onclick="Clients._delete('${client.id}')">Supprimer</button>
        <button class="btn btn--ghost" onclick="Clients.openEdit('${client.id}'); Modal.close()">Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `,
      onOpen: () => {
        document.querySelectorAll('.history-item').forEach(el => {
          el.addEventListener('click', () => {
            Modal.close();
            window.Chantiers?.openDetail(el.dataset.chantier);
          });
        });
      }
    });
  }

  function _delete(id) {
    const chantiers = Store.state.chantiers.filter(c => c.clientId === id);
    if (chantiers.length > 0) {
      Toast.warning(`Impossible : ${chantiers.length} chantier(s) lié(s) à ce client.`);
      return;
    }
    Modal.confirm({
      title: 'Supprimer ce client ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteClient(id);
        Toast.success('Client supprimé');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  return { render, openCreate, openEdit, openDetail, _delete };
})();
