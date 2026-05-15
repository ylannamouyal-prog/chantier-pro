// Module Modeles - bibliothèque de modèles de chantier
window.Modeles = (function () {

  let searchQuery = '';

  function render(container) {
    const all = Store.state.modeles || [];
    const filtered = filterModeles(all);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📋 Modèles de chantier</h1>
          <p class="view-subtitle">${all.length} modèle${all.length > 1 ? 's' : ''} — bibliothèque de fournitures par type d'ouvrage</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="modAdd">+ Nouveau modèle</button>
        </div>
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="modSearch" placeholder="🔍 Rechercher (nom, catégorie...)" value="${Helpers.esc(searchQuery)}">
      </div>

      ${filtered.length === 0 ? UI.emptyState({
        icon: '📋',
        title: searchQuery ? 'Aucun résultat' : 'Aucun modèle',
        message: searchQuery ? 'Aucun modèle ne correspond à cette recherche.' : 'Créez vos premiers modèles pour calculer automatiquement les fournitures nécessaires sur vos chantiers.',
        action: !searchQuery ? '<button class="btn btn--primary" onclick="Modeles._add()">+ Nouveau modèle</button>' : ''
      }) : `
        <div class="modeles-grid">
          ${filtered.map(renderCard).join('')}
        </div>
      `}
    `;

    document.getElementById('modAdd')?.addEventListener('click', () => openForm());

    const search = document.getElementById('modSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        searchQuery = search.value;
        render(container);
        document.getElementById('modSearch')?.focus();
      }, 200));
    }

    container.querySelectorAll('[data-modele-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openDetail(card.dataset.modeleId);
      });
      card.querySelector('[data-mod-edit]')?.addEventListener('click', () => openForm(card.dataset.modeleId));
      card.querySelector('[data-mod-dup]')?.addEventListener('click', () => duplicate(card.dataset.modeleId));
      card.querySelector('[data-mod-delete]')?.addEventListener('click', () => deleteModele(card.dataset.modeleId));
    });
  }

  function filterModeles(list) {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(m =>
      (m.nom || '').toLowerCase().includes(q) ||
      (m.categorie || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  }

  function renderCard(m) {
    const lignes = m.lignes || [];
    const fixCount = lignes.filter(l => l.mode === 'fixe').length;
    const m2Count = lignes.filter(l => l.mode === 'm2').length;

    return `
      <div class="modele-card" data-modele-id="${m.id}">
        <div class="modele-card__header">
          <div>
            <h3>${Helpers.esc(m.nom || '(Sans nom)')}</h3>
            ${m.categorie ? `<span class="badge badge--info">${Helpers.esc(m.categorie)}</span>` : ''}
          </div>
        </div>

        ${m.description ? `<p class="modele-card__desc">${Helpers.esc(m.description)}</p>` : ''}

        <div class="modele-card__stats">
          <div class="modele-stat">
            <strong>${lignes.length}</strong>
            <span>fourniture${lignes.length > 1 ? 's' : ''}</span>
          </div>
          ${m2Count > 0 ? `
            <div class="modele-stat modele-stat--m2">
              <strong>${m2Count}</strong>
              <span>par m²</span>
            </div>
          ` : ''}
          ${fixCount > 0 ? `
            <div class="modele-stat modele-stat--fixe">
              <strong>${fixCount}</strong>
              <span>fixe${fixCount > 1 ? 's' : ''}</span>
            </div>
          ` : ''}
        </div>

        <div class="modele-card__actions">
          <button class="btn-icon" data-mod-edit title="Modifier">✎</button>
          <button class="btn-icon" data-mod-dup title="Dupliquer">⎘</button>
          <button class="btn-icon btn-icon--danger" data-mod-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function openForm(modeleId = null) {
    const existing = modeleId ? Store.state.modeles.find(m => m.id === modeleId) : null;
    const m = existing || { nom: '', description: '', categorie: '', lignes: [] };

    Modal.open({
      title: existing ? 'Modifier le modèle' : 'Nouveau modèle de chantier',
      size: 'large',
      body: renderFormBody(m),
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="modSave">${existing ? 'Mettre à jour' : 'Créer le modèle'}</button>
      `,
      onOpen: () => {
        bindFormEvents();
        document.getElementById('modSave').addEventListener('click', () => {
          const data = collectFormData();
          if (!data.nom) { Toast.warning('Le nom du modèle est requis'); return; }
          if (data.lignes.length === 0) { Toast.warning('Ajoutez au moins une fourniture'); return; }
          if (existing) {
            Store.updateModele(existing.id, data);
            Toast.success('Modèle mis à jour');
          } else {
            Store.addModele(data);
            Toast.success('Modèle créé');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function renderFormBody(m) {
    return `
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label>Nom du modèle *</label>
          <input id="f_nom" class="form-input" value="${Helpers.esc(m.nom)}" placeholder="Ex: Pose double vitrage standard" autofocus>
        </div>
        <div class="form-field form-field--full">
          <label>Catégorie</label>
          <input id="f_categorie" class="form-input" value="${Helpers.esc(m.categorie || '')}" placeholder="Ex: Vitrage, Menuiserie, Stores...">
        </div>
        <div class="form-field form-field--full">
          <label>Description</label>
          <textarea id="f_description" class="form-textarea" rows="2" placeholder="Précisions sur ce modèle...">${Helpers.esc(m.description || '')}</textarea>
        </div>

        <div class="form-field form-field--full">
          <label>Fournitures consommées *</label>
          <p class="hint" style="margin:0 0 var(--s-2)">Pour chaque fourniture, choisissez le mode de calcul : <strong>par m²</strong> (multiplié par la surface du chantier) ou <strong>fixe</strong> (quantité indépendante de la surface).</p>
          <div id="modeleLignes" class="modele-lignes-container">
            ${(m.lignes || []).map((l, i) => renderLigne(l, i)).join('')}
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="addLigne" style="margin-top:var(--s-2)">+ Ajouter une fourniture</button>
        </div>
      </div>
    `;
  }

  function renderLigne(l, i) {
    const fournitures = Store.state.fournitures || [];
    return `
      <div class="modele-ligne-row" data-ligne-index="${i}">
        <select class="form-select ligne-fourniture" data-field="fournitureId">
          <option value="">— Choisir une fourniture —</option>
          ${fournitures.map(f => `
            <option value="${f.id}"
              data-designation="${Helpers.esc(f.nom)}"
              data-unite="${f.unite || 'pcs'}"
              ${l.fournitureId === f.id ? 'selected' : ''}>${Helpers.esc(f.nom)}${f.reference ? ` (${Helpers.esc(f.reference)})` : ''}</option>
          `).join('')}
        </select>
        <input class="form-input mono ligne-qte" placeholder="Qté" type="number" min="0" step="0.01" data-field="quantite" value="${l.quantite || ''}">
        <span class="ligne-unite mono">${Helpers.esc(l.unite || '')}</span>
        <select class="form-select ligne-mode" data-field="mode">
          <option value="m2" ${(l.mode || 'm2') === 'm2' ? 'selected' : ''}>par m²</option>
          <option value="fixe" ${l.mode === 'fixe' ? 'selected' : ''}>fixe / chantier</option>
        </select>
        <button type="button" class="btn-icon btn-icon--danger ligne-del" title="Supprimer">🗑</button>
      </div>
    `;
  }

  function bindFormEvents() {
    document.getElementById('addLigne')?.addEventListener('click', () => {
      const container = document.getElementById('modeleLignes');
      const i = container.querySelectorAll('.modele-ligne-row').length;
      container.insertAdjacentHTML('beforeend', renderLigne({ mode: 'm2' }, i));
      bindLignesEvents();
    });
    bindLignesEvents();
  }

  function bindLignesEvents() {
    document.querySelectorAll('.modele-ligne-row').forEach(row => {
      row.querySelector('.ligne-fourniture')?.addEventListener('change', (e) => {
        const opt = e.target.options[e.target.selectedIndex];
        const uniteSpan = row.querySelector('.ligne-unite');
        if (opt && opt.value && uniteSpan) {
          uniteSpan.textContent = opt.dataset.unite || '';
        } else if (uniteSpan) {
          uniteSpan.textContent = '';
        }
      });

      row.querySelector('.ligne-del')?.addEventListener('click', () => row.remove());
    });
  }

  function collectFormData() {
    const lignes = [];
    document.querySelectorAll('.modele-ligne-row').forEach(row => {
      const fournitureId = row.querySelector('[data-field="fournitureId"]')?.value;
      const quantite = parseFloat(row.querySelector('[data-field="quantite"]')?.value) || 0;
      const mode = row.querySelector('[data-field="mode"]')?.value || 'm2';
      if (!fournitureId || quantite <= 0) return;
      const f = Store.state.fournitures.find(x => x.id === fournitureId);
      lignes.push({
        fournitureId,
        designation: f?.nom || '',
        quantite,
        mode,
        unite: f?.unite || 'pcs'
      });
    });

    return {
      nom: document.getElementById('f_nom').value.trim(),
      categorie: document.getElementById('f_categorie').value.trim(),
      description: document.getElementById('f_description').value.trim(),
      lignes
    };
  }

  function openDetail(id) {
    const m = Store.state.modeles.find(x => x.id === id);
    if (!m) return;

    const m2Lignes = (m.lignes || []).filter(l => l.mode === 'm2');
    const fixLignes = (m.lignes || []).filter(l => l.mode === 'fixe');

    Modal.open({
      title: `📋 ${m.nom}`,
      size: 'large',
      body: `
        ${m.categorie ? `<div class="rdv-detail-header"><span class="badge badge--info">${Helpers.esc(m.categorie)}</span></div>` : ''}
        ${m.description ? `<div class="detail-section"><p style="white-space:pre-wrap;margin:0">${Helpers.esc(m.description)}</p></div>` : ''}

        ${m2Lignes.length > 0 ? `
          <div class="detail-section">
            <h3>📐 Fournitures par m²</h3>
            <table class="table">
              <thead><tr><th>Fourniture</th><th>Quantité / m²</th><th>Unité</th></tr></thead>
              <tbody>
                ${m2Lignes.map(l => `
                  <tr>
                    <td><strong>${Helpers.esc(l.designation)}</strong></td>
                    <td class="mono">${l.quantite}</td>
                    <td>${Helpers.esc(l.unite || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${fixLignes.length > 0 ? `
          <div class="detail-section">
            <h3>📦 Fournitures fixes (par chantier)</h3>
            <table class="table">
              <thead><tr><th>Fourniture</th><th>Quantité</th><th>Unité</th></tr></thead>
              <tbody>
                ${fixLignes.map(l => `
                  <tr>
                    <td><strong>${Helpers.esc(l.designation)}</strong></td>
                    <td class="mono">${l.quantite}</td>
                    <td>${Helpers.esc(l.unite || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${m.lignes.length === 0 ? '<p class="hint">Aucune fourniture définie dans ce modèle.</p>' : ''}

        <div class="detail-section">
          <h3>📊 Simulation</h3>
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label>Surface à simuler (m²)</label>
              <input id="simu_surface" type="number" class="form-input mono" min="0" step="0.1" value="10" placeholder="10">
            </div>
          </div>
          <div id="simu_resultat" style="margin-top:var(--s-3)"></div>
        </div>
      `,
      footer: `
        <button class="btn btn--danger" onclick="Modeles._delete('${m.id}')">🗑 Supprimer</button>
        <button class="btn btn--ghost" onclick="Modeles._dup('${m.id}')">⎘ Dupliquer</button>
        <button class="btn btn--ghost" onclick="Modeles._edit('${m.id}')">✎ Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `,
      onOpen: () => {
        const simulate = () => {
          const surface = parseFloat(document.getElementById('simu_surface')?.value) || 0;
          const result = computeQuantities(m, surface);
          document.getElementById('simu_resultat').innerHTML = result.length === 0 ? '<p class="hint">Aucune fourniture à simuler.</p>' : `
            <table class="table">
              <thead><tr><th>Fourniture</th><th>Quantité totale</th><th>Unité</th><th>Mode</th></tr></thead>
              <tbody>
                ${result.map(r => `
                  <tr>
                    <td><strong>${Helpers.esc(r.designation)}</strong></td>
                    <td class="mono"><strong style="color:#3b82f6">${r.quantite.toFixed(2)}</strong></td>
                    <td>${Helpers.esc(r.unite || '')}</td>
                    <td>${r.mode === 'm2' ? `<span class="badge badge--info">${r.qtePar} / m²</span>` : '<span class="badge">fixe</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        };
        document.getElementById('simu_surface')?.addEventListener('input', simulate);
        simulate();
      }
    });
  }

  function computeQuantities(modele, surface) {
    return (modele.lignes || []).map(l => ({
      fournitureId: l.fournitureId,
      designation: l.designation,
      unite: l.unite,
      mode: l.mode,
      qtePar: l.quantite,
      quantite: l.mode === 'm2' ? l.quantite * (surface || 0) : l.quantite
    }));
  }

  function _edit(id) {
    Modal.close();
    setTimeout(() => openForm(id), 100);
  }

  function _dup(id) {
    duplicate(id);
  }

  function duplicate(id) {
    const copy = Store.duplicateModele(id);
    if (copy) {
      Toast.success('Modèle dupliqué');
      Modal.close();
      if (window.Router) Router.refresh();
    }
  }

  function _delete(id) {
    Modal.confirm({
      title: 'Supprimer ce modèle ?',
      message: 'Cette action est irréversible. Les chantiers existants qui utilisent ce modèle conserveront leur copie des fournitures prévues.',
      danger: true,
      onConfirm: () => {
        Store.deleteModele(id);
        Toast.success('Modèle supprimé');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  function deleteModele(id) {
    _delete(id);
  }

  return {
    render,
    openForm,
    openDetail,
    computeQuantities, // utile pour le commit B (application aux chantiers)
    _add: () => openForm(),
    _edit,
    _dup,
    _delete
  };
})();
