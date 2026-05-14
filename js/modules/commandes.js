// Module Commandes - bons de commande fournisseurs
window.Commandes = (function () {
  let filterStatut = 'all';
  let searchQuery = '';

  function render(container) {
    const all = Store.state.commandes || [];
    const filtered = filterCommandes(all);

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📦 Commandes</h1>
          <p class="view-subtitle">${all.length} commande${all.length > 1 ? 's' : ''} — bons de commande fournisseurs</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="cmdSuggest">💡 Suggérer commandes</button>
          <button class="btn btn--primary" id="cmdAdd">+ Nouvelle commande</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${filterStatut === 'all' ? 'tab--active' : ''}" data-statut="all">Toutes (${all.length})</button>
        <button class="tab ${filterStatut === 'a-passer' ? 'tab--active' : ''}" data-statut="a-passer">⏳ À passer (${all.filter(c => c.statut === 'a-passer').length})</button>
        <button class="tab ${filterStatut === 'passee' ? 'tab--active' : ''}" data-statut="passee">📤 Passées (${all.filter(c => c.statut === 'passee').length})</button>
        <button class="tab ${filterStatut === 'livree' ? 'tab--active' : ''}" data-statut="livree">✅ Livrées (${all.filter(c => c.statut === 'livree').length})</button>
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="cmdSearch" placeholder="🔍 Rechercher (numéro, fournisseur, chantier)..." value="${Helpers.esc(searchQuery)}">
      </div>

      ${filtered.length === 0 ? UI.emptyState({
        icon: '📦',
        title: searchQuery || filterStatut !== 'all' ? 'Aucun résultat' : 'Aucune commande',
        message: searchQuery || filterStatut !== 'all' ? 'Aucune commande ne correspond à ces filtres.' : 'Créez votre première commande ou utilisez la suggestion automatique.',
        action: !searchQuery && filterStatut === 'all' ? '<button class="btn btn--primary" onclick="Commandes._add()">+ Nouvelle commande</button>' : ''
      }) : `
        <div class="commandes-grid">
          ${filtered.map(renderCard).join('')}
        </div>
      `}
    `;

    document.getElementById('cmdAdd')?.addEventListener('click', () => openForm());
    document.getElementById('cmdSuggest')?.addEventListener('click', openSuggestions);

    container.querySelectorAll('[data-statut]').forEach(tab => {
      tab.addEventListener('click', () => {
        filterStatut = tab.dataset.statut;
        render(container);
      });
    });

    const search = document.getElementById('cmdSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        searchQuery = search.value;
        render(container);
        document.getElementById('cmdSearch')?.focus();
      }, 200));
    }

    container.querySelectorAll('[data-commande-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openDetail(card.dataset.commandeId);
      });
    });
  }

  function filterCommandes(list) {
    let r = list;
    if (filterStatut !== 'all') r = r.filter(c => c.statut === filterStatut);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter(c => {
        const f = Store.state.fournisseurs.find(x => x.id === c.fournisseurId);
        const ch = Store.state.chantiers.find(x => x.id === c.chantierId);
        return (c.numero || '').toLowerCase().includes(q) ||
               (f?.nom || '').toLowerCase().includes(q) ||
               (ch?.titre || '').toLowerCase().includes(q) ||
               (ch?.numero || '').toLowerCase().includes(q);
      });
    }
    return r.sort((a, b) => new Date(b.dateCommande) - new Date(a.dateCommande));
  }

  function renderCard(c) {
    const fournisseur = Store.state.fournisseurs.find(x => x.id === c.fournisseurId);
    const chantier = c.chantierId ? Store.state.chantiers.find(x => x.id === c.chantierId) : null;
    const conducteur = c.conducteurId ? Store.state.conducteurs.find(x => x.id === c.conducteurId) : null;
    const montant = (c.lignes || []).reduce((s, l) => s + (Number(l.quantite) * Number(l.prixUnitaire || 0)), 0);
    const statutInfo = getStatutInfo(c.statut);

    return `
      <div class="commande-card commande-card--${c.statut}" data-commande-id="${c.id}">
        <div class="commande-card__header">
          <div>
            <div class="commande-num mono">${Helpers.esc(c.numero)}</div>
            <div class="commande-fournisseur">🏭 ${Helpers.esc(fournisseur?.nom || 'Fournisseur inconnu')}</div>
          </div>
          <span class="badge badge--${statutInfo.color}">${statutInfo.icon} ${statutInfo.label}</span>
        </div>

        <div class="commande-card__motif">
          ${c.motif === 'chantier' && chantier
            ? `<span class="motif-tag motif-tag--chantier">🏗️ Chantier : ${Helpers.esc(chantier.titre)}</span>`
            : `<span class="motif-tag motif-tag--reappro">🔄 Réapprovisionnement stock</span>`
          }
          ${conducteur ? `<span class="motif-tag" style="background:${conducteur.couleur}20;color:${conducteur.couleur}">👤 ${Helpers.esc(conducteur.nom)}</span>` : ''}
        </div>

        <div class="commande-card__body">
          <div class="commande-meta">
            <div><strong>📅 Commande :</strong> ${Format.dateShort(c.dateCommande)}</div>
            ${c.dateLivraisonPrevue ? `<div><strong>🚚 Livraison prévue :</strong> ${Format.dateShort(c.dateLivraisonPrevue)}</div>` : ''}
            <div><strong>📋 Lignes :</strong> ${(c.lignes || []).length}</div>
            <div><strong>💶 Montant :</strong> <span class="mono">${Format.euro(montant)}</span></div>
          </div>
        </div>
      </div>
    `;
  }

  function getStatutInfo(statut) {
    const map = {
      'a-passer':  { label: 'À passer', icon: '⏳', color: 'warning' },
      'passee':    { label: 'Passée',   icon: '📤', color: 'info' },
      'livree':    { label: 'Livrée',   icon: '✅', color: 'success' },
      'annulee':   { label: 'Annulée',  icon: '❌', color: 'danger' }
    };
    return map[statut] || map['a-passer'];
  }

  function openForm(commandeId = null, prefill = null) {
    const existing = commandeId ? Store.state.commandes.find(c => c.id === commandeId) : null;
    const c = existing || prefill || {
      dateCommande: new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: '',
      fournisseurId: '',
      chantierId: null,
      conducteurId: null,
      lignes: [],
      statut: 'a-passer',
      motif: 'reappro',
      notes: ''
    };

    Modal.open({
      title: existing ? `Modifier ${existing.numero}` : 'Nouvelle commande',
      size: 'large',
      body: renderFormBody(c),
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="cmdSave">${existing ? 'Mettre à jour' : 'Créer la commande'}</button>
      `,
      onOpen: () => {
        bindFormEvents(c);
        document.getElementById('cmdSave').addEventListener('click', () => {
          const data = collectFormData(c);
          if (!data.fournisseurId) { Toast.warning('Veuillez choisir un fournisseur'); return; }
          if (!data.lignes.length) { Toast.warning('Ajoutez au moins une ligne de commande'); return; }
          if (existing) {
            Store.updateCommande(existing.id, data);
            Toast.success('Commande mise à jour');
          } else {
            Store.addCommande(data);
            Toast.success('Commande créée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function renderFormBody(c) {
    return `
      <div class="form-grid">
        <div class="form-field">
          <label>Motif *</label>
          <select id="f_motif" class="form-select">
            <option value="reappro" ${c.motif === 'reappro' ? 'selected' : ''}>🔄 Réapprovisionnement stock</option>
            <option value="chantier" ${c.motif === 'chantier' ? 'selected' : ''}>🏗️ Pour un chantier</option>
          </select>
        </div>
        <div class="form-field">
          <label>Statut</label>
          <select id="f_statut" class="form-select">
            <option value="a-passer" ${c.statut === 'a-passer' ? 'selected' : ''}>⏳ À passer</option>
            <option value="passee" ${c.statut === 'passee' ? 'selected' : ''}>📤 Passée</option>
            <option value="livree" ${c.statut === 'livree' ? 'selected' : ''}>✅ Livrée</option>
            <option value="annulee" ${c.statut === 'annulee' ? 'selected' : ''}>❌ Annulée</option>
          </select>
        </div>

        <div class="form-field form-field--full" id="chantierField" style="${c.motif === 'chantier' ? '' : 'display:none'}">
          <label>Chantier</label>
          <select id="f_chantier" class="form-select">
            <option value="">— Sélectionner un chantier —</option>
            ${Store.state.chantiers.map(ch => `
              <option value="${ch.id}" ${c.chantierId === ch.id ? 'selected' : ''}>${Helpers.esc(ch.numero)} — ${Helpers.esc(ch.titre)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-field form-field--full">
          <label>Fournisseur *</label>
          <select id="f_fournisseur" class="form-select">
            <option value="">— Choisir un fournisseur —</option>
            ${Store.state.fournisseurs.map(fr => `
              <option value="${fr.id}" ${c.fournisseurId === fr.id ? 'selected' : ''} data-delai="${fr.delaiLivraison || 5}">${Helpers.esc(fr.nom)} (${fr.delaiLivraison || 5}j)</option>
            `).join('')}
          </select>
        </div>

        <div class="form-field">
          <label>Date de commande *</label>
          <input id="f_dateCommande" class="form-input" type="date" value="${c.dateCommande || ''}">
        </div>
        <div class="form-field">
          <label>Date de livraison prévue</label>
          <input id="f_dateLivraison" class="form-input" type="date" value="${c.dateLivraisonPrevue || ''}">
        </div>

        <div class="form-field form-field--full">
          <label>Lignes de commande *</label>
          <div id="lignesContainer" class="lignes-container">
            ${(c.lignes || []).map((l, i) => renderLigne(l, i)).join('')}
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="addLigne" style="margin-top:var(--s-2)">+ Ajouter une ligne</button>
          <div class="lignes-total">
            <strong>Total :</strong> <span id="lignesTotal" class="mono">0,00 €</span>
          </div>
        </div>

        <div class="form-field form-field--full">
          <label>Notes</label>
          <textarea id="f_notes" class="form-textarea" rows="2">${Helpers.esc(c.notes || '')}</textarea>
        </div>
      </div>
    `;
  }

  function renderLigne(l, i) {
    const fournitures = Store.state.fournitures;
    return `
      <div class="ligne-row" data-ligne-index="${i}">
        <select class="form-select ligne-fourniture" data-field="fournitureId">
          <option value="">— Fourniture libre —</option>
          ${fournitures.map(f => `
            <option value="${f.id}"
              data-designation="${Helpers.esc(f.nom)}"
              data-prix="${f.prixUnitaire || 0}"
              data-unite="${f.unite || 'pcs'}"
              ${l.fournitureId === f.id ? 'selected' : ''}>${Helpers.esc(f.nom)}</option>
          `).join('')}
        </select>
        <input class="form-input" placeholder="Désignation" data-field="designation" value="${Helpers.esc(l.designation || '')}">
        <input class="form-input mono ligne-qte" placeholder="Qté" type="number" min="0" step="0.01" data-field="quantite" value="${l.quantite || ''}">
        <input class="form-input mono" placeholder="Unité" data-field="unite" value="${Helpers.esc(l.unite || '')}">
        <input class="form-input mono ligne-prix" placeholder="P.U. €" type="number" min="0" step="0.01" data-field="prixUnitaire" value="${l.prixUnitaire || ''}">
        <span class="ligne-total mono">0,00 €</span>
        <button type="button" class="btn-icon btn-icon--danger ligne-del" title="Supprimer">🗑</button>
      </div>
    `;
  }

  function bindFormEvents(c) {
    // Toggle chantier field
    document.getElementById('f_motif')?.addEventListener('change', (e) => {
      document.getElementById('chantierField').style.display = e.target.value === 'chantier' ? '' : 'none';
    });

    // Auto-calcul date livraison quand fournisseur change
    document.getElementById('f_fournisseur')?.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      const delai = parseInt(opt?.dataset?.delai) || 5;
      const dateCommande = document.getElementById('f_dateCommande').value;
      if (dateCommande) {
        const d = new Date(dateCommande);
        d.setDate(d.getDate() + delai);
        document.getElementById('f_dateLivraison').value = d.toISOString().split('T')[0];
      }
    });

    // Recalcul date livraison quand date commande change
    document.getElementById('f_dateCommande')?.addEventListener('change', (e) => {
      const select = document.getElementById('f_fournisseur');
      const opt = select?.options[select.selectedIndex];
      const delai = parseInt(opt?.dataset?.delai) || 5;
      if (e.target.value) {
        const d = new Date(e.target.value);
        d.setDate(d.getDate() + delai);
        document.getElementById('f_dateLivraison').value = d.toISOString().split('T')[0];
      }
    });

    // Add ligne
    document.getElementById('addLigne')?.addEventListener('click', () => {
      const container = document.getElementById('lignesContainer');
      const i = container.querySelectorAll('.ligne-row').length;
      container.insertAdjacentHTML('beforeend', renderLigne({}, i));
      bindLignesEvents();
    });

    bindLignesEvents();
    updateLignesTotal();
  }

  function bindLignesEvents() {
    document.querySelectorAll('.ligne-row').forEach(row => {
      // Sélection fourniture → auto-remplit désignation/prix/unité
      row.querySelector('.ligne-fourniture')?.addEventListener('change', (e) => {
        const opt = e.target.options[e.target.selectedIndex];
        if (opt && opt.value) {
          row.querySelector('[data-field="designation"]').value = opt.dataset.designation || '';
          row.querySelector('[data-field="prixUnitaire"]').value = opt.dataset.prix || '';
          row.querySelector('[data-field="unite"]').value = opt.dataset.unite || '';
          updateLignesTotal();
        }
      });

      // Recalcul total ligne au changement de qté/prix
      ['quantite', 'prixUnitaire'].forEach(f => {
        row.querySelector(`[data-field="${f}"]`)?.addEventListener('input', updateLignesTotal);
      });

      // Suppression
      row.querySelector('.ligne-del')?.addEventListener('click', () => {
        row.remove();
        updateLignesTotal();
      });
    });
  }

  function updateLignesTotal() {
    let total = 0;
    document.querySelectorAll('.ligne-row').forEach(row => {
      const q = parseFloat(row.querySelector('[data-field="quantite"]')?.value) || 0;
      const p = parseFloat(row.querySelector('[data-field="prixUnitaire"]')?.value) || 0;
      const t = q * p;
      row.querySelector('.ligne-total').textContent = Format.euro(t);
      total += t;
    });
    const totalEl = document.getElementById('lignesTotal');
    if (totalEl) totalEl.textContent = Format.euro(total);
  }

  function collectFormData(originalCmd) {
    const lignes = [];
    document.querySelectorAll('.ligne-row').forEach(row => {
      const ligne = {
        fournitureId: row.querySelector('[data-field="fournitureId"]')?.value || null,
        designation: row.querySelector('[data-field="designation"]')?.value.trim() || '',
        quantite: parseFloat(row.querySelector('[data-field="quantite"]')?.value) || 0,
        unite: row.querySelector('[data-field="unite"]')?.value.trim() || 'pcs',
        prixUnitaire: parseFloat(row.querySelector('[data-field="prixUnitaire"]')?.value) || 0
      };
      if (ligne.designation && ligne.quantite > 0) lignes.push(ligne);
    });

    const motif = document.getElementById('f_motif').value;
    const chantierId = motif === 'chantier' ? (document.getElementById('f_chantier').value || null) : null;
    // Déduire le conducteur du chantier si applicable
    let conducteurId = null;
    if (chantierId) {
      const ch = Store.state.chantiers.find(c => c.id === chantierId);
      conducteurId = ch?.conducteurId || null;
    }

    return {
      motif,
      statut: document.getElementById('f_statut').value,
      fournisseurId: document.getElementById('f_fournisseur').value,
      dateCommande: document.getElementById('f_dateCommande').value,
      dateLivraisonPrevue: document.getElementById('f_dateLivraison').value,
      chantierId,
      conducteurId,
      lignes,
      notes: document.getElementById('f_notes').value.trim()
    };
  }

  function openDetail(id) {
    const c = Store.state.commandes.find(x => x.id === id);
    if (!c) return;
    const fournisseur = Store.state.fournisseurs.find(x => x.id === c.fournisseurId);
    const chantier = c.chantierId ? Store.state.chantiers.find(x => x.id === c.chantierId) : null;
    const conducteur = c.conducteurId ? Store.state.conducteurs.find(x => x.id === c.conducteurId) : null;
    const montant = (c.lignes || []).reduce((s, l) => s + (Number(l.quantite) * Number(l.prixUnitaire || 0)), 0);
    const statutInfo = getStatutInfo(c.statut);

    Modal.open({
      title: `📦 ${c.numero}`,
      size: 'large',
      body: `
        <div class="detail-section">
          <div class="commande-detail-header">
            <span class="badge badge--${statutInfo.color}">${statutInfo.icon} ${statutInfo.label}</span>
            <span class="motif-tag motif-tag--${c.motif === 'chantier' ? 'chantier' : 'reappro'}">
              ${c.motif === 'chantier' ? '🏗️ Pour chantier' : '🔄 Réapprovisionnement'}
            </span>
          </div>
          <h3>Informations</h3>
          <dl class="detail-list">
            <dt>Fournisseur</dt><dd><strong>${Helpers.esc(fournisseur?.nom || '—')}</strong></dd>
            ${fournisseur?.contact ? `<dt>Contact</dt><dd>${Helpers.esc(fournisseur.contact)}</dd>` : ''}
            ${fournisseur?.email ? `<dt>Email</dt><dd>${Helpers.esc(fournisseur.email)}</dd>` : ''}
            <dt>Date commande</dt><dd>${Format.dateShort(c.dateCommande)}</dd>
            ${c.dateLivraisonPrevue ? `<dt>Livraison prévue</dt><dd>${Format.dateShort(c.dateLivraisonPrevue)}</dd>` : ''}
            ${chantier ? `<dt>Chantier</dt><dd>${Helpers.esc(chantier.numero)} — ${Helpers.esc(chantier.titre)}</dd>` : ''}
            ${conducteur ? `<dt>Conducteur</dt><dd><span class="color-dot" style="background:${conducteur.couleur}"></span>${Helpers.esc(conducteur.nom)}</dd>` : ''}
          </dl>
        </div>

        <div class="detail-section">
          <h3>Lignes de commande</h3>
          <table class="table">
            <thead><tr><th>Désignation</th><th>Qté</th><th>Unité</th><th>P.U.</th><th>Total</th></tr></thead>
            <tbody>
              ${(c.lignes || []).map(l => `
                <tr>
                  <td>${Helpers.esc(l.designation)}</td>
                  <td class="mono">${l.quantite}</td>
                  <td>${Helpers.esc(l.unite || '')}</td>
                  <td class="mono">${Format.euro(l.prixUnitaire || 0)}</td>
                  <td class="mono"><strong>${Format.euro((l.quantite || 0) * (l.prixUnitaire || 0))}</strong></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="4" style="text-align:right"><strong>Total HT</strong></td><td class="mono"><strong>${Format.euro(montant)}</strong></td></tr>
            </tfoot>
          </table>
        </div>

        ${c.notes ? `<div class="detail-section"><h3>Notes</h3><p>${Helpers.esc(c.notes)}</p></div>` : ''}
      `,
      footer: `
        <button class="btn btn--danger" onclick="Commandes._delete('${c.id}')">🗑 Supprimer</button>
        ${c.statut !== 'livree' && c.statut !== 'annulee' ? `
          <button class="btn btn--ghost" onclick="Commandes._setStatut('${c.id}', 'passee')">📤 Marquer passée</button>
          <button class="btn btn--ghost" onclick="Commandes._setStatut('${c.id}', 'livree')">✅ Marquer livrée</button>
        ` : ''}
        <button class="btn btn--ghost" onclick="Commandes._pdf('${c.id}')">📄 PDF</button>
        <button class="btn btn--ghost" onclick="Commandes._copy('${c.id}')">📋 Copier</button>
        <button class="btn btn--ghost" onclick="Commandes._edit('${c.id}')">✎ Modifier</button>
        <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>
      `
    });
  }

  function _setStatut(id, statut) {
    if (statut === 'livree') {
      Modal.confirm({
        title: 'Marquer comme livrée ?',
        message: 'Les quantités seront <strong>automatiquement ajoutées au stock atelier</strong>. Cette action est traçée dans l\'historique des mouvements.',
        confirmLabel: '✅ Confirmer livraison',
        onConfirm: () => {
          Store.markCommandeLivree(id);
          Toast.success('Livraison enregistrée — stock atelier mis à jour');
          Modal.close();
          if (window.Router) Router.refresh();
        }
      });
    } else {
      Store.updateCommande(id, { statut });
      Toast.success('Statut mis à jour');
      Modal.close();
      if (window.Router) Router.refresh();
    }
  }

  function _delete(id) {
    Modal.confirm({
      title: 'Supprimer cette commande ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteCommande(id);
        Toast.success('Commande supprimée');
        Modal.close();
        if (window.Router) Router.refresh();
      }
    });
  }

  function _edit(id) {
    Modal.close();
    setTimeout(() => openForm(id), 100);
  }

  function _pdf(id) {
    if (window.PdfExport?.commande) {
      window.PdfExport.commande(id);
    } else {
      Toast.info('Génération PDF disponible bientôt');
    }
  }

  function _copy(id) {
    const c = Store.state.commandes.find(x => x.id === id);
    if (!c) return;
    const fournisseur = Store.state.fournisseurs.find(x => x.id === c.fournisseurId);
    const lignes = (c.lignes || []).map(l => `- ${l.quantite} ${l.unite || ''} ${l.designation}`).join('\n');
    const text = `BON DE COMMANDE ${c.numero}
Date: ${Format.dateShort(c.dateCommande)}
Fournisseur: ${fournisseur?.nom || ''}
Livraison prévue: ${c.dateLivraisonPrevue ? Format.dateShort(c.dateLivraisonPrevue) : '—'}

Articles:
${lignes}

Total: ${Format.euro((c.lignes || []).reduce((s, l) => s + (l.quantite || 0) * (l.prixUnitaire || 0), 0))}

${c.notes || ''}`;
    navigator.clipboard.writeText(text).then(() => {
      Toast.success('Commande copiée dans le presse-papier');
    }).catch(() => {
      Toast.error('Copie impossible');
    });
  }

  function openSuggestions() {
    const suggestions = Store.suggestCommandes();
    if (suggestions.length === 0) {
      Toast.info('Aucune suggestion : tous vos stocks sont au-dessus des seuils, ou aucun fournisseur n\'est configuré');
      return;
    }

    Modal.open({
      title: `💡 ${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''} de commande`,
      size: 'large',
      body: `
        <p class="hint">L'app a détecté des fournitures sous le seuil d'alerte. Cochez les commandes à créer :</p>
        <div class="suggestions-list">
          ${suggestions.map((s, i) => `
            <div class="suggestion-card">
              <label class="suggestion-header">
                <input type="checkbox" class="suggestion-check" data-index="${i}" checked>
                <div>
                  <strong>🏭 ${Helpers.esc(s.fournisseurNom)}</strong>
                  <span class="hint">Livraison estimée : ${Format.dateShort(s.dateLivraisonPrevue)} (${s.delaiLivraison}j)</span>
                </div>
                <span class="mono"><strong>${Format.euro(s.montantEstime)}</strong></span>
              </label>
              <table class="table table--compact">
                <thead><tr><th>Fourniture</th><th>Qté</th><th>P.U.</th></tr></thead>
                <tbody>
                  ${s.lignes.map(l => `
                    <tr>
                      <td>${Helpers.esc(l.designation)}</td>
                      <td class="mono">${l.quantite} ${l.unite}</td>
                      <td class="mono">${Format.euro(l.prixUnitaire)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="createSuggestions">Créer les commandes sélectionnées</button>
      `,
      onOpen: () => {
        document.getElementById('createSuggestions').addEventListener('click', () => {
          let created = 0;
          document.querySelectorAll('.suggestion-check:checked').forEach(cb => {
            const s = suggestions[parseInt(cb.dataset.index)];
            Store.addCommande({
              fournisseurId: s.fournisseurId,
              dateCommande: s.dateCommande,
              dateLivraisonPrevue: s.dateLivraisonPrevue,
              lignes: s.lignes,
              motif: 'reappro',
              statut: 'a-passer'
            });
            created++;
          });
          if (created === 0) {
            Toast.warning('Aucune commande sélectionnée');
            return;
          }
          Toast.success(`${created} commande${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}`);
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  return { render, _add: () => openForm(), _delete, _edit, _setStatut, _pdf, _copy, openForm };
})();
