// Module Cotes - prises de cotes par chantier, organisées en catégories d'ouvrages
window.Cotes = (function () {
  let currentChantierId = null;
  let listSearchQuery = '';
  let expandedCategories = new Set();
  let sortableInstances = [];

  // ============================================================
  // ENTRY POINT
  // ============================================================
  function render(container, chantierId) {
    currentChantierId = chantierId;

    if (!chantierId) return renderChantierPicker(container);

    const chantier = Store.state.chantiers.find(c => c.id === chantierId);
    if (!chantier) {
      container.innerHTML = UI.emptyState({
        icon: '📐',
        title: 'Chantier introuvable',
        message: 'Le chantier sélectionné n\'existe plus.',
        action: '<a class="btn btn--primary" href="#/cotes">← Voir tous les chantiers</a>'
      });
      return;
    }
    renderCategoriesForChantier(container, chantier);
  }

  // ============================================================
  // VUE 1 - SELECTION DU CHANTIER
  // ============================================================
  function renderChantierPicker(container) {
    const chantiers = filterChantiers(Store.state.chantiers);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📐 Prises de cotes</h1>
          <p class="view-subtitle">Sélectionnez un chantier pour saisir ou consulter ses cotes</p>
        </div>
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="cotesPickerSearch" placeholder="🔍 Rechercher un chantier..." value="${Helpers.esc(listSearchQuery)}">
      </div>

      ${chantiers.length === 0 ? UI.emptyState({
        icon: '📐',
        title: listSearchQuery ? 'Aucun résultat' : 'Aucun chantier',
        message: listSearchQuery ? 'Aucun chantier ne correspond à cette recherche.' : 'Créez d\'abord un chantier pour pouvoir saisir ses cotes.',
        action: !listSearchQuery ? '<a class="btn btn--primary" href="#/chantiers">→ Aller aux chantiers</a>' : ''
      }) : `
        <div class="chantiers-picker-grid">
          ${chantiers.map(renderPickerCard).join('')}
        </div>
      `}
    `;

    const search = document.getElementById('cotesPickerSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        listSearchQuery = search.value;
        renderChantierPicker(container);
        document.getElementById('cotesPickerSearch')?.focus();
      }, 200));
    }

    container.querySelectorAll('[data-pick-chantier]').forEach(card => {
      card.addEventListener('click', () => {
        location.hash = `#/cotes/${card.dataset.pickChantier}`;
      });
    });
  }

  function filterChantiers(list) {
    if (!listSearchQuery) return list;
    const q = listSearchQuery.toLowerCase();
    return list.filter(c => {
      const client = Store.state.clients.find(x => x.id === c.clientId);
      return (c.titre || '').toLowerCase().includes(q) ||
             (c.numero || '').toLowerCase().includes(q) ||
             (c.ville || '').toLowerCase().includes(q) ||
             (c.adresse || '').toLowerCase().includes(q) ||
             (client?.nom || '').toLowerCase().includes(q);
    });
  }

  function renderPickerCard(c) {
    const client = Store.state.clients.find(x => x.id === c.clientId);
    const cotesCount = Store.getCotesByChantier(c.id).length;
    const status = Helpers.computeStatus(c);

    return `
      <div class="chantier-picker-card" data-pick-chantier="${c.id}">
        <div class="chantier-picker-card__top">
          <div class="chantier-picker-card__num mono">${Helpers.esc(c.numero || '')}</div>
          ${UI.statusBadge(status)}
        </div>
        <h3 class="chantier-picker-card__title">${Helpers.esc(c.titre || 'Sans titre')}</h3>
        ${client ? `<div class="chantier-picker-card__client">👤 ${Helpers.esc(client.nom)}</div>` : ''}
        ${c.adresse || c.ville ? `<div class="chantier-picker-card__addr">📍 ${Helpers.esc([c.adresse, c.ville].filter(Boolean).join(', '))}</div>` : ''}
        <div class="chantier-picker-card__footer">
          <span class="chantier-picker-card__cotes">
            <strong>${cotesCount}</strong> cote${cotesCount > 1 ? 's' : ''}
          </span>
          <span class="chantier-picker-card__action">📐 Saisir →</span>
        </div>
      </div>
    `;
  }

  // ============================================================
  // VUE 2 - CATÉGORIES D'UN CHANTIER
  // ============================================================
  function renderCategoriesForChantier(container, chantier) {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    const categories = Store.getCategoriesByChantier(chantier.id);
    const allCotes = Store.getCotesByChantier(chantier.id);
    const totalSurface = allCotes.reduce(
      (s, c) => s + ((c.largeur || 0) * (c.hauteur || 0) * (c.quantite || 1)) / 1000000, 0
    );

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="breadcrumb">
            <a href="#/cotes">Prises de cotes</a> /
            <span>${Helpers.esc(chantier.numero || '')}</span>
          </div>
          <h1 class="view-title">📐 ${Helpers.esc(chantier.titre || 'Sans titre')}</h1>
          <p class="view-subtitle">
            ${categories.length} catégorie${categories.length > 1 ? 's' : ''} •
            ${allCotes.length} cote${allCotes.length > 1 ? 's' : ''} •
            ${totalSurface.toFixed(2)} m² au total
          </p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="cotesAddCategory">+ Nouvelle catégorie</button>
        </div>
      </div>

      ${categories.length === 0 ? UI.emptyState({
        icon: '📦',
        title: 'Aucune catégorie d\'ouvrage',
        message: 'Créez une catégorie (ex: "Vitrage", "Menuiserie") pour commencer à saisir vos cotes regroupées par type d\'ouvrage.',
        action: '<button class="btn btn--primary" onclick="Cotes._addCategory()">+ Créer une catégorie</button>'
      }) : `
        <div class="categories-cotes-list" id="categoriesCotesList">
          ${categories.map(cat => renderCategoryCard(cat)).join('')}
        </div>
      `}
    `;

    document.getElementById('cotesAddCategory')?.addEventListener('click', () => openCategoryForm());

    const list = document.getElementById('categoriesCotesList');
    if (list && typeof Sortable !== 'undefined' && categories.length > 1) {
      const s = Sortable.create(list, {
        handle: '.category-handle',
        animation: 200,
        ghostClass: 'category-ghost',
        onEnd: () => {
          const ids = Array.from(list.querySelectorAll('.category-card')).map(el => el.dataset.categoryId);
          Store.reorderCategoriesCotes(chantier.id, ids);
        }
      });
      sortableInstances.push(s);
    }

    container.querySelectorAll('.category-card').forEach(card => bindCategoryCardEvents(card));

    container.querySelectorAll('.cotes-list').forEach(cotesList => {
      if (typeof Sortable !== 'undefined' && cotesList.children.length > 1) {
        const s = Sortable.create(cotesList, {
          handle: '.cote-handle',
          animation: 200,
          ghostClass: 'cote-ghost',
          onEnd: () => {
            const ids = Array.from(cotesList.querySelectorAll('.cote-item')).map(el => el.dataset.id);
            Store.commit('cote:reorder-category', state => {
              ids.forEach((id, idx) => {
                const c = state.cotes.find(x => x.id === id);
                if (c) c.order = idx;
              });
            });
          }
        });
        sortableInstances.push(s);
      }
    });
  }

  function renderCategoryCard(cat) {
    const cotes = Store.getCotesByCategorie(cat.id);
    const totalSurface = cotes.reduce(
      (s, c) => s + ((c.largeur || 0) * (c.hauteur || 0) * (c.quantite || 1)) / 1000000, 0
    );
    const totalUnits = cotes.reduce((s, c) => s + (c.quantite || 1), 0);
    const isExpanded = expandedCategories.has(cat.id) || cotes.length === 0;

    return `
      <div class="category-card ${isExpanded ? 'category-card--open' : ''}" data-category-id="${cat.id}">
        <div class="category-card__header" data-toggle-category="${cat.id}">
          <span class="category-handle" title="Glisser pour réordonner">⋮⋮</span>
          <div class="category-card__info">
            <h2>${Helpers.esc(cat.nom || '(Sans nom)')}</h2>
            <div class="category-stats">
              <span><strong>${cotes.length}</strong> cote${cotes.length > 1 ? 's' : ''}</span>
              ${totalUnits !== cotes.length ? `<span><strong>${totalUnits}</strong> unité${totalUnits > 1 ? 's' : ''}</span>` : ''}
              <span><strong>${totalSurface.toFixed(2)}</strong> m²</span>
            </div>
          </div>
          <div class="category-card__actions">
            <button class="btn btn--ghost btn--sm" data-add-cote="${cat.id}">+ Cote</button>
            <button class="btn-icon" data-edit-category="${cat.id}" title="Renommer">✎</button>
            <button class="btn-icon btn-icon--danger" data-delete-category="${cat.id}" title="Supprimer">🗑</button>
            <button class="btn-icon category-toggle" data-toggle-category="${cat.id}" title="${isExpanded ? 'Replier' : 'Déplier'}">${isExpanded ? '▲' : '▼'}</button>
          </div>
        </div>

        <div class="category-card__body" ${isExpanded ? '' : 'hidden'}>
          ${cotes.length === 0 ? `
            <div class="category-empty">
              <p>Aucune cote dans cette catégorie pour le moment.</p>
              <button class="btn btn--primary btn--sm" data-add-cote="${cat.id}">+ Ajouter la première cote</button>
            </div>
          ` : `
            <div class="cotes-table-wrap">
              <div class="cotes-table-head">
                <div class="cote-handle-h"></div>
                <div>N°</div>
                <div>Emplacement</div>
                <div>Dimensions (L × H mm)</div>
                <div>Surface</div>
                <div>Type</div>
                <div></div>
              </div>
              <div class="cotes-list" data-category-cotes="${cat.id}">
                ${cotes.map((c, i) => renderCoteRow(c, i)).join('')}
              </div>
            </div>
          `}

          <div class="category-extras">
            <div class="category-extra-block category-extra-block--schema">
              <h4>✏️ Schéma</h4>
              <div class="schema-placeholder">
                ${cat.schema ? `
                  <img src="${cat.schema}" alt="Schéma" class="schema-preview">
                  <button class="btn btn--ghost btn--sm" data-open-schema="${cat.id}">✎ Modifier le schéma</button>
                ` : `
                  <p class="hint">Outil de dessin disponible dans la prochaine mise à jour. 🎨</p>
                  <button class="btn btn--ghost btn--sm" data-open-schema="${cat.id}" disabled>✏️ Dessiner (bientôt)</button>
                `}
              </div>
            </div>

            <div class="category-extra-block category-extra-block--photos">
              <h4>📸 Photos <span class="hint">(${(cat.photos || []).length}/5)</span></h4>
              <div class="photos-placeholder">
                ${(cat.photos || []).length > 0 ? `
                  <div class="photos-grid">
                    ${(cat.photos || []).map(p => `
                      <div class="photo-thumb"><img src="${p.dataUrl}" alt="${Helpers.esc(p.name || '')}"></div>
                    `).join('')}
                  </div>
                ` : ''}
                <p class="hint">Upload de photos disponible dans la prochaine mise à jour. 📷</p>
                <button class="btn btn--ghost btn--sm" data-open-photos="${cat.id}" disabled>📸 Ajouter des photos (bientôt)</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindCategoryCardEvents(card) {
    const catId = card.dataset.categoryId;

    card.querySelector('.category-card__header')?.addEventListener('click', (e) => {
      if (e.target.closest('button, .btn, .btn-icon')) return;
      toggleCategory(catId);
    });

    card.querySelector('.category-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory(catId);
    });

    card.querySelectorAll('[data-add-cote]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCoteForm(null, btn.dataset.addCote);
      });
    });

    card.querySelector('[data-edit-category]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryForm(catId);
    });

    card.querySelector('[data-delete-category]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(catId);
    });

    const cotesList = card.querySelector('.cotes-list');
    if (cotesList) {
      cotesList.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (!actionBtn) return;
        const coteItem = actionBtn.closest('.cote-item');
        if (!coteItem) return;
        const coteId = coteItem.dataset.id;
        const action = actionBtn.dataset.action;
        if (action === 'edit') openCoteForm(coteId);
        else if (action === 'delete') deleteCoteRow(coteId);
        else if (action === 'duplicate') duplicateCoteRow(coteId);
      });
    }
  }

  function toggleCategory(catId) {
    if (expandedCategories.has(catId)) {
      expandedCategories.delete(catId);
    } else {
      expandedCategories.add(catId);
    }
    if (window.Router) Router.refresh();
  }

  // ============================================================
  // CATÉGORIE - FORM
  // ============================================================
  function openCategoryForm(categoryId = null) {
    const existing = categoryId
      ? (Store.state.categoriesCotes || []).find(c => c.id === categoryId)
      : null;
    const cat = existing || { nom: '' };

    Modal.open({
      title: existing ? 'Renommer la catégorie' : 'Nouvelle catégorie d\'ouvrage',
      size: 'small',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom de la catégorie *</label>
            <input id="f_cat_nom" class="form-input" value="${Helpers.esc(cat.nom)}" placeholder="Ex: Vitrage, Menuiserie, Stores BSO..." autofocus>
            <p class="hint" style="margin-top:4px">Choisissez un nom qui décrit le type d'ouvrage à réaliser dans cette catégorie.</p>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="catSave">${existing ? 'Mettre à jour' : 'Créer la catégorie'}</button>
      `,
      onOpen: () => {
        const input = document.getElementById('f_cat_nom');
        input?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') document.getElementById('catSave')?.click();
        });
        document.getElementById('catSave').addEventListener('click', () => {
          const nom = document.getElementById('f_cat_nom').value.trim();
          if (!nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateCategorieCote(existing.id, { nom });
            Toast.success('Catégorie renommée');
          } else {
            const newCat = Store.addCategorieCote({ chantierId: currentChantierId, nom });
            expandedCategories.add(newCat.id);
            Toast.success('Catégorie créée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function deleteCategory(categoryId) {
    const cat = (Store.state.categoriesCotes || []).find(c => c.id === categoryId);
    if (!cat) return;
    const cotesCount = Store.getCotesByCategorie(categoryId).length;

    Modal.confirm({
      title: `Supprimer "${cat.nom}" ?`,
      message: cotesCount > 0
        ? `Cette catégorie contient <strong>${cotesCount} cote${cotesCount > 1 ? 's' : ''}</strong> qui seront aussi supprimées. Cette action est irréversible.`
        : 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteCategorieCote(categoryId);
        expandedCategories.delete(categoryId);
        Toast.success('Catégorie supprimée');
        if (window.Router) Router.refresh();
      }
    });
  }

  // ============================================================
  // COTE - FORM
  // ============================================================
  function renderCoteRow(cote, index) {
    const surface = ((cote.largeur || 0) * (cote.hauteur || 0)) / 1000000;
    return `
      <div class="cote-item" data-id="${cote.id}">
        <div class="cote-handle" title="Glisser pour réordonner">⋮⋮</div>
        <div class="cote-num">${String(index + 1).padStart(2, '0')}</div>
        <div class="cote-loc">
          <strong>${Helpers.esc(cote.emplacement || '—')}</strong>
          ${cote.notes ? `<span class="cote-notes">${Helpers.esc(cote.notes)}</span>` : ''}
        </div>
        <div class="cote-dim">
          <span class="mono">${Format.num(cote.largeur)} × ${Format.num(cote.hauteur)}</span>
        </div>
        <div class="cote-surface">
          <strong>${surface.toFixed(3)} m²</strong>
        </div>
        <div class="cote-type">
          ${cote.type ? `<span class="badge badge--info">${Helpers.esc(cote.type)}</span>` : ''}
          ${cote.quantite > 1 ? `<span class="cote-qte">× ${cote.quantite}</span>` : ''}
        </div>
        <div class="cote-actions">
          <button class="btn-icon" data-action="duplicate" title="Dupliquer">⎘</button>
          <button class="btn-icon" data-action="edit" title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-action="delete" title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function openCoteForm(coteId = null, categorieId = null) {
    const existing = coteId ? Store.state.cotes.find(c => c.id === coteId) : null;
    const c = existing || {
      emplacement: '',
      largeur: '',
      hauteur: '',
      quantite: 1,
      type: 'Vitrage',
      notes: '',
      categorieId
    };

    Modal.open({
      title: existing ? 'Modifier la cote' : 'Nouvelle cote',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Emplacement *</label>
            <input id="f_emplacement" class="form-input" placeholder="Ex: Fenêtre salon - mur sud" value="${Helpers.esc(c.emplacement)}" autofocus>
          </div>
          <div class="form-field">
            <label>Largeur (mm) *</label>
            <input id="f_largeur" class="form-input mono" type="number" min="1" placeholder="1200" value="${c.largeur}">
          </div>
          <div class="form-field">
            <label>Hauteur (mm) *</label>
            <input id="f_hauteur" class="form-input mono" type="number" min="1" placeholder="1800" value="${c.hauteur}">
          </div>
          <div class="form-field">
            <label>Quantité</label>
            <input id="f_quantite" class="form-input" type="number" min="1" value="${c.quantite || 1}">
          </div>
          <div class="form-field">
            <label>Type d'ouvrage</label>
            <select id="f_type" class="form-select">
              ${['Vitrage', 'Double vitrage', 'Triple vitrage', 'Store BSO', 'Store intérieur', 'Menuiserie', 'Porte', 'Autre']
                .map(t => `<option value="${t}" ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Notes</label>
            <textarea id="f_notes" class="form-textarea" rows="2" placeholder="Précisions, contraintes...">${Helpers.esc(c.notes || '')}</textarea>
          </div>
          <div class="form-field form-field--full">
            <div class="calc-preview" id="calcPreview">
              <span>Surface unitaire :</span>
              <strong id="calcSurface">— m²</strong>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="coteSave">${existing ? 'Mettre à jour' : 'Enregistrer'}</button>
      `,
      onOpen: () => {
        const update = () => {
          const l = parseFloat(document.getElementById('f_largeur').value) || 0;
          const h = parseFloat(document.getElementById('f_hauteur').value) || 0;
          const s = (l * h) / 1000000;
          document.getElementById('calcSurface').textContent = s > 0 ? s.toFixed(3) + ' m²' : '— m²';
        };
        ['f_largeur', 'f_hauteur'].forEach(id => document.getElementById(id)?.addEventListener('input', update));
        update();

        document.getElementById('coteSave').addEventListener('click', () => {
          const data = {
            chantierId: currentChantierId,
            categorieId: c.categorieId || categorieId,
            emplacement: document.getElementById('f_emplacement').value.trim(),
            largeur: parseFloat(document.getElementById('f_largeur').value) || 0,
            hauteur: parseFloat(document.getElementById('f_hauteur').value) || 0,
            quantite: parseInt(document.getElementById('f_quantite').value) || 1,
            type: document.getElementById('f_type').value,
            notes: document.getElementById('f_notes').value.trim()
          };
          if (!data.emplacement || !data.largeur || !data.hauteur) {
            Toast.warning('Emplacement, largeur et hauteur sont requis');
            return;
          }
          if (existing) {
            Store.updateCote(existing.id, data);
            Toast.success('Cote mise à jour');
          } else {
            Store.addCote(data);
            if (data.categorieId) expandedCategories.add(data.categorieId);
            Toast.success('Cote ajoutée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function deleteCoteRow(id) {
    Modal.confirm({
      title: 'Supprimer cette cote ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteCote(id);
        Toast.success('Cote supprimée');
        if (window.Router) Router.refresh();
      }
    });
  }

  function duplicateCoteRow(id) {
    const c = Store.state.cotes.find(c => c.id === id);
    if (!c) return;
    const copy = { ...c };
    delete copy.id;
    delete copy.order;
    delete copy.createdAt;
    copy.emplacement = c.emplacement + ' (copie)';
    Store.addCote(copy);
    Toast.success('Cote dupliquée');
    if (window.Router) Router.refresh();
  }

  return {
    render,
    openForm: openCoteForm,
    _addCategory: () => openCategoryForm()
  };
})();
