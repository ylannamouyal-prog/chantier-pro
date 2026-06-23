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

  return {
    render,
    openForm: openCoteForm,
    _addCategory: () => openCategoryForm()
  };
})();
