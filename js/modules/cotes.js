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

    // Ordre d'affichage logique des statuts
    const STATUT_ORDER = ['en-attente-cotes', 'en-attente-devis', 'commande', 'prevu', 'en-cours', 'reporte', 'termine'];
    const STATUT_ICONS = {
      'en-attente-cotes': '📏',
      'en-attente-devis': '📝',
      'commande': '📦',
      'prevu': '📅',
      'en-cours': '🚧',
      'reporte': '⏸️',
      'termine': '✅'
    };

    // Regroupe les chantiers par statut
    const groupes = {};
    chantiers.forEach(c => {
      const st = Helpers.computeStatus(c);
      if (!groupes[st]) groupes[st] = [];
      groupes[st].push(c);
    });

    // Construit les sections dans l'ordre défini (+ statuts inconnus à la fin)
    const statutsPresents = [
      ...STATUT_ORDER.filter(s => groupes[s]),
      ...Object.keys(groupes).filter(s => !STATUT_ORDER.includes(s))
    ];

    const sectionsHtml = statutsPresents.map(st => `
      <div class="cotes-statut-group">
        <div class="cotes-statut-group__head">
          <span class="cotes-statut-group__icon">${STATUT_ICONS[st] || '📁'}</span>
          <h2 class="cotes-statut-group__title">${Helpers.statusLabel(st)}</h2>
          <span class="cotes-statut-group__count">${groupes[st].length}</span>
        </div>
        <div class="chantiers-picker-grid">
          ${groupes[st].map(renderPickerCard).join('')}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📐 Prises de cotes</h1>
          <p class="view-subtitle">Sélectionnez un chantier pour saisir ou consulter ses cotes</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="cotesTourneeBtn">🚗 Optimiser une tournée</button>
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
      }) : sectionsHtml}
    `;

    document.getElementById('cotesTourneeBtn')?.addEventListener('click', () => openTourneeDialog());

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

        <div class="cotes-footer">
          <div class="cotes-footer__info">
            <span class="cotes-footer__icon">✓</span>
            Tout est sauvegardé automatiquement
          </div>
          <button class="btn btn--primary btn--lg" id="cotesFinish">
            ✓ Enregistrer et fermer
          </button>
        </div>
      `}
    `;

    document.getElementById('cotesAddCategory')?.addEventListener('click', () => openCategoryForm());

    // Bouton "Enregistrer et fermer" → retour à la liste des chantiers
    document.getElementById('cotesFinish')?.addEventListener('click', () => {
      Toast.success('Cotes enregistrées');
      location.hash = '#/cotes';
    });

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
              ${(() => {
                const modele = cat.modeleId ? (Store.state.modeles || []).find(m => m.id === cat.modeleId) : null;
                if (modele) return `<span class="cat-ouvrage-badge">🔧 ${Helpers.esc(modele.nom)}</span>`;
                return `<span class="cat-ouvrage-badge cat-ouvrage-badge--warning" title="Associez un ouvrage pour le calcul automatique (bouton ✎)">⚠️ Pas d'ouvrage associé</span>`;
              })()}
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
                  <img src="${cat.schema}" alt="Schéma" class="schema-preview" data-open-schema="${cat.id}" style="cursor:pointer">
                  <div class="schema-actions">
                    <button class="btn btn--ghost btn--sm" data-open-schema="${cat.id}">✎ Modifier</button>
                    <button class="btn-icon btn-icon--danger" data-delete-schema="${cat.id}" title="Supprimer le schéma">🗑</button>
                  </div>
                ` : `
                  <p class="hint" style="margin:0">Aucun schéma. Dessinez à main levée avec formes, texte et couleurs.</p>
                  <button class="btn btn--primary btn--sm" data-open-schema="${cat.id}">✏️ Dessiner un schéma</button>
                `}
              </div>
            </div>

            <div class="category-extra-block category-extra-block--photos">
              <h4>📸 Photos <span class="hint">(${(cat.photos || []).length}/5)</span></h4>
              <div class="photos-placeholder">
                ${(cat.photos || []).length > 0 ? `
                  <div class="photos-grid">
                    ${(cat.photos || []).map((p, i) => `
                      <div class="photo-thumb" data-photo-cat="${cat.id}" data-photo-idx="${i}">
                        <img src="${p.dataUrl}" alt="${Helpers.esc(p.name || '')}">
                        <button class="photo-thumb__delete" data-photo-delete="${cat.id}:${i}" title="Supprimer">×</button>
                      </div>
                    `).join('')}
                  </div>
                ` : `<p class="hint" style="margin:0">Aucune photo pour le moment.</p>`}
                <input type="file" accept="image/*" capture="environment" multiple class="photo-input" data-photo-input="${cat.id}" hidden>
                <button class="btn btn--primary btn--sm" data-add-photo="${cat.id}" ${(cat.photos || []).length >= 5 ? 'disabled' : ''}>
                  📸 ${(cat.photos || []).length >= 5 ? 'Maximum atteint (5/5)' : 'Ajouter une photo'}
                </button>
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

    // ====== SCHÉMA ======
    card.querySelectorAll('[data-open-schema]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cId = el.dataset.openSchema;
        if (window.Schema?.open) {
          window.Schema.open(cId);
        } else {
          Toast.error('Module Schema non chargé');
        }
      });
    });

    card.querySelector('[data-delete-schema]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      Modal.confirm({
        title: 'Supprimer le schéma ?',
        message: 'Cette action est irréversible.',
        danger: true,
        onConfirm: () => {
          Store.updateCategorieCote(catId, { schema: null, schemaData: null });
          Toast.success('Schéma supprimé');
          if (window.Router) Router.refresh();
        }
      });
    });

    // ====== PHOTOS ======
    // Bouton "+ Ajouter une photo" → ouvre le sélecteur de fichiers
    card.querySelector('[data-add-photo]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileInput = card.querySelector(`[data-photo-input="${catId}"]`);
      fileInput?.click();
    });

    // Sélection d'une photo
    card.querySelector(`[data-photo-input="${catId}"]`)?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const cat = (Store.state.categoriesCotes || []).find(c => c.id === catId);
      if (!cat) return;
      const currentPhotos = cat.photos || [];
      const remaining = 5 - currentPhotos.length;
      if (remaining <= 0) {
        Toast.warning('Maximum 5 photos par catégorie');
        return;
      }
      const filesToAdd = files.slice(0, remaining);
      if (files.length > remaining) {
        Toast.warning(`Seulement ${remaining} photo(s) pourront être ajoutées (max 5)`);
      }

      const newPhotos = [];
      for (const file of filesToAdd) {
        try {
          const compressed = await compressImage(file, 1280, 0.85);
          newPhotos.push({
            id: 'ph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name: file.name,
            dataUrl: compressed,
            addedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error(err);
          Toast.error('Erreur lors du traitement de ' + file.name);
        }
      }

      if (newPhotos.length > 0) {
        Store.updateCategorieCote(catId, {
          photos: [...currentPhotos, ...newPhotos]
        });
        Toast.success(`${newPhotos.length} photo(s) ajoutée(s)`);
        expandedCategories.add(catId);
        if (window.Router) Router.refresh();
      }

      // Reset input
      e.target.value = '';
    });

    // Click sur une vignette → voir en grand
    card.querySelectorAll('.photo-thumb img').forEach(img => {
      img.addEventListener('click', (e) => {
        const thumb = e.target.closest('.photo-thumb');
        const idx = parseInt(thumb?.dataset?.photoIdx);
        if (isNaN(idx)) return;
        const cat = (Store.state.categoriesCotes || []).find(c => c.id === catId);
        const photo = cat?.photos?.[idx];
        if (photo) openPhotoViewer(photo, cat.photos, idx, catId);
      });
    });

    // Suppression d'une photo (bouton ×)
    card.querySelectorAll('[data-photo-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [cId, idxStr] = btn.dataset.photoDelete.split(':');
        deletePhoto(cId, parseInt(idxStr));
      });
    });
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
    const cat = existing || { nom: '', modeleId: null };

    const modeles = Store.state.modeles || [];

    Modal.open({
      title: existing ? 'Modifier la catégorie' : 'Nouvelle catégorie d\'ouvrage',
      size: 'small',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom de la catégorie *</label>
            <input id="f_cat_nom" class="form-input" value="${Helpers.esc(cat.nom)}" placeholder="Ex: Fenêtres salon, Vitrage RDC..." autofocus>
            <p class="hint" style="margin-top:4px">Choisissez un nom qui décrit le type d'ouvrage à réaliser dans cette catégorie.</p>
          </div>
          <div class="form-field form-field--full">
            <label>Ouvrage associé (pour le calcul automatique)</label>
            <select id="f_cat_modele" class="form-select">
              <option value="">— Aucun (pas de calcul auto) —</option>
              ${modeles.map(m => `<option value="${m.id}" ${cat.modeleId === m.id ? 'selected' : ''}>${Helpers.esc(m.nom)}${m.categorie ? ` (${Helpers.esc(m.categorie)})` : ''}</option>`).join('')}
            </select>
            <p class="hint" style="margin-top:4px">
              ${modeles.length === 0
                ? '⚠️ Aucun ouvrage défini. Créez-en dans la page "Ouvrages" pour activer le calcul automatique des fournitures.'
                : 'En associant un ouvrage, les fournitures seront calculées automatiquement selon les dimensions saisies.'}
            </p>
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
          const modeleId = document.getElementById('f_cat_modele').value || null;
          if (!nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateCategorieCote(existing.id, { nom, modeleId });
            Toast.success('Catégorie mise à jour');
          } else {
            const newCat = Store.addCategorieCote({ chantierId: currentChantierId, nom, modeleId });
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
          ${cote.prix > 0 ? `<span class="cote-prix">${Format.euro(cote.prix)}</span>` : ''}
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
            <label>Prix fourniture (€ HT)</label>
            <input id="f_prix" class="form-input mono" type="number" min="0" step="0.01" placeholder="0" value="${c.prix || ''}">
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
            prix: parseFloat(document.getElementById('f_prix').value) || 0,
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

  // ============================================================
  // PHOTOS - Compression / Viewer / Delete
  // ============================================================
  function compressImage(file, maxSize = 1280, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Le fichier n\'est pas une image'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible'));
        img.onload = () => {
          let { width, height } = img;
          // Redimensionnement proportionnel si > maxSize
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height / width) * maxSize);
              width = maxSize;
            } else {
              width = Math.round((width / height) * maxSize);
              height = maxSize;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openPhotoViewer(photo, allPhotos, idx, catId) {
    Modal.open({
      title: photo.name || 'Photo',
      size: 'large',
      body: `
        <div class="photo-viewer">
          <button class="photo-viewer__nav photo-viewer__nav--prev" id="photoPrev" ${idx === 0 ? 'disabled' : ''}>‹</button>
          <img id="photoViewerImg" src="${photo.dataUrl}" alt="${Helpers.esc(photo.name || '')}">
          <button class="photo-viewer__nav photo-viewer__nav--next" id="photoNext" ${idx === allPhotos.length - 1 ? 'disabled' : ''}>›</button>
        </div>
        <div class="photo-viewer__info">
          <span>${idx + 1} / ${allPhotos.length}</span>
        </div>
      `,
      footer: `
        <button class="btn btn--danger" id="photoDelete">🗑 Supprimer</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `,
      onOpen: () => {
        let currentIdx = idx;
        const imgEl = document.getElementById('photoViewerImg');
        const prevBtn = document.getElementById('photoPrev');
        const nextBtn = document.getElementById('photoNext');
        const info = document.querySelector('.photo-viewer__info span');

        const updateView = () => {
          const p = allPhotos[currentIdx];
          if (!p) return;
          imgEl.src = p.dataUrl;
          imgEl.alt = p.name || '';
          info.textContent = `${currentIdx + 1} / ${allPhotos.length}`;
          prevBtn.disabled = currentIdx === 0;
          nextBtn.disabled = currentIdx === allPhotos.length - 1;
        };

        prevBtn?.addEventListener('click', () => {
          if (currentIdx > 0) { currentIdx--; updateView(); }
        });
        nextBtn?.addEventListener('click', () => {
          if (currentIdx < allPhotos.length - 1) { currentIdx++; updateView(); }
        });

        document.addEventListener('keydown', function escNav(e) {
          if (e.key === 'ArrowLeft' && currentIdx > 0) { currentIdx--; updateView(); }
          else if (e.key === 'ArrowRight' && currentIdx < allPhotos.length - 1) { currentIdx++; updateView(); }
        }, { once: false });

        document.getElementById('photoDelete')?.addEventListener('click', () => {
          Modal.close();
          deletePhoto(catId, currentIdx);
        });
      }
    });
  }

  function deletePhoto(catId, idx) {
    Modal.confirm({
      title: 'Supprimer cette photo ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        const cat = (Store.state.categoriesCotes || []).find(c => c.id === catId);
        if (!cat) return;
        const newPhotos = (cat.photos || []).filter((_, i) => i !== idx);
        Store.updateCategorieCote(catId, { photos: newPhotos });
        Toast.success('Photo supprimée');
        expandedCategories.add(catId);
        if (window.Router) Router.refresh();
      }
    });
  }

  // ============================================================
  // TOURNÉE OPTIMISÉE (prises de cotes)
  // ============================================================
  const ATELIER_DEFAUT = '20 Rue de la régale, Courtry 77181';

  function openTourneeDialog() {
    // Chantiers ayant une adresse renseignée
    const chantiers = (Store.state.chantiers || []).filter(c => {
      const st = Helpers.computeStatus(c);
      return st !== 'termine' && (c.adresse || c.ville);
    });

    if (chantiers.length === 0) {
      Toast.warning('Aucun chantier avec une adresse à visiter.');
      return;
    }

    const departSauve = localStorage.getItem('tournee_depart') || ATELIER_DEFAUT;

    Modal.open({
      title: '🚗 Optimiser une tournée de prises de cotes',
      size: 'medium',
      body: `
        <div class="form-field form-field--full" style="margin-bottom:var(--s-3)">
          <label>Point de départ (et retour)</label>
          <input id="tournee_depart" class="form-input" value="${Helpers.esc(departSauve)}" placeholder="Adresse de départ">
          <p class="hint" style="margin-top:4px">Par défaut : l'atelier. La tournée revient à ce point à la fin.</p>
        </div>
        <div class="form-field form-field--full">
          <label>Chantiers à visiter (${chantiers.length} disponibles)</label>
          <div class="tournee-select-list">
            ${chantiers.map(c => `
              <label class="check-row">
                <input type="checkbox" class="tournee-chk" value="${c.id}">
                <span>
                  <strong>${Helpers.esc(c.numero || '')}</strong> — ${Helpers.esc(c.titre || '')}
                  <span class="hint" style="display:block">${Helpers.esc([c.adresse, c.ville].filter(Boolean).join(', ') || 'Adresse incomplète')}</span>
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="tourneeGo">🗺️ Calculer la tournée</button>
      `,
      onOpen: () => {
        document.getElementById('tourneeGo').addEventListener('click', async () => {
          const depart = document.getElementById('tournee_depart').value.trim();
          if (!depart) { Toast.warning('Indiquez un point de départ'); return; }
          localStorage.setItem('tournee_depart', depart);

          const ids = Array.from(document.querySelectorAll('.tournee-chk:checked')).map(c => c.value);
          if (ids.length < 1) { Toast.warning('Sélectionnez au moins un chantier'); return; }

          const selected = ids.map(id => Store.state.chantiers.find(c => c.id === id)).filter(Boolean);
          Modal.close();
          await calculerTournee(depart, selected);
        });
      }
    });
  }

  // Géocode une adresse via Nominatim (OpenStreetMap, gratuit)
  async function geocode(adresse) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(adresse)}`;
    try {
      const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error('Erreur géocodage:', adresse, e);
    }
    return null;
  }

  // Distance à vol d'oiseau (Haversine) en km
  function distanceKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function calculerTournee(departAdresse, chantiers) {
    Toast.info('Calcul de la tournée en cours... (géocodage des adresses)');

    // 1) Géocoder le départ
    const departCoord = await geocode(departAdresse);
    if (!departCoord) {
      Toast.error('Impossible de localiser le point de départ. Vérifiez l\'adresse.');
      return;
    }

    // 2) Géocoder chaque chantier (avec délai pour respecter Nominatim : 1/s)
    const points = [];
    const nonLocalises = [];
    for (const c of chantiers) {
      const adr = [c.adresse, c.ville].filter(Boolean).join(', ');
      const coord = await geocode(adr);
      if (coord) {
        points.push({ chantier: c, coord, adresse: adr });
      } else {
        nonLocalises.push(c);
      }
      await new Promise(r => setTimeout(r, 1100)); // respect de la limite Nominatim
    }

    if (points.length === 0) {
      Toast.error('Aucune adresse n\'a pu être localisée.');
      return;
    }

    // 3) Algorithme du plus proche voisin (départ → ... → départ)
    const ordre = [];
    const restants = [...points];
    let position = departCoord;
    let distanceTotale = 0;

    while (restants.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      restants.forEach((p, i) => {
        const d = distanceKm(position, p.coord);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      const next = restants.splice(bestIdx, 1)[0];
      distanceTotale += bestDist;
      ordre.push(next);
      position = next.coord;
    }
    // Retour au départ
    distanceTotale += distanceKm(position, departCoord);

    // 4) Générer le PDF
    genererPdfTournee(departAdresse, departCoord, ordre, distanceTotale, nonLocalises);
    Toast.success('Tournée calculée !');
  }

  function genererPdfTournee(departAdresse, departCoord, ordre, distanceTotale, nonLocalises) {
    const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const entreprise = Store.state.parametres?.entreprise || {};

    // En-tête
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 12);
    doc.setFontSize(13);
    doc.text('TOURNÉE DE PRISES DE COTES', margin, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Édité le ${Format.date(new Date())}`, pageWidth - margin, 12, { align: 'right' });

    let y = 38;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${ordre.length} chantier(s) à visiter`, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Départ : ${departAdresse}`, margin, y);
    y += 8;

    const pageHeight = doc.internal.pageSize.getHeight();

    // Une fiche détaillée par chantier, dans l'ordre optimisé
    ordre.forEach((p, i) => {
      const c = p.chantier;
      const client = Store.state.clients.find(cl => cl.id === c.clientId);

      // Contact : celui choisi pour ce chantier, sinon le contact principal du client
      let contactNom = '', contactTel = '', contactRole = '';
      const ctChantier = Store.getContactChantier ? Store.getContactChantier(c.id) : null;
      if (ctChantier) {
        contactNom = ctChantier.nom || '';
        contactTel = ctChantier.telephone || '';
        contactRole = ctChantier.role || '';
      } else if (client) {
        contactNom = client.nom || '';
        contactTel = client.telephone || '';
        contactRole = client.role || '';
      }

      // Lieu (si un lieu du client est associé)
      const lieuChantier = Store.getLieuChantier ? Store.getLieuChantier(c.id) : null;

      // Ce qu'il faut mesurer : catégories d'ouvrages du chantier
      const cats = Store.getCategoriesByChantier ? Store.getCategoriesByChantier(c.id) : [];
      const aMesurer = cats.map(cat => {
        const nbCotes = Store.getCotesByCategorie ? Store.getCotesByCategorie(cat.id).length : 0;
        const modele = cat.modeleId ? (Store.state.modeles || []).find(m => m.id === cat.modeleId) : null;
        return `${cat.nom}${modele ? ' (' + modele.nom + ')' : ''}${nbCotes > 0 ? ' — ' + nbCotes + ' cote(s) déjà saisie(s)' : ''}`;
      });

      // Estimer la hauteur de la fiche
      const estH = 24 + Math.max(aMesurer.length, 1) * 5 + (c.notes ? 8 : 0);
      if (y + estH > pageHeight - 20) { doc.addPage(); y = 20; }

      // Cadre de la fiche
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.4);
      doc.setFillColor(248, 250, 252);
      const cardTop = y;

      // Numéro d'ordre (pastille)
      doc.setFillColor(59, 130, 246);
      doc.circle(margin + 4, y + 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), margin + 4, y + 5.5, { align: 'center' });

      // Titre du chantier
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${c.numero || ''} - ${c.titre || ''}`, margin + 11, y + 5);
      y += 10;

      // Adresse / lieu
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(`Adresse : ${p.adresse}`, margin + 11, y);
      y += 5;

      // Nom du lieu (école, mairie...)
      if (lieuChantier && lieuChantier.nom) {
        doc.text(`Lieu : ${lieuChantier.nom}`, margin + 11, y);
        y += 5;
      }

      // Contact / demandeur
      if (contactNom || contactTel) {
        const contactStr = `Contact : ${contactNom}${contactRole ? ' (' + contactRole + ')' : ''}${contactTel ? '  -  Tel : ' + Format.phone(contactTel) : ''}`;
        doc.text(contactStr, margin + 11, y);
        y += 5;
      }

      // Contacts sur place (gardien, responsable...)
      if (lieuChantier && lieuChantier.contacts && lieuChantier.contacts.length > 0) {
        lieuChantier.contacts.forEach(ct => {
          const surPlaceStr = `Sur place : ${ct.nom || ''}${ct.role ? ' (' + ct.role + ')' : ''}${ct.telephone ? '  -  Tel : ' + Format.phone(ct.telephone) : ''}`;
          doc.text(surPlaceStr, margin + 11, y);
          y += 5;
        });
      }

      // À mesurer
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('À mesurer :', margin + 11, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      if (aMesurer.length === 0) {
        doc.text('- (aucune catégorie d\'ouvrage définie, à créer sur place)', margin + 14, y);
        y += 4.5;
      } else {
        aMesurer.forEach(m => {
          const lines = doc.splitTextToSize('- ' + m, pageWidth - 2 * margin - 16);
          doc.text(lines, margin + 14, y);
          y += lines.length * 4.2;
        });
      }

      // Notes du chantier
      if (c.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        const noteLines = doc.splitTextToSize('Notes : ' + c.notes, pageWidth - 2 * margin - 14);
        doc.text(noteLines, margin + 11, y);
        y += noteLines.length * 4;
        doc.setFont('helvetica', 'normal');
      }

      // Cadre autour de la fiche
      doc.setDrawColor(220, 224, 230);
      doc.roundedRect(margin, cardTop - 2, pageWidth - 2 * margin, y - cardTop + 2, 2, 2, 'S');
      y += 8;
    });

    // Lien Google Maps
    const waypoints = [departCoord, ...ordre.map(p => p.coord), departCoord]
      .map(c => `${c.lat},${c.lon}`).join('/');
    const mapsUrl = `https://www.google.com/maps/dir/${waypoints}`;

    if (y > pageHeight - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.textWithLink('>> Ouvrir l\'itinéraire complet dans Google Maps', margin, y, { url: mapsUrl });
    y += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const urlLines = doc.splitTextToSize(mapsUrl, pageWidth - 2 * margin);
    doc.text(urlLines, margin, y);
    y += urlLines.length * 3 + 4;

    // Chantiers non localisés
    if (nonLocalises.length > 0) {
      if (y > pageHeight - 30) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setTextColor(200, 50, 50);
      doc.text(`Attention : ${nonLocalises.length} chantier(s) non localisé(s) (adresse introuvable) :`, margin, y);
      y += 5;
      doc.setTextColor(80, 80, 80);
      nonLocalises.forEach(c => {
        doc.text(`- ${c.numero || ''} ${c.titre || ''}`, margin + 3, y);
        y += 4;
      });
    }

    // Pied de page
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`${entreprise.nom || 'ChantierPro'} - Tournée optimisée`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

    doc.save(`Tournee_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  return {
    render,
    openForm: openCoteForm,
    _addCategory: () => openCategoryForm()
  };
})();
