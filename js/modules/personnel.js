// Module Personnel - gestion du personnel (conducteurs, chefs, ouvriers, alternants)
window.Personnel = (function () {

  let filterRole = 'all';
  let searchQuery = '';

  const ROLES = {
    conducteur: { label: 'Conducteur', icon: '👤', color: '#3b82f6' },
    chef:       { label: 'Chef d\'équipe', icon: '🛠️', color: '#f59e0b' },
    ouvrier:    { label: 'Ouvrier', icon: '👷', color: '#64748b' },
    alternant:  { label: 'Alternant', icon: '🎓', color: '#8b5cf6' },
    autre:      { label: 'Autre', icon: '👥', color: '#94a3b8' }
  };

  function getRoleInfo(role) {
    return ROLES[role] || ROLES.autre;
  }

  function render(container) {
    const all = Store.state.personnel || [];
    const filtered = filterPersonnel(all);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">👥 Personnel</h1>
          <p class="view-subtitle">${all.length} personne${all.length > 1 ? 's' : ''} dans l'entreprise</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="persAdd">+ Nouvelle personne</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${filterRole === 'all' ? 'tab--active' : ''}" data-role="all">Tous (${all.length})</button>
        ${Object.entries(ROLES).map(([key, info]) => {
          const count = all.filter(p => p.role === key).length;
          return `<button class="tab ${filterRole === key ? 'tab--active' : ''}" data-role="${key}">${info.icon} ${info.label} (${count})</button>`;
        }).join('')}
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="persSearch" placeholder="🔍 Rechercher (nom, téléphone, email...)" value="${Helpers.esc(searchQuery)}">
      </div>

      ${filtered.length === 0 ? UI.emptyState({
        icon: '👥',
        title: searchQuery || filterRole !== 'all' ? 'Aucun résultat' : 'Aucune personne',
        message: searchQuery || filterRole !== 'all' ? 'Aucun résultat pour ces filtres.' : 'Ajoutez votre première personne.',
        action: !searchQuery && filterRole === 'all' ? '<button class="btn btn--primary" onclick="Personnel._add()">+ Nouvelle personne</button>' : ''
      }) : `
        <div class="personnel-grid">
          ${filtered.map(renderCard).join('')}
        </div>
      `}
    `;

    document.getElementById('persAdd')?.addEventListener('click', () => openForm());

    container.querySelectorAll('[data-role]').forEach(tab => {
      tab.addEventListener('click', () => {
        filterRole = tab.dataset.role;
        render(container);
      });
    });

    const search = document.getElementById('persSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        searchQuery = search.value;
        render(container);
        document.getElementById('persSearch')?.focus();
      }, 200));
    }

    container.querySelectorAll('[data-pers-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openDetail(card.dataset.persId);
      });
      card.querySelector('[data-pers-edit]')?.addEventListener('click', () => openForm(card.dataset.persId));
      card.querySelector('[data-pers-delete]')?.addEventListener('click', () => deletePersonnel(card.dataset.persId));
    });
  }

  function filterPersonnel(list) {
    let r = list;
    if (filterRole !== 'all') r = r.filter(p => p.role === filterRole);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter(p =>
        (p.nom || '').toLowerCase().includes(q) ||
        (p.prenom || '').toLowerCase().includes(q) ||
        (p.telephone || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    }
    return r.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }

  function renderCard(p) {
    const role = getRoleInfo(p.role);
    const equipes = (p.equipeIds || [])
      .map(eqId => Store.state.equipes.find(e => e.id === eqId))
      .filter(Boolean);
    const fullName = [p.prenom, p.nom].filter(Boolean).join(' ');

    // Absences en cours ou à venir (30 prochains jours)
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const absencesProches = (Store.state.absences || []).filter(a => {
      if (a.personnelId !== p.id) return false;
      const fin = new Date(a.dateFin);
      return fin >= now;
    }).sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));

    const enAbsence = absencesProches.find(a => {
      const debut = new Date(a.dateDebut);
      const fin = new Date(a.dateFin);
      return debut <= now && fin >= now;
    });

    return `
      <div class="personnel-card" data-pers-id="${p.id}" style="border-left:4px solid ${p.couleur || role.color}">
        <div class="personnel-card__top">
          ${UI.avatar(fullName || p.nom, 'lg', p.couleur || role.color)}
          <div class="personnel-card__info">
            <h3>${Helpers.esc(fullName || p.nom || 'Sans nom')}</h3>
            <span class="personnel-role-badge" style="background:${role.color}22;color:${role.color}">
              ${role.icon} ${role.label}
            </span>
          </div>
        </div>

        ${enAbsence ? `
          <div class="personnel-status personnel-status--absent">
            ${Store.getTypeAbsence(enAbsence.typeId).icon}
            <span>En ${Store.getTypeAbsence(enAbsence.typeId).label.toLowerCase()} jusqu'au ${Format.dateShort(enAbsence.dateFin)}</span>
          </div>
        ` : ''}

        <div class="personnel-card__meta">
          ${p.telephone ? `<div>📞 ${Format.phone(p.telephone)}</div>` : ''}
          ${p.email ? `<div>✉ ${Helpers.esc(p.email)}</div>` : ''}
          ${equipes.length > 0 ? `
            <div>
              👥 ${equipes.map(eq => `<span class="badge" style="background:${eq.couleur}22;color:${eq.couleur}">${Helpers.esc(eq.nom)}</span>`).join(' ')}
            </div>
          ` : ''}
        </div>

        ${absencesProches.length > 0 && !enAbsence ? `
          <div class="personnel-status personnel-status--upcoming">
            📅 Prochaine absence : ${Format.dateShort(absencesProches[0].dateDebut)}
          </div>
        ` : ''}

        <div class="personnel-card__actions">
          <button class="btn-icon" data-pers-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-pers-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function openForm(persId = null) {
    const existing = persId ? Store.state.personnel.find(p => p.id === persId) : null;
    const p = existing || {
      nom: '', prenom: '', role: 'ouvrier',
      couleur: '#3b82f6', telephone: '', email: '',
      equipeIds: [], actif: true
    };

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'];

    Modal.open({
      title: existing ? `Modifier ${p.nom}` : 'Nouvelle personne',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field">
            <label>Prénom</label>
            <input id="f_prenom" class="form-input" value="${Helpers.esc(p.prenom || '')}" placeholder="Marc">
          </div>
          <div class="form-field">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(p.nom || '')}" placeholder="Dupont" autofocus>
          </div>

          <div class="form-field form-field--full">
            <label>Rôle *</label>
            <select id="f_role" class="form-select">
              ${Object.entries(ROLES).map(([key, info]) => `
                <option value="${key}" ${p.role === key ? 'selected' : ''}>${info.icon} ${info.label}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-field">
            <label>Téléphone</label>
            <input id="f_telephone" class="form-input" value="${Helpers.esc(p.telephone || '')}" placeholder="06 12 34 56 78">
          </div>
          <div class="form-field">
            <label>Email</label>
            <input id="f_email" class="form-input" type="email" value="${Helpers.esc(p.email || '')}" placeholder="marc.dupont@exemple.fr">
          </div>

          <div class="form-field form-field--full">
            <label>Couleur (planning)</label>
            <div class="color-picker">
              ${colors.map(c => `
                <button type="button" class="color-swatch ${p.couleur === c ? 'is-active' : ''}"
                  data-color="${c}" style="background:${c}"></button>
              `).join('')}
            </div>
            <input type="hidden" id="f_couleur" value="${p.couleur}">
          </div>

          ${Store.state.equipes && Store.state.equipes.length > 0 ? `
            <div class="form-field form-field--full">
              <label>Équipes</label>
              <div class="checkbox-list">
                ${Store.state.equipes.map(eq => `
                  <label class="checkbox-row">
                    <input type="checkbox" data-equipe="${eq.id}" ${(p.equipeIds || []).includes(eq.id) ? 'checked' : ''}>
                    <span class="color-dot" style="background:${eq.couleur}"></span>
                    <span>${Helpers.esc(eq.nom)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="form-field form-field--full">
            <label class="checkbox-row">
              <input type="checkbox" id="f_actif" ${p.actif !== false ? 'checked' : ''}>
              <span>Personne active (décochez si départ/inactif)</span>
            </label>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="persSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        // Color picker
        document.querySelectorAll('.color-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
            sw.classList.add('is-active');
            document.getElementById('f_couleur').value = sw.dataset.color;
          });
        });

        document.getElementById('persSave').addEventListener('click', () => {
          const equipeIds = Array.from(document.querySelectorAll('[data-equipe]:checked')).map(cb => cb.dataset.equipe);
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            prenom: document.getElementById('f_prenom').value.trim(),
            role: document.getElementById('f_role').value,
            couleur: document.getElementById('f_couleur').value,
            telephone: document.getElementById('f_telephone').value.trim(),
            email: document.getElementById('f_email').value.trim(),
            equipeIds,
            actif: document.getElementById('f_actif').checked
          };

          if (!data.nom) { Toast.warning('Le nom est requis'); return; }

          if (existing) {
            Store.updatePersonnel(existing.id, data);
            Toast.success('Personne mise à jour');
          } else {
            Store.addPersonnel(data);
            Toast.success('Personne ajoutée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openDetail(persId) {
    const p = Store.state.personnel.find(x => x.id === persId);
    if (!p) return;
    const role = getRoleInfo(p.role);
    const equipes = (p.equipeIds || [])
      .map(eqId => Store.state.equipes.find(e => e.id === eqId))
      .filter(Boolean);

    // Absences passées et futures (hors école, qui a sa propre section)
    const allAbsences = (Store.state.absences || [])
      .filter(a => a.personnelId === p.id && a.typeId !== 'ecole')
      .sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));

    // Périodes d'école (pour les alternants)
    const isAlternant = p.role === 'alternant';
    const periodesEcole = Store.getPeriodesEcole ? Store.getPeriodesEcole(p.id) : [];

    // Chantiers liés (en tant que conducteur)
    const chantiers = Store.state.chantiers.filter(c =>
      c.conducteurId === p.id || c.conducteurId === p._legacyConducteurId
    );

    const fullName = [p.prenom, p.nom].filter(Boolean).join(' ');

    Modal.open({
      title: fullName || p.nom,
      size: 'large',
      body: `
        <div class="detail-section">
          <div class="rdv-detail-header">
            <span class="badge" style="background:${role.color}22;color:${role.color}">${role.icon} ${role.label}</span>
            ${p.actif === false ? '<span class="badge badge--danger">Inactif</span>' : ''}
          </div>

          <h3>Informations</h3>
          <dl class="detail-list">
            ${p.telephone ? `
              <dt>Téléphone</dt>
              <dd>
                <div class="copy-line">
                  <span class="mono">${Format.phone(p.telephone)}</span>
                  <button class="btn-icon btn-icon--copy" data-copy-text="${Helpers.esc(p.telephone)}" data-copy-label="Téléphone" title="Copier">📋</button>
                  <a href="tel:${Helpers.esc(p.telephone)}" class="btn-icon" title="Appeler">📞</a>
                </div>
              </dd>
            ` : ''}
            ${p.email ? `
              <dt>Email</dt>
              <dd>
                <div class="copy-line">
                  <span>${Helpers.esc(p.email)}</span>
                  <button class="btn-icon btn-icon--copy" data-copy-text="${Helpers.esc(p.email)}" data-copy-label="Email" title="Copier">📋</button>
                  <a href="mailto:${Helpers.esc(p.email)}" class="btn-icon" title="Envoyer un email">✉</a>
                </div>
              </dd>
            ` : ''}
            ${equipes.length > 0 ? `
              <dt>Équipes</dt>
              <dd>${equipes.map(eq => `<span class="badge" style="background:${eq.couleur}22;color:${eq.couleur}">${Helpers.esc(eq.nom)}</span>`).join(' ')}</dd>
            ` : ''}
          </dl>
        </div>

        ${isAlternant ? `
          <div class="detail-section">
            <div class="ecole-section-head">
              <h3>🎓 Périodes à l'école <span class="hint">(${periodesEcole.length})</span></h3>
              <button class="btn btn--ghost btn--sm" id="addEcoleBtn">+ Ajouter une période</button>
            </div>
            ${periodesEcole.length === 0 ? '<p class="hint">Aucune période d\'école enregistrée. Ajoutez les dates où l\'alternant est en cours.</p>' : `
              <div class="ecole-list">
                ${periodesEcole.map(a => {
                  const now = new Date(); now.setHours(0,0,0,0);
                  const debut = new Date(a.dateDebut);
                  const fin = new Date(a.dateFin);
                  const status = now < debut ? 'À venir' : now > fin ? 'Terminée' : 'En cours';
                  const statusClass = now < debut ? 'info' : now > fin ? 'default' : 'warning';
                  return `
                    <div class="ecole-row" data-ecole-id="${a.id}">
                      <span class="ecole-row__icon">🎓</span>
                      <div class="ecole-row__info">
                        <strong>${Format.dateShort(a.dateDebut)} → ${Format.dateShort(a.dateFin)}</strong>
                        ${a.notes ? `<span class="hint">${Helpers.esc(a.notes)}</span>` : ''}
                      </div>
                      <span class="badge badge--${statusClass}">${status}</span>
                      <button class="btn-icon btn-icon--danger" data-del-ecole="${a.id}" title="Supprimer">🗑</button>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        ` : ''}

        <div class="detail-section">
          <h3>🌴 Absences <span class="hint">(${allAbsences.length})</span></h3>
          ${allAbsences.length === 0 ? '<p class="hint">Aucune absence enregistrée.</p>' : `
            <div class="absences-mini-list">
              ${allAbsences.slice(0, 10).map(a => {
                const type = Store.getTypeAbsence(a.typeId);
                const now = new Date();
                const debut = new Date(a.dateDebut);
                const fin = new Date(a.dateFin);
                const status = now < debut ? 'À venir' : now > fin ? 'Terminée' : 'En cours';
                const statusClass = now < debut ? 'info' : now > fin ? '' : 'warning';
                return `
                  <div class="absence-mini-row">
                    <span class="absence-mini-icon" style="background:${type.couleur}22;color:${type.couleur}">${type.icon}</span>
                    <div class="absence-mini-info">
                      <strong>${type.label}</strong>
                      <span>${Format.dateShort(a.dateDebut)} → ${Format.dateShort(a.dateFin)}</span>
                    </div>
                    <span class="badge badge--${statusClass || 'default'}">${status}</span>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        ${chantiers.length > 0 ? `
          <div class="detail-section">
            <h3>🏗️ Chantiers attribués (${chantiers.length})</h3>
            <div class="chantiers-history">
              ${chantiers.slice(0, 5).map(c => `
                <div class="history-item" data-chantier="${c.id}">
                  <span class="history-num mono">${Helpers.esc(c.numero)}</span>
                  <div class="history-info">
                    <strong>${Helpers.esc(c.titre)}</strong>
                    <span>${Format.dateRange ? Format.dateRange(c.dateDebut, c.dateFin) : c.dateDebut + ' → ' + c.dateFin}</span>
                  </div>
                  ${UI.statusBadge(Helpers.computeStatus(c))}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `,
      footer: `
        <button class="btn btn--danger" onclick="Personnel._delete('${p.id}')">🗑 Supprimer</button>
        <button class="btn btn--ghost" onclick="Personnel._edit('${p.id}')">✎ Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `,
      onOpen: () => {
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
        document.querySelectorAll('.history-item').forEach(el => {
          el.addEventListener('click', () => {
            Modal.close();
            window.Chantiers?.openDetail?.(el.dataset.chantier);
          });
        });

        // Boutons périodes école
        document.getElementById('addEcoleBtn')?.addEventListener('click', () => {
          _openEcoleForm(p.id);
        });
        document.querySelectorAll('[data-del-ecole]').forEach(btn => {
          btn.addEventListener('click', () => {
            const ecoleId = btn.dataset.delEcole;
            Modal.confirm({
              title: 'Supprimer cette période ?',
              message: 'Cette période à l\'école sera retirée du planning.',
              danger: true,
              onConfirm: () => {
                Store.deleteAbsence(ecoleId);
                Toast.success('Période supprimée');
                Modal.close();
                setTimeout(() => openDetail(p.id), 100);
              }
            });
          });
        });
      }
    });
  }

  // Formulaire d'ajout d'une période d'école
  function _openEcoleForm(personnelId) {
    const today = new Date().toISOString().split('T')[0];
    Modal.open({
      title: '🎓 Nouvelle période à l\'école',
      size: 'small',
      body: `
        <div class="form-grid">
          <div class="form-field">
            <label>Date de début *</label>
            <input id="ec_debut" class="form-input" type="date" value="${today}">
          </div>
          <div class="form-field">
            <label>Date de fin *</label>
            <input id="ec_fin" class="form-input" type="date" value="${today}">
          </div>
          <div class="form-field form-field--full">
            <label>Notes (optionnel)</label>
            <input id="ec_notes" class="form-input" placeholder="Ex: Semaine de cours, examens...">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="ecSave">Ajouter</button>
      `,
      onOpen: () => {
        document.getElementById('ecSave').addEventListener('click', () => {
          const debut = document.getElementById('ec_debut').value;
          const fin = document.getElementById('ec_fin').value;
          const notes = document.getElementById('ec_notes').value.trim();
          if (!debut || !fin) { Toast.warning('Les dates sont requises'); return; }
          if (debut > fin) { Toast.warning('La date de fin doit être après le début'); return; }
          Store.addPeriodeEcole(personnelId, debut, fin, notes);
          Toast.success('Période à l\'école ajoutée');
          Modal.close();
          setTimeout(() => openDetail(personnelId), 100);
        });
      }
    });
  }

  function _edit(id) {
    Modal.close();
    setTimeout(() => openForm(id), 100);
  }

  function _delete(id) {
    const p = Store.state.personnel.find(x => x.id === id);
    if (!p) return;
    const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;

    Modal.confirm({
      title: `Supprimer ${fullName} ?`,
      message: 'Cette action est irréversible. Les absences associées seront également supprimées.',
      danger: true,
      onConfirm: () => {
        Store.deletePersonnel(id);
        Toast.success('Personne supprimée');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  function deletePersonnel(id) { _delete(id); }

  return {
    render,
    openForm,
    openDetail,
    getRoleInfo,
    ROLES,
    _add: () => openForm(),
    _edit,
    _delete
  };
})();
