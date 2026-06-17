// Module Modeles - bibliothèque de modèles de chantier
window.Modeles = (function () {

  let searchQuery = '';

  function render(container) {
    const all = Store.state.modeles || [];
    const filtered = filterModeles(all);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📋 Ouvrages & consommations</h1>
          <p class="view-subtitle">${all.length} ouvrage${all.length > 1 ? 's' : ''} — définissez les fournitures consommées pour calculer automatiquement vos chantiers</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="modAdd">+ Nouvel ouvrage</button>
        </div>
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="modSearch" placeholder="🔍 Rechercher (nom, catégorie...)" value="${Helpers.esc(searchQuery)}">
      </div>

      ${filtered.length === 0 ? UI.emptyState({
        icon: '📋',
        title: searchQuery ? 'Aucun résultat' : 'Aucun ouvrage',
        message: searchQuery ? 'Aucun ouvrage ne correspond à cette recherche.' : 'Créez vos types d\'ouvrages (fenêtre, vitrage, store, volet...) avec leurs fournitures pour calculer automatiquement les consommations sur vos chantiers.',
        action: !searchQuery ? '<button class="btn btn--primary" onclick="Modeles._add()">+ Nouvel ouvrage</button>' : ''
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
    const m2Count = lignes.filter(l => (l.mode || 'm2') === 'm2').length;
    const perimCount = lignes.filter(l => l.mode === 'perimetre').length;

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
          ${perimCount > 0 ? `
            <div class="modele-stat modele-stat--m2">
              <strong>${perimCount}</strong>
              <span>périmètre</span>
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
          <label>Nom de l'ouvrage *</label>
          <input id="f_nom" class="form-input" value="${Helpers.esc(m.nom)}" placeholder="Ex: Fenêtre PVC, Double vitrage, Volet roulant..." autofocus>
        </div>
        <div class="form-field form-field--full">
          <label>Catégorie</label>
          <input id="f_categorie" class="form-input" value="${Helpers.esc(m.categorie || '')}" placeholder="Ex: Vitrage, Menuiserie, Stores...">
        </div>
        <div class="form-field form-field--full">
          <label>Description</label>
          <textarea id="f_description" class="form-textarea" rows="2" placeholder="Précisions sur cet ouvrage...">${Helpers.esc(m.description || '')}</textarea>
        </div>

        <div class="form-field form-field--full">
          <label>Fournitures consommées *</label>
          <div class="modele-help">
            <p>Pour chaque fourniture, choisissez comment la quantité est calculée :</p>
            <ul>
              <li><strong>× surface (m²)</strong> : la quantité saisie est multipliée par la surface de l'ouvrage. Ex : 4 m² de film par m².</li>
              <li><strong>× périmètre (m)</strong> : multipliée par le tour de l'ouvrage (2×largeur + 2×hauteur). Ex : joint d'étanchéité.</li>
              <li><strong>× nombre (fixe)</strong> : multipliée par le nombre d'ouvrages. Ex : 4 vis par fenêtre.</li>
            </ul>
          </div>
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
        <select class="form-select ligne-mode" data-field="mode" data-no-search>
          <option value="m2" ${(l.mode || 'm2') === 'm2' ? 'selected' : ''}>× surface (m²)</option>
          <option value="perimetre" ${l.mode === 'perimetre' ? 'selected' : ''}>× périmètre (m)</option>
          <option value="fixe" ${l.mode === 'fixe' ? 'selected' : ''}>× nombre (fixe)</option>
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

    const MODE_LABELS = {
      m2: { label: 'par m²', icon: '📐' },
      perimetre: { label: 'par mètre (périmètre)', icon: '📏' },
      fixe: { label: 'par ouvrage (fixe)', icon: '📦' }
    };

    const renderModeTable = (mode) => {
      const lignes = (m.lignes || []).filter(l => (l.mode || 'm2') === mode);
      if (lignes.length === 0) return '';
      const info = MODE_LABELS[mode];
      return `
        <div class="detail-section">
          <h3>${info.icon} Fournitures ${info.label}</h3>
          <table class="table">
            <thead><tr><th>Fourniture</th><th>Quantité ${info.label}</th><th>Unité</th></tr></thead>
            <tbody>
              ${lignes.map(l => `
                <tr>
                  <td><strong>${Helpers.esc(l.designation)}</strong></td>
                  <td class="mono">${l.quantite}</td>
                  <td>${Helpers.esc(l.unite || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    Modal.open({
      title: `📋 ${m.nom}`,
      size: 'large',
      body: `
        ${m.categorie ? `<div class="rdv-detail-header"><span class="badge badge--info">${Helpers.esc(m.categorie)}</span></div>` : ''}
        ${m.description ? `<div class="detail-section"><p style="white-space:pre-wrap;margin:0">${Helpers.esc(m.description)}</p></div>` : ''}

        ${renderModeTable('m2')}
        ${renderModeTable('perimetre')}
        ${renderModeTable('fixe')}

        ${(m.lignes || []).length === 0 ? '<p class="hint">Aucune fourniture définie dans cet ouvrage.</p>' : ''}

        <div class="detail-section">
          <h3>📊 Simulation</h3>
          <p class="hint" style="margin:0 0 var(--s-2)">Testez le calcul pour un ouvrage de dimensions données.</p>
          <div class="form-grid">
            <div class="form-field">
              <label>Largeur (m)</label>
              <input id="simu_largeur" type="number" class="form-input mono" min="0" step="0.01" value="1" data-no-search>
            </div>
            <div class="form-field">
              <label>Hauteur (m)</label>
              <input id="simu_hauteur" type="number" class="form-input mono" min="0" step="0.01" value="1">
            </div>
            <div class="form-field">
              <label>Nombre d'ouvrages</label>
              <input id="simu_nombre" type="number" class="form-input mono" min="1" step="1" value="1">
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
          const largeur = parseFloat(document.getElementById('simu_largeur')?.value) || 0;
          const hauteur = parseFloat(document.getElementById('simu_hauteur')?.value) || 0;
          const nombre = parseInt(document.getElementById('simu_nombre')?.value) || 1;
          const surface = largeur * hauteur * nombre;
          const perimetre = 2 * (largeur + hauteur) * nombre;
          const result = computeQuantities(m, { surface, perimetre, nombre });
          document.getElementById('simu_resultat').innerHTML = result.length === 0 ? '<p class="hint">Aucune fourniture à simuler.</p>' : `
            <table class="table">
              <thead><tr><th>Fourniture</th><th>Quantité totale</th><th>Unité</th><th>Calcul</th></tr></thead>
              <tbody>
                ${result.map(r => {
                  const modeTxt = r.mode === 'm2' ? `${r.qtePar} × ${surface.toFixed(2)} m²`
                    : r.mode === 'perimetre' ? `${r.qtePar} × ${perimetre.toFixed(2)} m`
                    : `${r.qtePar} × ${nombre}`;
                  return `
                    <tr>
                      <td><strong>${Helpers.esc(r.designation)}</strong></td>
                      <td class="mono"><strong style="color:#3b82f6">${r.quantite.toFixed(2)}</strong></td>
                      <td>${Helpers.esc(r.unite || '')}</td>
                      <td class="hint">${modeTxt}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;
        };
        ['simu_largeur', 'simu_hauteur', 'simu_nombre'].forEach(id => {
          document.getElementById(id)?.addEventListener('input', simulate);
        });
        simulate();
      }
    });
  }

  /**
   * Calcule les quantités d'un modèle selon les dimensions.
   * dims = { surface, perimetre, nombre }
   */
  function computeQuantities(modele, dims) {
    const { surface = 0, perimetre = 0, nombre = 1 } = dims || {};
    return (modele.lignes || []).map(l => {
      const mode = l.mode || 'm2';
      let quantite;
      if (mode === 'm2') quantite = l.quantite * surface;
      else if (mode === 'perimetre') quantite = l.quantite * perimetre;
      else quantite = l.quantite * nombre; // fixe
      return {
        fournitureId: l.fournitureId,
        designation: l.designation,
        unite: l.unite,
        mode,
        qtePar: l.quantite,
        quantite
      };
    });
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
