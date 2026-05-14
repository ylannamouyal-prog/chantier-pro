// Module Equipes & Conducteurs
window.Equipes = (function () {
  function render(container) {
    const equipes = Store.state.equipes || [];
    const conducteurs = Store.state.conducteurs || [];

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">👷 Équipes & Conducteurs</h1>
          <p class="view-subtitle">${equipes.length} équipe${equipes.length > 1 ? 's' : ''} • ${conducteurs.length} conducteur${conducteurs.length > 1 ? 's' : ''}</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="eqAddCond">+ Conducteur</button>
          <button class="btn btn--primary" id="eqAdd">+ Nouvelle équipe</button>
        </div>
      </div>

      <h2 class="section-title">Équipes</h2>
      ${equipes.length === 0 ? UI.emptyState({ icon: '👷', title: 'Aucune équipe', message: 'Créez votre première équipe.' }) :
        `<div class="equipes-grid">${equipes.map(renderEquipeCard).join('')}</div>`
      }

      <h2 class="section-title" style="margin-top:var(--sp-8)">Conducteurs de travaux</h2>
      ${conducteurs.length === 0 ? UI.emptyState({ icon: '👤', title: 'Aucun conducteur', message: 'Ajoutez vos conducteurs.' }) :
        `<div class="conducteurs-grid">${conducteurs.map(renderConducteurCard).join('')}</div>`
      }
    `;

    document.getElementById('eqAdd')?.addEventListener('click', () => openEquipeForm());
    document.getElementById('eqAddCond')?.addEventListener('click', () => openConducteurForm());

    container.querySelectorAll('[data-equipe-id]').forEach(card => {
      card.querySelector('[data-eq-edit]')?.addEventListener('click', () => openEquipeForm(card.dataset.equipeId));
      card.querySelector('[data-eq-delete]')?.addEventListener('click', () => deleteEquipe(card.dataset.equipeId));
    });
    container.querySelectorAll('[data-conducteur-id]').forEach(card => {
      card.querySelector('[data-cd-edit]')?.addEventListener('click', () => openConducteurForm(card.dataset.conducteurId));
      card.querySelector('[data-cd-delete]')?.addEventListener('click', () => deleteConducteur(card.dataset.conducteurId));
    });
  }

  function renderEquipeCard(eq) {
    const chantiers = Store.state.chantiers.filter(c => c.equipeId === eq.id && Helpers.computeStatus(c) !== 'termine');
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
          ${eq.membres && eq.membres.length > 0 ? `
            <div class="equipe-membres">
              <strong>Membres :</strong>
              <div class="membres-list">
                ${eq.membres.map(m => `<span class="membre-chip">${Helpers.esc(m)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          <div class="equipe-stats">
            <div><strong>${chantiers.length}</strong> chantier${chantiers.length > 1 ? 's' : ''} actif${chantiers.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="equipe-card__actions">
          <button class="btn-icon" data-eq-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-eq-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function renderConducteurCard(c) {
    const chantiers = Store.state.chantiers.filter(ch => ch.conducteurId === c.id && Helpers.computeStatus(ch) !== 'termine');
    return `
      <div class="conducteur-card" data-conducteur-id="${c.id}">
        ${UI.avatar(c.nom, 'lg', c.couleur)}
        <div class="conducteur-info">
          <h3>${Helpers.esc(c.nom)}</h3>
          ${c.telephone ? `<div class="hint">📞 ${Format.phone(c.telephone)}</div>` : ''}
          ${c.email ? `<div class="hint">✉ ${Helpers.esc(c.email)}</div>` : ''}
          <div class="conducteur-stats">${chantiers.length} chantier${chantiers.length > 1 ? 's' : ''} en cours</div>
        </div>
        <div class="conducteur-actions">
          <button class="btn-icon" data-cd-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-cd-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function openEquipeForm(id = null) {
    const existing = id ? Store.state.equipes.find(e => e.id === id) : null;
    const e = existing || { nom: '', specialite: '', couleur: '#3b82f6', membres: [] };
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    Modal.open({
      title: existing ? 'Modifier l\'équipe' : 'Nouvelle équipe',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(e.nom)}" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Spécialité</label>
            <input id="f_spec" class="form-input" placeholder="Ex: Vitrage, Menuiserie..." value="${Helpers.esc(e.specialite || '')}">
          </div>
          <div class="form-field form-field--full">
            <label>Couleur</label>
            <div class="color-picker">
              ${colors.map(c => `
                <button type="button" class="color-swatch ${e.couleur === c ? 'is-active' : ''}"
                  data-color="${c}" style="background:${c}"></button>
              `).join('')}
            </div>
            <input type="hidden" id="f_couleur" value="${e.couleur}">
          </div>
          <div class="form-field form-field--full">
            <label>Membres (un par ligne)</label>
            <textarea id="f_membres" class="form-textarea" rows="4">${(e.membres || []).join('\n')}</textarea>
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
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            specialite: document.getElementById('f_spec').value.trim(),
            couleur: document.getElementById('f_couleur').value,
            membres: document.getElementById('f_membres').value.split('\n').map(s => s.trim()).filter(Boolean)
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

  function openConducteurForm(id = null) {
    const existing = id ? Store.state.conducteurs.find(c => c.id === id) : null;
    const c = existing || { nom: '', telephone: '', email: '', couleur: '#3b82f6' };
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    Modal.open({
      title: existing ? 'Modifier le conducteur' : 'Nouveau conducteur',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(c.nom)}" autofocus>
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
            <label>Couleur (planning)</label>
            <div class="color-picker">
              ${colors.map(col => `
                <button type="button" class="color-swatch ${c.couleur === col ? 'is-active' : ''}"
                  data-color="${col}" style="background:${col}"></button>
              `).join('')}
            </div>
            <input type="hidden" id="f_couleur" value="${c.couleur}">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="cdSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.querySelectorAll('.color-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
            sw.classList.add('is-active');
            document.getElementById('f_couleur').value = sw.dataset.color;
          });
        });
        document.getElementById('cdSave').addEventListener('click', () => {
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            telephone: document.getElementById('f_tel').value.trim(),
            email: document.getElementById('f_email').value.trim(),
            couleur: document.getElementById('f_couleur').value
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateConducteur(existing.id, data);
            Toast.success('Conducteur mis à jour');
          } else {
            Store.addConducteur(data);
            Toast.success('Conducteur créé');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function deleteEquipe(id) {
    const used = Store.state.chantiers.filter(c => c.equipeId === id).length;
    if (used > 0) { Toast.warning(`${used} chantier(s) utilisent cette équipe.`); return; }
    Modal.confirm({
      title: 'Supprimer cette équipe ?', danger: true,
      onConfirm: () => {
        Store.deleteEquipe(id);
        Toast.success('Équipe supprimée');
        if (window.Router) Router.refresh();
      }
    });
  }

  function deleteConducteur(id) {
    const used = Store.state.chantiers.filter(c => c.conducteurId === id).length;
    if (used > 0) { Toast.warning(`${used} chantier(s) utilisent ce conducteur.`); return; }
    Modal.confirm({
      title: 'Supprimer ce conducteur ?', danger: true,
      onConfirm: () => {
        Store.deleteConducteur(id);
        Toast.success('Conducteur supprimé');
        if (window.Router) Router.refresh();
      }
    });
  }

  return { render };
})();
