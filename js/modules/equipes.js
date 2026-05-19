// Module Equipes - camions/équipes avec chef + ouvriers + alternants
window.Equipes = (function () {

  function render(container) {
    const equipes = Store.state.equipes || [];
    const personnel = Store.state.personnel || [];

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">◈ Équipes</h1>
          <p class="view-subtitle">${equipes.length} équipe${equipes.length > 1 ? 's' : ''} — organisation des camions et du personnel</p>
        </div>
        <div class="view-header__actions">
          <a class="btn btn--ghost" href="#/personnel">👥 Gérer le personnel</a>
          <button class="btn btn--primary" id="eqAdd">+ Nouvelle équipe</button>
        </div>
      </div>

      ${personnel.length === 0 ? `
        <div class="alert alert--warning" style="margin-bottom:var(--s-4)">
          ⚠️ Aucune personne dans le personnel.
          <a href="#/personnel">Ajoutez d'abord vos chefs, ouvriers et alternants</a> avant de composer vos équipes.
        </div>
      ` : ''}

      ${equipes.length === 0 ? UI.emptyState({
        icon: '🚚',
        title: 'Aucune équipe',
        message: 'Créez votre première équipe pour organiser vos camions et le personnel.',
        action: '<button class="btn btn--primary" onclick="Equipes._add()">+ Nouvelle équipe</button>'
      }) : `
        <div class="equipes-grid">
          ${equipes.map(renderEquipeCard).join('')}
        </div>
      `}
    `;

    document.getElementById('eqAdd')?.addEventListener('click', () => openForm());

    container.querySelectorAll('[data-equipe-id]').forEach(card => {
      card.querySelector('[data-eq-edit]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openForm(card.dataset.equipeId);
      });
      card.querySelector('[data-eq-delete]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteEquipe(card.dataset.equipeId);
      });
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openDetail(card.dataset.equipeId);
      });
    });
  }

  function renderEquipeCard(eq) {
    const { chef, membres } = Store.getEquipeMembers(eq.id);
    const ouvriers = membres.filter(m => m.role === 'ouvrier');
    const alternants = membres.filter(m => m.role === 'alternant');
    const autresMembres = membres.filter(m => m.role !== 'ouvrier' && m.role !== 'alternant');

    // Chantiers actifs (en-cours ou prévus)
    const chantiers = Store.state.chantiers.filter(c => {
      if (c.equipeId !== eq.id) return false;
      const statut = Helpers.computeStatus(c);
      return statut !== 'termine';
    });

    return `
      <div class="equipe-card" data-equipe-id="${eq.id}" style="border-top:4px solid ${eq.couleur}">
        <div class="equipe-card__header">
          <div class="color-swatch-lg" style="background:${eq.couleur}"></div>
          <div>
            <h3>${Helpers.esc(eq.nom)}</h3>
            ${eq.specialite ? `<span class="hint">${Helpers.esc(eq.specialite)}</span>` : ''}
          </div>
        </div>

        <div class="equipe-card__meta">
          ${chef ? `
            <div class="equipe-section">
              <div class="equipe-section__title">🛠️ Chef d'équipe</div>
              <div class="equipe-member">
                ${UI.avatar([chef.prenom, chef.nom].filter(Boolean).join(' ') || chef.nom, 'sm', chef.couleur)}
                <span>${Helpers.esc([chef.prenom, chef.nom].filter(Boolean).join(' ') || chef.nom)}</span>
              </div>
            </div>
          ` : `
            <div class="equipe-section">
              <div class="equipe-section__title">🛠️ Chef d'équipe</div>
              <div class="hint" style="margin-left:var(--s-1)">Aucun chef défini</div>
            </div>
          `}

          ${ouvriers.length > 0 ? `
            <div class="equipe-section">
              <div class="equipe-section__title">👷 Ouvriers <span class="hint">(${ouvriers.length})</span></div>
              <div class="membres-list">
                ${ouvriers.map(o => `
                  <span class="membre-chip">
                    ${UI.avatar([o.prenom, o.nom].filter(Boolean).join(' ') || o.nom, 'xs', o.couleur)}
                    ${Helpers.esc(o.nom)}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${alternants.length > 0 ? `
            <div class="equipe-section">
              <div class="equipe-section__title">🎓 Alternants <span class="hint">(${alternants.length})</span></div>
              <div class="membres-list">
                ${alternants.map(a => `
                  <span class="membre-chip">
                    ${UI.avatar([a.prenom, a.nom].filter(Boolean).join(' ') || a.nom, 'xs', a.couleur)}
                    ${Helpers.esc(a.nom)}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${autresMembres.length > 0 ? `
            <div class="equipe-section">
              <div class="equipe-section__title">👥 Autres <span class="hint">(${autresMembres.length})</span></div>
              <div class="membres-list">
                ${autresMembres.map(m => `<span class="membre-chip">${Helpers.esc(m.nom)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${!chef && membres.length === 0 ? `
            <div class="hint" style="text-align:center;padding:var(--s-2)">
              Cliquez sur ✎ pour composer l'équipe
            </div>
          ` : ''}

          <div class="equipe-stats">
            <strong>${chantiers.length}</strong> chantier${chantiers.length > 1 ? 's' : ''} en cours/prévu${chantiers.length > 1 ? 's' : ''}
          </div>
        </div>

        <div class="equipe-card__actions">
          <button class="btn-icon" data-eq-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-eq-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function openForm(id = null) {
    const existing = id ? Store.state.equipes.find(e => e.id === id) : null;
    const e = existing || {
      nom: '', specialite: '', couleur: '#3b82f6',
      chefId: null, membresIds: []
    };
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const personnel = (Store.state.personnel || []).filter(p => p.actif !== false);
    const chefs = personnel.filter(p => p.role === 'chef' || p.role === 'conducteur');
    const ouvriers = personnel.filter(p => p.role === 'ouvrier');
    const alternants = personnel.filter(p => p.role === 'alternant');
    const autres = personnel.filter(p => !['chef', 'conducteur', 'ouvrier', 'alternant'].includes(p.role));

    Modal.open({
      title: existing ? 'Modifier l\'équipe' : 'Nouvelle équipe',
      size: 'large',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom de l'équipe / camion *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(e.nom)}" placeholder="Ex: Équipe Alpha, Camion 1..." autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Spécialité (optionnel)</label>
            <input id="f_spec" class="form-input" placeholder="Ex: Vitrage, Menuiserie..." value="${Helpers.esc(e.specialite || '')}">
          </div>

          <div class="form-field form-field--full">
            <label>Couleur (planning)</label>
            <div class="color-picker">
              ${colors.map(c => `
                <button type="button" class="color-swatch ${e.couleur === c ? 'is-active' : ''}"
                  data-color="${c}" style="background:${c}"></button>
              `).join('')}
            </div>
            <input type="hidden" id="f_couleur" value="${e.couleur}">
          </div>

          <div class="form-field form-field--full">
            <label>🛠️ Chef d'équipe (optionnel)</label>
            <select id="f_chef" class="form-select">
              <option value="">— Aucun chef —</option>
              ${chefs.map(c => {
                const fullName = [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom;
                return `<option value="${c.id}" ${e.chefId === c.id ? 'selected' : ''}>${Helpers.esc(fullName)}${c.role === 'conducteur' ? ' (conducteur)' : ''}</option>`;
              }).join('')}
            </select>
            <p class="hint" style="margin-top:4px">Pas de chef approprié ? <a href="#/personnel">Ajoutez-en un dans le personnel</a>.</p>
          </div>

          <div class="form-field form-field--full">
            <label>👥 Membres permanents de l'équipe</label>

            ${ouvriers.length > 0 ? `
              <div class="personnel-picker-section">
                <div class="personnel-picker-section__title">👷 Ouvriers</div>
                <div class="checkbox-list">
                  ${ouvriers.map(o => {
                    const fullName = [o.prenom, o.nom].filter(Boolean).join(' ') || o.nom;
                    return `
                      <label class="checkbox-row">
                        <input type="checkbox" data-member="${o.id}" ${(e.membresIds || []).includes(o.id) ? 'checked' : ''}>
                        ${UI.avatar(fullName, 'sm', o.couleur)}
                        <span>${Helpers.esc(fullName)}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            ${alternants.length > 0 ? `
              <div class="personnel-picker-section">
                <div class="personnel-picker-section__title">🎓 Alternants</div>
                <div class="checkbox-list">
                  ${alternants.map(a => {
                    const fullName = [a.prenom, a.nom].filter(Boolean).join(' ') || a.nom;
                    return `
                      <label class="checkbox-row">
                        <input type="checkbox" data-member="${a.id}" ${(e.membresIds || []).includes(a.id) ? 'checked' : ''}>
                        ${UI.avatar(fullName, 'sm', a.couleur)}
                        <span>${Helpers.esc(fullName)}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            ${autres.length > 0 ? `
              <div class="personnel-picker-section">
                <div class="personnel-picker-section__title">👥 Autres</div>
                <div class="checkbox-list">
                  ${autres.map(a => {
                    const fullName = [a.prenom, a.nom].filter(Boolean).join(' ') || a.nom;
                    return `
                      <label class="checkbox-row">
                        <input type="checkbox" data-member="${a.id}" ${(e.membresIds || []).includes(a.id) ? 'checked' : ''}>
                        ${UI.avatar(fullName, 'sm', a.couleur)}
                        <span>${Helpers.esc(fullName)}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            ${ouvriers.length === 0 && alternants.length === 0 && autres.length === 0 ? `
              <p class="hint">Aucun ouvrier ou alternant dans le personnel.
              <a href="#/personnel">Ajoutez-en</a> pour pouvoir composer l'équipe.</p>
            ` : ''}
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="eqSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.querySelectorAll('.color-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
            sw.classList.add('is-active');
            document.getElementById('f_couleur').value = sw.dataset.color;
          });
        });

        document.getElementById('eqSave').addEventListener('click', () => {
          const membresIds = Array.from(document.querySelectorAll('[data-member]:checked')).map(cb => cb.dataset.member);
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            specialite: document.getElementById('f_spec').value.trim(),
            couleur: document.getElementById('f_couleur').value,
            chefId: document.getElementById('f_chef').value || null,
            membresIds
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }

          if (existing) {
            Store.updateEquipe(existing.id, data);
            Toast.success('Équipe mise à jour');
          } else {
            Store.addEquipe(data);
            Toast.success('Équipe créée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openDetail(equipeId) {
    const eq = Store.state.equipes.find(e => e.id === equipeId);
    if (!eq) return;
    const { chef, membres } = Store.getEquipeMembers(equipeId);
    const chantiers = Store.state.chantiers.filter(c => c.equipeId === equipeId)
      .sort((a, b) => new Date(b.dateDebut || 0) - new Date(a.dateDebut || 0));

    Modal.open({
      title: `◈ ${eq.nom}`,
      size: 'large',
      body: `
        <div class="rdv-detail-header">
          <span class="badge" style="background:${eq.couleur}22;color:${eq.couleur}">${Helpers.esc(eq.nom)}</span>
          ${eq.specialite ? `<span class="badge badge--info">${Helpers.esc(eq.specialite)}</span>` : ''}
        </div>

        <div class="detail-section">
          <h3>👥 Composition de l'équipe</h3>
          ${chef ? `
            <div style="margin-bottom:var(--s-2)">
              <strong>🛠️ Chef d'équipe</strong>
              <div class="equipe-member" style="margin-top:4px">
                ${UI.avatar([chef.prenom, chef.nom].filter(Boolean).join(' ') || chef.nom, 'md', chef.couleur)}
                <div>
                  <strong>${Helpers.esc([chef.prenom, chef.nom].filter(Boolean).join(' ') || chef.nom)}</strong>
                  ${chef.telephone ? `<div class="hint">📞 ${Format.phone(chef.telephone)}</div>` : ''}
                </div>
              </div>
            </div>
          ` : '<p class="hint">Aucun chef d\'équipe défini</p>'}

          ${membres.length > 0 ? `
            <div>
              <strong>👥 Membres (${membres.length})</strong>
              <div class="membres-list" style="margin-top:4px">
                ${membres.map(m => {
                  const fullName = [m.prenom, m.nom].filter(Boolean).join(' ') || m.nom;
                  const roleIcon = { ouvrier: '👷', alternant: '🎓', chef: '🛠️' }[m.role] || '👤';
                  return `<span class="membre-chip">${roleIcon} ${Helpers.esc(fullName)}</span>`;
                }).join('')}
              </div>
            </div>
          ` : '<p class="hint">Aucun membre permanent</p>'}
        </div>

        ${chantiers.length > 0 ? `
          <div class="detail-section">
            <h3>🏗️ Chantiers (${chantiers.length})</h3>
            <div class="chantiers-history">
              ${chantiers.slice(0, 10).map(c => `
                <div class="history-item" data-chantier="${c.id}">
                  <span class="history-num mono">${Helpers.esc(c.numero)}</span>
                  <div class="history-info">
                    <strong>${Helpers.esc(c.titre)}</strong>
                    <span>${c.dateDebut ? Format.dateShort(c.dateDebut) + ' → ' + Format.dateShort(c.dateFin) : '—'}</span>
                  </div>
                  ${UI.statusBadge(Helpers.computeStatus(c))}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `,
      footer: `
        <button class="btn btn--danger" onclick="Equipes._delete('${eq.id}')">🗑 Supprimer</button>
        <button class="btn btn--ghost" onclick="Equipes._edit('${eq.id}')">✎ Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `,
      onOpen: () => {
        document.querySelectorAll('.history-item').forEach(el => {
          el.addEventListener('click', () => {
            Modal.close();
            window.Chantiers?.openDetail?.(el.dataset.chantier);
          });
        });
      }
    });
  }

  function _edit(id) {
    Modal.close();
    setTimeout(() => openForm(id), 100);
  }

  function _delete(id) {
    deleteEquipe(id);
  }

  function deleteEquipe(id) {
    const chantiersLies = Store.state.chantiers.filter(c => c.equipeId === id).length;
    Modal.confirm({
      title: 'Supprimer cette équipe ?',
      message: chantiersLies > 0
        ? `<strong>${chantiersLies} chantier(s)</strong> sont attribués à cette équipe. Ils se retrouveront sans équipe assignée.`
        : 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteEquipe(id);
        Toast.success('Équipe supprimée');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  return { render, openForm, openDetail, _add: () => openForm(), _edit, _delete };
})();
