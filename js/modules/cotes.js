// Module Cotes - prises de cotes par chantier
window.Cotes = (function () {
  let currentChantierId = null;
  let sortableInstance = null;
  let listSearchQuery = '';

  function render(container, chantierId) {
    currentChantierId = chantierId;

    // CAS 1 : aucun chantier en paramètre → vue de sélection
    if (!chantierId) {
      return renderChantierPicker(container);
    }

    // CAS 2 : chantier introuvable → retour à la liste
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

    // CAS 3 : chantier valide → affichage normal des cotes
    renderCotesForChantier(container, chantier);
  }

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

  function renderCotesForChantier(container, chantier) {
    const chantierId = chantier.id;
    const cotes = Store.getCotesByChantier(chantierId);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="breadcrumb">
            <a href="#/chantiers">Chantiers</a> /
            <a href="#/chantiers/${chantier.id}">${Helpers.esc(chantier.numero)}</a> /
            <span>Prises de cotes</span>
          </div>
          <h1 class="view-title">📐 ${Helpers.esc(chantier.titre)}</h1>
          <p class="view-subtitle">Mesures en mm — surfaces calculées automatiquement en m²</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="cotesBibliotheque">📚 Bibliothèque ouvrages</button>
          <button class="btn btn--primary" id="cotesAdd">+ Nouvelle cote</button>
        </div>
      </div>

      <div class="cotes-wrap">
        <div class="cote-header-row">
          <div class="cote-handle-h"></div>
          <div>N°</div>
          <div>Emplacement</div>
          <div>Dimensions (L × H mm)</div>
          <div>Surface</div>
          <div>Type / Ouvrage</div>
          <div></div>
        </div>
        <div class="cotes-list" id="cotesList">
          ${cotes.length === 0 ? UI.emptyState({
            icon: '📏', title: 'Aucune cote enregistrée',
            message: 'Commencez par ajouter une prise de cote.',
            action: '<button class="btn btn--primary" onclick="Cotes.openForm()">+ Ajouter une cote</button>'
          }) : cotes.map((c, i) => renderCoteRow(c, i)).join('')}
        </div>

        ${cotes.length > 0 ? renderSummary(cotes) : ''}
      </div>
    `;

    document.getElementById('cotesAdd')?.addEventListener('click', () => openForm());
    document.getElementById('cotesBibliotheque')?.addEventListener('click', openBibliotheque);

    // Drag and drop
    const list = document.getElementById('cotesList');
    if (list && cotes.length > 0 && typeof Sortable !== 'undefined') {
      sortableInstance = Sortable.create(list, {
        handle: '.cote-handle',
        animation: 200,
        ghostClass: 'cote-ghost',
        onEnd: () => {
          const ids = Array.from(list.querySelectorAll('.cote-item')).map(el => el.dataset.id);
          Store.reorderCotes(currentChantierId, ids);
        }
      });
    }

    // Bind row actions via delegation
    list?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.closest('.cote-item').dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') openForm(id);
      else if (action === 'delete') deleteRow(id);
      else if (action === 'duplicate') duplicateRow(id);
    });
  }

  function renderCoteRow(cote, index) {
    const surface = (cote.largeur * cote.hauteur) / 1000000;
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
          <strong>${Format.surface(cote.largeur, cote.hauteur)}</strong>
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

  function renderSummary(cotes) {
    const totalSurface = cotes.reduce((s, c) => s + (c.largeur * c.hauteur * (c.quantite || 1)) / 1000000, 0);
    const totalUnits = cotes.reduce((s, c) => s + (c.quantite || 1), 0);

    // Calcul fournitures auto (vitrage par défaut)
    const joints = totalSurface * 4; // 4m de joint par m² de vitrage approx
    const parclose = totalSurface * 4;
    const vis = Math.ceil(totalUnits * 8);

    return `
      <div class="cote-summary">
        <h3>📊 Récapitulatif</h3>
        <div class="cote-summary-grid">
          <div class="summary-card">
            <div class="summary-label">Nombre de cotes</div>
            <div class="summary-value">${cotes.length}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Unités totales</div>
            <div class="summary-value">${totalUnits}</div>
          </div>
          <div class="summary-card summary-card--highlight">
            <div class="summary-label">Surface totale</div>
            <div class="summary-value">${totalSurface.toFixed(2)} m²</div>
          </div>
        </div>

        <h4 style="margin-top:var(--sp-6)">🧮 Fournitures estimées</h4>
        <div class="fournitures-estim">
          <div class="fourn-row"><span>Joint d'étanchéité</span><strong>≈ ${joints.toFixed(1)} m</strong></div>
          <div class="fourn-row"><span>Parclose</span><strong>≈ ${parclose.toFixed(1)} m</strong></div>
          <div class="fourn-row"><span>Vis de fixation</span><strong>≈ ${vis} pcs</strong></div>
        </div>
        <p class="hint">Estimations basées sur 4 m de joint/parclose et 8 vis par m² de vitrage. Ajustables dans la bibliothèque d'ouvrages.</p>
      </div>
    `;
  }

  function openForm(coteId = null) {
    const existing = coteId ? Store.state.cotes.find(c => c.id === coteId) : null;
    const c = existing || { emplacement: '', largeur: '', hauteur: '', quantite: 1, type: 'Vitrage', notes: '' };

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
            Toast.success('Cote ajoutée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function deleteRow(id) {
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

  function duplicateRow(id) {
    const c = Store.state.cotes.find(c => c.id === id);
    if (!c) return;
    const copy = { ...c };
    delete copy.id;
    delete copy.order;
    copy.emplacement = c.emplacement + ' (copie)';
    Store.addCote(copy);
    Toast.success('Cote dupliquée');
    if (window.Router) Router.refresh();
  }

  function openBibliotheque() {
    Modal.open({
      title: '📚 Bibliothèque d\'ouvrages',
      size: 'large',
      body: `
        <p class="hint">Modèles d'ouvrages standards utilisés pour le calcul automatique des fournitures.</p>
        <table class="table">
          <thead><tr><th>Ouvrage</th><th>Joint /m²</th><th>Parclose /m²</th><th>Vis /unité</th></tr></thead>
          <tbody>
            <tr><td><strong>Vitrage simple</strong></td><td>4 m</td><td>4 m</td><td>8</td></tr>
            <tr><td><strong>Double vitrage</strong></td><td>4 m</td><td>4 m</td><td>10</td></tr>
            <tr><td><strong>Triple vitrage</strong></td><td>4 m</td><td>4 m</td><td>12</td></tr>
            <tr><td><strong>Store BSO</strong></td><td>—</td><td>—</td><td>6</td></tr>
            <tr><td><strong>Menuiserie</strong></td><td>6 m</td><td>—</td><td>16</td></tr>
            <tr><td><strong>Porte</strong></td><td>5 m</td><td>—</td><td>12</td></tr>
          </tbody>
        </table>
      `,
      footer: `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
    });
  }

  return { render, openForm };
})();
