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
    const nbContacts = (client.contacts || []).length;

    return `
      <div class="client-card" data-client-id="${client.id}">
        <div class="client-card__top">
          ${UI.avatar(client.nom, 'lg')}
          <div class="client-card__info">
            <h3>${Helpers.esc(client.nom)}</h3>
            ${client.role ? `<span class="hint">${Helpers.esc(client.role)}</span>` : ''}
            ${client.entreprise ? `<span class="client-card__org">${Helpers.esc(client.entreprise)}</span>` : ''}
            ${client.ville ? `<span class="client-card__city">📍 ${Helpers.esc(client.ville)}</span>` : ''}
          </div>
        </div>
        <div class="client-card__meta">
          ${client.telephone ? `<div>📞 ${Format.phone(client.telephone)}</div>` : ''}
          ${client.email ? `<div>✉ ${Helpers.esc(client.email)}</div>` : ''}
          ${nbContacts > 0 ? `<div title="${nbContacts} contact${nbContacts > 1 ? 's' : ''} supplémentaire${nbContacts > 1 ? 's' : ''}">👥 +${nbContacts} contact${nbContacts > 1 ? 's' : ''}</div>` : ''}
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
    const c = existing || { nom: '', entreprise: '', email: '', telephone: '', adresse: '', ville: '', codePostal: '', notes: '', role: '', contacts: [] };
    // Copie locale des contacts pour édition
    let workingContacts = JSON.parse(JSON.stringify(c.contacts || []));

    Modal.open({
      title: existing ? 'Modifier le client' : 'Nouveau client',
      size: 'large',
      body: `
        <div class="form-section-title">📋 Informations générales</div>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom / Raison sociale *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(c.nom)}" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Entreprise (si différent)</label>
            <input id="f_entreprise" class="form-input" value="${Helpers.esc(c.entreprise || '')}">
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
        </div>

        <div class="form-section-title" style="margin-top:var(--s-4)">⭐ Contact principal</div>
        <div class="form-grid">
          <div class="form-field">
            <label>Nom du contact</label>
            <input id="f_contactNom" class="form-input" value="${Helpers.esc(c.nom || '')}" placeholder="Ex: M. Dupont">
            <p class="hint" style="margin-top:4px">Par défaut identique au nom client (modifiable)</p>
          </div>
          <div class="form-field">
            <label>Rôle / Fonction</label>
            <input id="f_role" class="form-input" value="${Helpers.esc(c.role || '')}" placeholder="Ex: Directeur, Comptable...">
          </div>
          <div class="form-field">
            <label>Téléphone</label>
            <input id="f_tel" class="form-input" value="${Helpers.esc(c.telephone || '')}">
          </div>
          <div class="form-field">
            <label>Email</label>
            <input id="f_email" class="form-input" type="email" value="${Helpers.esc(c.email || '')}">
          </div>
        </div>

        <div class="form-section-title" style="margin-top:var(--s-4)">
          👥 Autres contacts <span class="hint" id="contactsCount">(${workingContacts.length})</span>
        </div>
        <div id="otherContactsList" class="other-contacts-list">
          ${renderContactsEditList(workingContacts)}
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="addContactBtn" style="margin-top:var(--s-2)">+ Ajouter un contact</button>

        <div class="form-section-title" style="margin-top:var(--s-4)">📝 Notes</div>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <textarea id="f_notes" class="form-textarea" rows="3">${Helpers.esc(c.notes || '')}</textarea>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="cliSave">${existing ? 'Mettre à jour' : 'Créer le client'}</button>
      `,
      onOpen: () => {
        // Pré-remplir le nom du contact avec le nom client si vide
        const nomInput = document.getElementById('f_nom');
        const contactNomInput = document.getElementById('f_contactNom');
        nomInput?.addEventListener('input', () => {
          if (!contactNomInput.value || contactNomInput.value === c.nom) {
            contactNomInput.value = nomInput.value;
          }
        });

        // Ajouter un contact
        document.getElementById('addContactBtn').addEventListener('click', () => {
          workingContacts.push({
            id: 'tmp_' + Date.now(),
            nom: '', role: '', telephone: '', email: '', afficherPdf: false
          });
          refreshContactsList();
        });

        bindContactsListEvents();

        function refreshContactsList() {
          const list = document.getElementById('otherContactsList');
          list.innerHTML = renderContactsEditList(workingContacts);
          document.getElementById('contactsCount').textContent = `(${workingContacts.length})`;
          bindContactsListEvents();
        }

        function bindContactsListEvents() {
          document.querySelectorAll('.contact-edit-row').forEach((row, idx) => {
            // Mise à jour des champs
            ['nom', 'role', 'telephone', 'email'].forEach(field => {
              const input = row.querySelector(`[data-field="${field}"]`);
              input?.addEventListener('input', () => {
                workingContacts[idx][field] = input.value;
              });
            });
            const cbPdf = row.querySelector('[data-field="afficherPdf"]');
            cbPdf?.addEventListener('change', () => {
              workingContacts[idx].afficherPdf = cbPdf.checked;
            });
            row.querySelector('[data-remove-contact]')?.addEventListener('click', () => {
              workingContacts.splice(idx, 1);
              refreshContactsList();
            });
          });
        }

        document.getElementById('cliSave').addEventListener('click', () => {
          // On utilise le nom du contact principal s'il est différent du nom client
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            entreprise: document.getElementById('f_entreprise').value.trim(),
            telephone: document.getElementById('f_tel').value.trim(),
            email: document.getElementById('f_email').value.trim(),
            role: document.getElementById('f_role').value.trim(),
            adresse: document.getElementById('f_adresse').value.trim(),
            codePostal: document.getElementById('f_cp').value.trim(),
            ville: document.getElementById('f_ville').value.trim(),
            notes: document.getElementById('f_notes').value.trim(),
            contacts: workingContacts
              .filter(ct => (ct.nom || ct.telephone || ct.email).trim ? (ct.nom || ct.telephone || ct.email).trim() : (ct.nom || ct.telephone || ct.email))
              .map(ct => ({
                id: ct.id && !ct.id.startsWith('tmp_') ? ct.id : ('ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
                nom: (ct.nom || '').trim(),
                role: (ct.role || '').trim(),
                telephone: (ct.telephone || '').trim(),
                email: (ct.email || '').trim(),
                afficherPdf: !!ct.afficherPdf
              }))
          };

          if (!data.nom) { Toast.warning('Le nom est requis'); return; }

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

  function renderContactsEditList(contacts) {
    if (contacts.length === 0) {
      return `<p class="hint" style="margin:var(--s-2) 0">Aucun contact secondaire. Cliquez sur "+ Ajouter un contact" pour en ajouter.</p>`;
    }
    return contacts.map((ct, i) => `
      <div class="contact-edit-row" data-contact-index="${i}">
        <div class="contact-edit-row__header">
          <span class="contact-edit-row__num">${i + 1}</span>
          <button type="button" class="btn-icon btn-icon--danger" data-remove-contact title="Supprimer">🗑</button>
        </div>
        <div class="contact-edit-row__fields">
          <input class="form-input" placeholder="Nom du contact" data-field="nom" value="${Helpers.esc(ct.nom || '')}">
          <input class="form-input" placeholder="Rôle (ex: Comptable)" data-field="role" value="${Helpers.esc(ct.role || '')}">
          <input class="form-input" placeholder="Téléphone" data-field="telephone" value="${Helpers.esc(ct.telephone || '')}">
          <input class="form-input" placeholder="Email" type="email" data-field="email" value="${Helpers.esc(ct.email || '')}">
        </div>
        <label class="contact-edit-row__pdf">
          <input type="checkbox" data-field="afficherPdf" ${ct.afficherPdf ? 'checked' : ''}>
          <span>📄 Afficher ce contact dans le PDF des chantiers</span>
        </label>
      </div>
    `).join('');
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
            <h3>⭐ Contact principal</h3>
            <div class="contact-block contact-block--principal">
              <div class="contact-block__head">
                <div>
                  <strong>${Helpers.esc(client.nom || '—')}</strong>
                  ${client.role ? `<span class="badge badge--info">${Helpers.esc(client.role)}</span>` : ''}
                </div>
              </div>
              <dl class="detail-list">
                ${client.entreprise ? `<dt>Entreprise</dt><dd>${Helpers.esc(client.entreprise)}</dd>` : ''}
                ${client.telephone ? `
                  <dt>Téléphone</dt>
                  <dd>
                    <div class="copy-line">
                      <span class="mono">${Format.phone(client.telephone)}</span>
                      <button class="btn-icon btn-icon--copy" data-copy-text="${Helpers.esc(client.telephone)}" data-copy-label="Téléphone" title="Copier">📋</button>
                      <a href="tel:${Helpers.esc(client.telephone)}" class="btn-icon" title="Appeler">📞</a>
                    </div>
                  </dd>
                ` : ''}
                ${client.email ? `
                  <dt>Email</dt>
                  <dd>
                    <div class="copy-line">
                      <span>${Helpers.esc(client.email)}</span>
                      <button class="btn-icon btn-icon--copy" data-copy-text="${Helpers.esc(client.email)}" data-copy-label="Email" title="Copier">📋</button>
                      <a href="mailto:${Helpers.esc(client.email)}" class="btn-icon" title="Envoyer un email">✉</a>
                    </div>
                  </dd>
                ` : ''}
                ${client.adresse ? `<dt>Adresse</dt><dd>${Helpers.esc(client.adresse)}<br>${Helpers.esc(client.codePostal || '')} ${Helpers.esc(client.ville || '')}</dd>` : ''}
              </dl>
            </div>
          </div>

          ${(client.contacts && client.contacts.length > 0) ? `
            <div class="detail-section">
              <h3>👥 Autres contacts <span class="hint">(${client.contacts.length})</span></h3>
              <div class="other-contacts-display">
                ${client.contacts.map(ct => renderContactBlock(ct, client.id)).join('')}
              </div>
            </div>
          ` : ''}

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

        // Boutons copier
        document.querySelectorAll('.btn-icon--copy').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const text = btn.dataset.copyText;
            const label = btn.dataset.copyLabel || 'Texte';
            if (!text) return;
            navigator.clipboard?.writeText(text).then(() => {
              Toast.success(`${label} copié`);
              btn.textContent = '✓';
              btn.classList.add('btn-icon--copied');
              setTimeout(() => {
                btn.textContent = '📋';
                btn.classList.remove('btn-icon--copied');
              }, 1500);
            });
          });
        });

        // Bouton "Définir comme principal"
        document.querySelectorAll('[data-promote-contact]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ctId = btn.dataset.promoteContact;
            Modal.confirm({
              title: 'Définir comme contact principal ?',
              message: 'Le contact principal actuel sera déplacé dans la liste des autres contacts.',
              onConfirm: () => {
                Store.promoteContactToPrincipal(client.id, ctId);
                Toast.success('Contact principal mis à jour');
                Modal.close();
                setTimeout(() => openDetail(client.id), 100);
              }
            });
          });
        });

        // Bouton supprimer contact
        document.querySelectorAll('[data-delete-contact]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ctId = btn.dataset.deleteContact;
            Modal.confirm({
              title: 'Supprimer ce contact ?',
              message: 'Cette action est irréversible.',
              danger: true,
              onConfirm: () => {
                Store.deleteContactFromClient(client.id, ctId);
                Toast.success('Contact supprimé');
                Modal.close();
                setTimeout(() => openDetail(client.id), 100);
              }
            });
          });
        });
      }
    });
  }

  function renderContactBlock(ct, clientId) {
    return `
      <div class="contact-block">
        <div class="contact-block__head">
          <div>
            <strong>${Helpers.esc(ct.nom || '(Sans nom)')}</strong>
            ${ct.role ? `<span class="badge badge--info">${Helpers.esc(ct.role)}</span>` : ''}
            ${ct.afficherPdf ? `<span class="badge" title="Sera inclus dans le PDF des chantiers">📄 PDF</span>` : ''}
          </div>
          <div class="contact-block__actions">
            <button class="btn-icon" data-promote-contact="${ct.id}" title="Définir comme contact principal">⭐</button>
            <button class="btn-icon btn-icon--danger" data-delete-contact="${ct.id}" title="Supprimer">🗑</button>
          </div>
        </div>
        ${(ct.telephone || ct.email) ? `
          <dl class="detail-list detail-list--compact">
            ${ct.telephone ? `
              <dt>📞</dt>
              <dd>
                <div class="copy-line">
                  <span class="mono">${Format.phone(ct.telephone)}</span>
                  <button class="btn-icon btn-icon--copy" data-copy-text="${Helpers.esc(ct.telephone)}" data-copy-label="Téléphone" title="Copier">📋</button>
                  <a href="tel:${Helpers.esc(ct.telephone)}" class="btn-icon" title="Appeler">📞</a>
                </div>
              </dd>
            ` : ''}
            ${ct.email ? `
              <dt>✉</dt>
              <dd>
                <div class="copy-line">
                  <span>${Helpers.esc(ct.email)}</span>
                  <button class="btn-icon btn-icon--copy" data-copy-text="${Helpers.esc(ct.email)}" data-copy-label="Email" title="Copier">📋</button>
                  <a href="mailto:${Helpers.esc(ct.email)}" class="btn-icon" title="Envoyer un email">✉</a>
                </div>
              </dd>
            ` : ''}
          </dl>
        ` : ''}
      </div>
    `;
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
