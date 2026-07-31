// Module Stocks - atelier + camions par équipe
window.Stocks = (function () {
  let activeTab = 'atelier';
  let searchQuery = '';

  function render(container) {
    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">📦 Stocks</h1>
          <p class="view-subtitle">Gestion de l'atelier et des camions des équipes</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--ghost" id="stkMvt">📋 Mouvements</button>
          <button class="btn btn--ghost" id="stkExportMvt">📥 Exporter mouvements</button>
          <button class="btn btn--ghost" id="stkExportEtat">📄 État du stock (PDF)</button>
          <button class="btn btn--primary" id="stkAdd">+ Nouvelle fourniture</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${activeTab === 'atelier' ? 'tab--active' : ''}" data-tab="atelier">🏭 Atelier</button>
        ${Store.state.equipes.map(eq => `
          <button class="tab ${activeTab === eq.id ? 'tab--active' : ''}" data-tab="${eq.id}">
            <span class="color-dot" style="background:${eq.couleur}"></span>
            🚚 ${Helpers.esc(eq.nom)}
          </button>
        `).join('')}
        <button class="tab ${activeTab === 'commandes-chantier' ? 'tab--active' : ''}" data-tab="commandes-chantier">
          🏗️ Commandes chantier
        </button>
      </div>

      <div class="filters">
        <input class="form-input filter-search" id="stkSearch" placeholder="🔍 Rechercher une fourniture..." value="${Helpers.esc(searchQuery)}">
      </div>

      <div id="stockContent"></div>
    `;

    document.getElementById('stkAdd')?.addEventListener('click', openAddFourniture);
    document.getElementById('stkMvt')?.addEventListener('click', openMouvements);
    document.getElementById('stkExportMvt')?.addEventListener('click', openExportMouvements);
    document.getElementById('stkExportEtat')?.addEventListener('click', () => window.PdfExport?.stockEtat());

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render(container);
      });
    });

    const search = document.getElementById('stkSearch');
    if (search) {
      search.addEventListener('input', Helpers.debounce(() => {
        searchQuery = search.value;
        renderContent();
        document.getElementById('stkSearch')?.focus();
      }, 200));
    }

    renderContent();
  }

  function renderContent() {
    const content = document.getElementById('stockContent');
    if (!content) return;

    // Onglet spécial : commandes chantier
    if (activeTab === 'commandes-chantier') {
      renderCommandesChantier(content);
      return;
    }

    const fournitures = filterFournitures(Store.state.fournitures);
    const isAtelier = activeTab === 'atelier';
    const equipe = isAtelier ? null : Store.state.equipes.find(e => e.id === activeTab);

    // Calcul valeur totale
    let totalValue = 0;
    let alertCount = 0;
    fournitures.forEach(f => {
      const qte = isAtelier ? (Store.state.stockAtelier[f.id] || 0) : (Store.state.stockCamions[activeTab]?.[f.id] || 0);
      totalValue += qte * (f.prixUnitaire || 0);
      if (qte <= (f.seuilAlerte || 0)) alertCount++;
    });

    content.innerHTML = `
      <div class="stock-summary">
        <div class="stat-card">
          <div class="stat-card__label">Références</div>
          <div class="stat-card__value">${fournitures.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Valeur estimée</div>
          <div class="stat-card__value">${Format.euro(totalValue)}</div>
        </div>
        <div class="stat-card ${alertCount > 0 ? 'stat-card--warning' : ''}">
          <div class="stat-card__label">Alertes seuil</div>
          <div class="stat-card__value">${alertCount}</div>
        </div>
        ${equipe ? `
          <div class="stat-card" style="border-left:4px solid ${equipe.couleur}">
            <div class="stat-card__label">Équipe</div>
            <div class="stat-card__value">${Helpers.esc(equipe.nom)}</div>
          </div>
        ` : ''}
      </div>

      ${fournitures.length === 0 ? UI.emptyState({
        icon: '📦', title: 'Aucune fourniture',
        message: searchQuery ? 'Aucun résultat pour cette recherche.' : 'Ajoutez vos premières fournitures.'
      }) : `
        <div class="table-wrap">
          <table class="table table--stock">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Catégorie</th>
                <th>Unité</th>
                <th>Quantité</th>
                <th>Niveau</th>
                <th>Seuil</th>
                <th>Valeur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${fournitures.map(f => renderStockRow(f, isAtelier, equipe)).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    content.querySelectorAll('[data-fourniture]').forEach(row => {
      row.querySelectorAll('[data-stk-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = row.dataset.fourniture;
          const action = btn.dataset.stkAction;
          if (action === 'in') openMouvement(id, 'entree');
          else if (action === 'out') openMouvement(id, 'sortie');
          else if (action === 'transfer') openTransfert(id);
          else if (action === 'edit') openAddFourniture(id);
          else if (action === 'delete') deleteFourniture(id);
        });
      });
    });
  }

  function filterFournitures(list) {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(f =>
      (f.nom || '').toLowerCase().includes(q) ||
      (f.reference || '').toLowerCase().includes(q) ||
      (f.categorie || '').toLowerCase().includes(q)
    );
  }

  // ============================================================
  // ONGLET COMMANDES CHANTIER
  // ============================================================
  function renderCommandesChantier(content) {
    const STATUTS = {
      'a-commander': { label: 'À commander', cls: 'badge--warning', icon: '📝' },
      'commande': { label: 'Commandé', cls: 'badge--info', icon: '📦' },
      'livre': { label: 'Livré', cls: 'badge--success', icon: '✅' },
      'pose': { label: 'Posé', cls: 'badge--done', icon: '🔧' }
    };

    let articles = Store.getArticlesSpecifiques();

    // Filtre recherche
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      articles = articles.filter(a => {
        const ch = Store.state.chantiers.find(c => c.id === a.chantierId);
        return (a.designation || '').toLowerCase().includes(q) ||
               (ch?.titre || '').toLowerCase().includes(q) ||
               (ch?.numero || '').toLowerCase().includes(q);
      });
    }

    // Séparer : articles de chantier (non libres) / stock atelier non assigné (libres)
    const articlesChantier = articles.filter(a => !a.libre)
      .sort((a, b) => {
        const order = { 'a-commander': 0, 'commande': 1, 'livre': 2, 'pose': 3 };
        return (order[a.statut] ?? 9) - (order[b.statut] ?? 9);
      });
    const articlesLibres = articles.filter(a => a.libre);

    const enAttente = articlesChantier.filter(a => a.statut === 'a-commander' || a.statut === 'commande').length;
    const enAtelier = articlesChantier.filter(a => a.statut === 'livre').length + articlesLibres.length;
    const totalValue = articlesChantier.reduce((s, a) => s + (a.quantite * (a.prixUnitaire || 0)), 0);

    content.innerHTML = `
      <div class="stock-summary">
        <div class="stat-card">
          <div class="stat-card__label">Articles spécifiques</div>
          <div class="stat-card__value">${articlesChantier.length}</div>
        </div>
        <div class="stat-card ${enAttente > 0 ? 'stat-card--warning' : ''}">
          <div class="stat-card__label">En attente</div>
          <div class="stat-card__value">${enAttente}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">📦 En atelier</div>
          <div class="stat-card__value">${enAtelier}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Valeur HT</div>
          <div class="stat-card__value">${Format.euro(totalValue)}</div>
        </div>
      </div>

      <div class="commandes-chantier-info">
        ℹ️ Suivi des articles sur-mesure (vitrage, store, porte...) commandés pour un chantier précis.
        Cycle : 📝 À commander → 📦 Commandé → ✅ Livré → 🔧 Posé. Le surplus non posé peut être remis en stock atelier.
        <button class="btn btn--primary btn--sm" id="addArticleBtn" style="margin-top:var(--s-2)">+ Nouvel article spécifique</button>
      </div>

      ${articlesChantier.length === 0 && articlesLibres.length === 0 ? UI.emptyState({
        icon: '🏗️',
        title: 'Aucun article spécifique',
        message: searchQuery ? 'Aucun résultat pour cette recherche.' : 'Ajoutez les articles sur-mesure de vos chantiers (vitrage, store, porte spéciale...).',
        action: !searchQuery ? '<button class="btn btn--primary" onclick="document.getElementById(\'addArticleBtn\')?.click()">+ Nouvel article</button>' : ''
      }) : `
        ${articlesChantier.length > 0 ? ['a-commander', 'commande', 'livre', 'pose'].map(st => {
          const group = articlesChantier.filter(a => a.statut === st);
          if (group.length === 0) return '';
          const info = STATUTS[st];
          const valeurGroupe = group.reduce((s, a) => s + (a.quantite * (a.prixUnitaire || 0)), 0);
          return `
            <div class="art-section-title" style="margin-top:var(--s-4)">
              ${info.icon} ${info.label}
              <span class="art-section-count">${group.length}</span>
              <span class="art-section-value">${Format.euro(valeurGroupe)}</span>
            </div>
            <div class="art-list">
              ${group.map(a => renderArticleCard(a, STATUTS)).join('')}
            </div>
          `;
        }).join('') : ''}

        ${articlesLibres.length > 0 ? `
          <div class="art-section-title" style="margin-top:var(--s-4)">🏭 Stock atelier (non assigné)</div>
          <p class="hint" style="margin-bottom:var(--s-2)">Articles livrés non posés, remis en stock. Réutilisables sur un autre chantier.</p>
          <div class="art-list">
            ${articlesLibres.map(a => renderArticleCard(a, STATUTS)).join('')}
          </div>
        ` : ''}
      `}
    `;

    document.getElementById('addArticleBtn')?.addEventListener('click', () => openArticleForm());
    bindArticleCards(content, STATUTS);
  }

  function renderArticleCard(a, STATUTS) {
    const chantier = Store.state.chantiers.find(c => c.id === a.chantierId);
    const conducteur = Store.state.personnel.find(p => p.id === a.conducteurId);
    const fournisseur = Store.state.fournisseurs.find(f => f.id === a.fournisseurId);
    const st = STATUTS[a.statut] || { label: a.statut, cls: '', icon: '' };
    const totalHT = a.quantite * (a.prixUnitaire || 0);

    return `
      <div class="art-card" data-art-id="${a.id}">
        <div class="art-card__head">
          <div>
            <strong class="art-card__desc">${Helpers.esc(a.designation)}</strong>
            <span class="badge ${st.cls}">${st.icon} ${st.label}</span>
          </div>
          <span class="art-card__qte mono">${a.quantite}${a.statut === 'pose' && a.quantitePosee != null ? ` (posé ${a.quantitePosee})` : ''}</span>
        </div>
        <div class="art-card__body">
          ${chantier ? `<div>🏗️ <strong>${Helpers.esc(chantier.numero)}</strong> — ${Helpers.esc(chantier.titre)}</div>` : (a.libre ? '<div class="hint">Non assigné (stock atelier)</div>' : '')}
          ${conducteur ? `<div class="hint">👤 ${Helpers.esc([conducteur.prenom, conducteur.nom].filter(Boolean).join(' ') || conducteur.nom)}</div>` : ''}
          ${fournisseur ? `<div class="hint">🏢 ${Helpers.esc(fournisseur.nom)}</div>` : ''}
          ${totalHT > 0 ? `<div class="hint">💶 ${Format.euro(totalHT)} HT</div>` : ''}
        </div>
        <div class="art-card__actions">
          ${renderArticleActions(a)}
          <button class="btn-icon" data-art-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-art-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function renderArticleActions(a) {
    if (a.libre) {
      return `<button class="btn btn--ghost btn--sm" data-art-assign>→ Assigner à un chantier</button>`;
    }
    switch (a.statut) {
      case 'a-commander':
        return `<button class="btn btn--ghost btn--sm" data-art-next="commande">📦 Marquer commandé</button>`;
      case 'commande':
        return `<button class="btn btn--ghost btn--sm" data-art-next="livre">✅ Marquer livré</button>`;
      case 'livre':
        return `<button class="btn btn--primary btn--sm" data-art-poser>🔧 Marquer posé</button>`;
      default:
        return '';
    }
  }

  function bindArticleCards(content, STATUTS) {
    content.querySelectorAll('[data-art-id]').forEach(card => {
      const id = card.dataset.artId;

      card.querySelector('[data-art-edit]')?.addEventListener('click', () => openArticleForm(id));
      card.querySelector('[data-art-delete]')?.addEventListener('click', () => {
        Modal.confirm({
          title: 'Supprimer cet article ?',
          message: 'Cette action est irréversible.',
          danger: true,
          onConfirm: () => {
            Store.deleteArticleSpecifique(id);
            Toast.success('Article supprimé');
            renderContent();
          }
        });
      });

      card.querySelector('[data-art-next]')?.addEventListener('click', (e) => {
        const statut = e.currentTarget.dataset.artNext;
        Store.setStatutArticle(id, statut);
        Toast.success('Statut mis à jour');
        renderContent();
      });

      card.querySelector('[data-art-poser]')?.addEventListener('click', () => openPoserForm(id));
      card.querySelector('[data-art-assign]')?.addEventListener('click', () => openAssignForm(id));
    });
  }

  function openArticleForm(articleId = null) {
    const existing = articleId ? Store.getArticlesSpecifiques().find(a => a.id === articleId) : null;
    const a = existing || { designation: '', quantite: 1, chantierId: null, conducteurId: null, fournisseurId: null, prixUnitaire: 0, statut: 'a-commander' };

    const chantiers = (Store.state.chantiers || []).filter(c => Helpers.computeStatus(c) !== 'termine');
    const conducteurs = (Store.state.personnel || []).filter(p => p.role === 'conducteur' || p.role === 'chef');
    const fournisseurs = Store.state.fournisseurs || [];

    Modal.open({
      title: existing ? 'Modifier l\'article' : '🏗️ Nouvel article spécifique',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Désignation *</label>
            <input id="art_desc" class="form-input" value="${Helpers.esc(a.designation)}" placeholder="Ex: Vitrage 44.2 feuilleté 120×150, Store BSO gris 200cm..." autofocus>
          </div>
          <div class="form-field">
            <label>Quantité *</label>
            <input id="art_qte" class="form-input mono" type="number" min="1" step="1" value="${a.quantite}">
          </div>
          <div class="form-field">
            <label>Prix unitaire (€ HT)</label>
            <input id="art_prix" class="form-input mono" type="number" min="0" step="0.01" value="${a.prixUnitaire || 0}">
          </div>
          <div class="form-field form-field--full">
            <label>Chantier *</label>
            <select id="art_chantier" class="form-select">
              <option value="">— Choisir —</option>
              ${chantiers.map(c => `<option value="${c.id}" ${a.chantierId === c.id ? 'selected' : ''}>${Helpers.esc(c.numero)} — ${Helpers.esc(c.titre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Conducteur</label>
            <select id="art_cond" class="form-select">
              <option value="">— Aucun —</option>
              ${conducteurs.map(p => `<option value="${p.id}" ${a.conducteurId === p.id ? 'selected' : ''}>${Helpers.esc([p.prenom, p.nom].filter(Boolean).join(' ') || p.nom)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Fournisseur</label>
            <select id="art_four" class="form-select">
              <option value="">— Aucun —</option>
              ${fournisseurs.map(f => `<option value="${f.id}" ${a.fournisseurId === f.id ? 'selected' : ''}>${Helpers.esc(f.nom)}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="artSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.getElementById('artSave').addEventListener('click', () => {
          const data = {
            designation: document.getElementById('art_desc').value.trim(),
            quantite: parseInt(document.getElementById('art_qte').value) || 1,
            prixUnitaire: parseFloat(document.getElementById('art_prix').value) || 0,
            chantierId: document.getElementById('art_chantier').value || null,
            conducteurId: document.getElementById('art_cond').value || null,
            fournisseurId: document.getElementById('art_four').value || null
          };
          if (!data.designation) { Toast.warning('La désignation est requise'); return; }
          if (!data.chantierId) { Toast.warning('Choisissez un chantier'); return; }
          if (existing) {
            Store.updateArticleSpecifique(existing.id, data);
            Toast.success('Article mis à jour');
          } else {
            Store.addArticleSpecifique(data);
            Toast.success('Article créé');
          }
          Modal.close();
          renderContent();
        });
      }
    });
  }

  function openPoserForm(articleId) {
    const a = Store.getArticlesSpecifiques().find(x => x.id === articleId);
    if (!a) return;

    Modal.open({
      title: '🔧 Marquer comme posé',
      size: 'small',
      body: `
        <p class="hint" style="margin-bottom:var(--s-2)">${Helpers.esc(a.designation)} — quantité commandée : <strong>${a.quantite}</strong></p>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Quantité réellement posée *</label>
            <input id="pose_qte" class="form-input mono" type="number" min="0" max="${a.quantite}" step="1" value="${a.quantite}" autofocus>
            <p class="hint" style="margin-top:4px">S'il reste un surplus non posé, vous pourrez le remettre en stock atelier.</p>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="poseSave">Valider</button>
      `,
      onOpen: () => {
        document.getElementById('poseSave').addEventListener('click', () => {
          const qtePosee = parseInt(document.getElementById('pose_qte').value);
          if (isNaN(qtePosee) || qtePosee < 0) { Toast.warning('Quantité invalide'); return; }
          if (qtePosee > a.quantite) { Toast.warning('La quantité posée ne peut dépasser la quantité commandée'); return; }

          const surplus = Store.posarArticle(articleId, qtePosee);
          Modal.close();

          if (surplus > 0) {
            Modal.confirm({
              title: `Surplus de ${surplus} article(s)`,
              message: `Vous avez posé ${qtePosee} sur ${a.quantite}. Voulez-vous remettre le surplus (${surplus}) en stock atelier non assigné ?`,
              confirmLabel: 'Remettre en stock',
              onConfirm: () => {
                Store.remettreEnStockArticle(articleId, surplus);
                Toast.success(`${surplus} article(s) remis en stock atelier`);
                renderContent();
              },
              onCancel: () => { renderContent(); }
            });
          } else {
            Toast.success('Article posé');
            renderContent();
          }
        });
      }
    });
  }

  function openAssignForm(articleId) {
    const a = Store.getArticlesSpecifiques().find(x => x.id === articleId);
    if (!a) return;
    const chantiers = (Store.state.chantiers || []).filter(c => Helpers.computeStatus(c) !== 'termine');

    Modal.open({
      title: '→ Assigner à un chantier',
      size: 'small',
      body: `
        <p class="hint" style="margin-bottom:var(--s-2)">${Helpers.esc(a.designation)} (${a.quantite})</p>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Chantier *</label>
            <select id="assign_chantier" class="form-select">
              <option value="">— Choisir —</option>
              ${chantiers.map(c => `<option value="${c.id}">${Helpers.esc(c.numero)} — ${Helpers.esc(c.titre)}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="assignSave">Assigner</button>
      `,
      onOpen: () => {
        document.getElementById('assignSave').addEventListener('click', () => {
          const chantierId = document.getElementById('assign_chantier').value;
          if (!chantierId) { Toast.warning('Choisissez un chantier'); return; }
          Store.updateArticleSpecifique(articleId, { chantierId, libre: false, statut: 'livre' });
          Toast.success('Article assigné au chantier');
          Modal.close();
          renderContent();
        });
      }
    });
  }

  function renderStockRow(f, isAtelier, equipe) {
    const qte = isAtelier ? (Store.state.stockAtelier[f.id] || 0) : (Store.state.stockCamions[activeTab]?.[f.id] || 0);
    const seuil = f.seuilAlerte || 0;
    const max = Math.max(seuil * 3, qte, 10);
    const pct = Math.min(100, (qte / max) * 100);
    const alert = qte <= seuil;
    const value = qte * (f.prixUnitaire || 0);

    // Réservations "à venir" (uniquement pour l'atelier)
    const aVenir = isAtelier && Store.getReserveAVenir ? Store.getReserveAVenir(f.id) : 0;
    const manque = aVenir > qte ? Math.ceil((aVenir - qte) * 100) / 100 : 0;

    return `
      <tr data-fourniture="${f.id}" class="${alert ? 'stock-row--alert' : ''}">
        <td>
          <div class="stock-name">
            <strong>${Helpers.esc(f.nom)}</strong>
            ${f.reference ? `<span class="mono small">${Helpers.esc(f.reference)}</span>` : ''}
          </div>
        </td>
        <td>${f.categorie ? `<span class="badge badge--info">${Helpers.esc(f.categorie)}</span>` : '—'}</td>
        <td>${Helpers.esc(f.unite || 'pcs')}</td>
        <td>
          <strong class="mono ${alert ? 'text-danger' : ''}">${Format.num(qte)}</strong>
          ${aVenir > 0 ? `<div class="stock-avenir" title="Réservé par des chantiers prévus">à venir −${Format.num(aVenir)}</div>` : ''}
          ${manque > 0 ? `<div class="stock-manque" title="Le stock ne suffira pas pour les chantiers prévus">⚠️ commander ${Format.num(manque)}</div>` : ''}
        </td>
        <td>
          <div class="stock-bar">
            <div class="stock-bar__fill ${alert ? 'stock-bar__fill--alert' : ''}" style="width:${pct}%"></div>
          </div>
        </td>
        <td class="mono small">${seuil}</td>
        <td class="mono">${Format.euro(value)}</td>
        <td class="actions-cell">
          ${f.lien ? `<a class="btn-icon btn-icon--link" href="${Helpers.esc(f.lien)}" target="_blank" rel="noopener noreferrer" title="Voir le produit">🔗</a>` : ''}
          <button class="btn-icon" data-stk-action="in" title="Entrée">➕</button>
          <button class="btn-icon" data-stk-action="out" title="Sortie">➖</button>
          <button class="btn-icon" data-stk-action="transfer" title="Transfert">⇄</button>
          <button class="btn-icon" data-stk-action="edit" title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-stk-action="delete" title="Supprimer">🗑</button>
        </td>
      </tr>
    `;
  }

  function openAddFourniture(id = null) {
    const existing = id ? Store.state.fournitures.find(f => f.id === id) : null;
    const f = existing || { nom: '', reference: '', categorie: '', unite: 'pcs', prixUnitaire: 0, seuilAlerte: 5 };

    Modal.open({
      title: existing ? 'Modifier la fourniture' : 'Nouvelle fourniture',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(f.nom)}" autofocus>
          </div>
          <div class="form-field">
            <label>Référence</label>
            <input id="f_ref" class="form-input mono" value="${Helpers.esc(f.reference || '')}">
          </div>
          <div class="form-field">
            <label>Catégorie</label>
            <select id="f_cat" class="form-select">
              ${['', 'Vitrage', 'Joint', 'Visserie', 'Bois', 'Store', 'Quincaillerie', 'Consommable', 'Autre']
                .map(c => `<option value="${c}" ${f.categorie === c ? 'selected' : ''}>${c || '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Unité</label>
            <select id="f_unite" class="form-select">
              ${['pcs', 'm', 'm²', 'kg', 'L', 'boîte'].map(u =>
                `<option value="${u}" ${f.unite === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Prix unitaire (€)</label>
            <input id="f_prix" class="form-input mono" type="number" step="0.01" min="0" value="${f.prixUnitaire || 0}">
          </div>
          <div class="form-field">
            <label>Seuil d'alerte</label>
            <input id="f_seuil" class="form-input mono" type="number" min="0" value="${f.seuilAlerte || 0}">
          </div>
          <div class="form-field form-field--full">
            <label>Lien vers le produit (optionnel)</label>
            <input id="f_lien" class="form-input" type="url" placeholder="https://..." value="${Helpers.esc(f.lien || '')}">
            <p class="hint" style="margin-top:4px">Lien vers la page du produit chez le fournisseur. Un bouton 🔗 apparaîtra sur la ligne du stock.</p>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="fSave">${existing ? 'Mettre à jour' : 'Créer'}</button>
      `,
      onOpen: () => {
        document.getElementById('fSave').addEventListener('click', () => {
          const data = {
            nom: document.getElementById('f_nom').value.trim(),
            reference: document.getElementById('f_ref').value.trim(),
            categorie: document.getElementById('f_cat').value,
            unite: document.getElementById('f_unite').value,
            prixUnitaire: parseFloat(document.getElementById('f_prix').value) || 0,
            seuilAlerte: parseInt(document.getElementById('f_seuil').value) || 0,
            lien: document.getElementById('f_lien').value.trim()
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateFourniture(existing.id, data);
            Toast.success('Fourniture mise à jour');
          } else {
            Store.addFourniture(data);
            Toast.success('Fourniture créée');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openMouvement(fournitureId, type) {
    const f = Store.state.fournitures.find(f => f.id === fournitureId);
    if (!f) return;
    const isAtelier = activeTab === 'atelier';
    const current = isAtelier ? (Store.state.stockAtelier[fournitureId] || 0)
                              : (Store.state.stockCamions[activeTab]?.[fournitureId] || 0);

    Modal.open({
      title: `${type === 'entree' ? '➕ Entrée' : '➖ Sortie'} — ${f.nom}`,
      size: 'small',
      body: `
        <p class="hint">Stock actuel : <strong class="mono">${current} ${f.unite}</strong></p>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Quantité *</label>
            <input id="m_qte" class="form-input mono" type="number" min="1" placeholder="0" autofocus>
          </div>
          <div class="form-field form-field--full">
            <label>Motif</label>
            <input id="m_motif" class="form-input" placeholder="${type === 'entree' ? 'Livraison fournisseur, retour chantier...' : 'Utilisation chantier...'}">
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="mSave">Valider</button>
      `,
      onOpen: () => {
        document.getElementById('mSave').addEventListener('click', () => {
          const qte = parseInt(document.getElementById('m_qte').value);
          const motif = document.getElementById('m_motif').value.trim();
          if (!qte || qte <= 0) { Toast.warning('Quantité invalide'); return; }
          const delta = type === 'entree' ? qte : -qte;
          const newQte = current + delta;
          if (newQte < 0) { Toast.warning('Stock insuffisant'); return; }

          if (isAtelier) Store.setStockAtelier(fournitureId, newQte);
          else Store.setStockCamion(activeTab, fournitureId, newQte);

          Store.addMouvement({
            fournitureId, type,
            quantite: qte,
            emplacement: isAtelier ? 'atelier' : activeTab,
            motif,
            date: new Date().toISOString()
          });

          Toast.success(`${type === 'entree' ? 'Entrée' : 'Sortie'} enregistrée`);
          Modal.close();
          renderContent();
        });
      }
    });
  }

  function openTransfert(fournitureId) {
    const f = Store.state.fournitures.find(f => f.id === fournitureId);
    if (!f) return;
    const current = activeTab === 'atelier' ? (Store.state.stockAtelier[fournitureId] || 0)
                                            : (Store.state.stockCamions[activeTab]?.[fournitureId] || 0);
    const sourceLabel = activeTab === 'atelier' ? 'Atelier' : Store.state.equipes.find(e => e.id === activeTab)?.nom;
    const destinations = ['atelier', ...Store.state.equipes.map(e => e.id)].filter(d => d !== activeTab);

    Modal.open({
      title: `⇄ Transfert — ${f.nom}`,
      size: 'small',
      body: `
        <p class="hint">Disponible dans ${sourceLabel} : <strong class="mono">${current} ${f.unite}</strong></p>
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Destination *</label>
            <select id="t_dest" class="form-select">
              ${destinations.map(d => {
                const label = d === 'atelier' ? '🏭 Atelier' : `🚚 ${Store.state.equipes.find(e => e.id === d)?.nom}`;
                return `<option value="${d}">${label}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label>Quantité *</label>
            <input id="t_qte" class="form-input mono" type="number" min="1" max="${current}" autofocus>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="tSave">Transférer</button>
      `,
      onOpen: () => {
        document.getElementById('tSave').addEventListener('click', () => {
          const qte = parseInt(document.getElementById('t_qte').value);
          const dest = document.getElementById('t_dest').value;
          if (!qte || qte <= 0 || qte > current) { Toast.warning('Quantité invalide'); return; }

          // Sortie source
          if (activeTab === 'atelier') Store.setStockAtelier(fournitureId, current - qte);
          else Store.setStockCamion(activeTab, fournitureId, current - qte);

          // Entrée dest
          const destCurrent = dest === 'atelier' ? (Store.state.stockAtelier[fournitureId] || 0)
                                                 : (Store.state.stockCamions[dest]?.[fournitureId] || 0);
          if (dest === 'atelier') Store.setStockAtelier(fournitureId, destCurrent + qte);
          else Store.setStockCamion(dest, fournitureId, destCurrent + qte);

          Store.addMouvement({
            fournitureId, type: 'transfert',
            quantite: qte,
            emplacement: activeTab,
            destination: dest,
            date: new Date().toISOString()
          });

          Toast.success('Transfert effectué');
          Modal.close();
          renderContent();
        });
      }
    });
  }

  function deleteFourniture(id) {
    Modal.confirm({
      title: 'Supprimer cette fourniture ?',
      message: 'Tous les stocks et mouvements associés seront perdus.',
      danger: true,
      onConfirm: () => {
        Store.deleteFourniture(id);
        Toast.success('Fourniture supprimée');
        if (window.Router) Router.refresh();
      }
    });
  }

  function openMouvements() {
    const mvts = [...Store.state.mouvements].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
    Modal.open({
      title: '📋 Historique des mouvements',
      size: 'large',
      body: mvts.length === 0 ? '<p class="hint">Aucun mouvement enregistré.</p>' : `
        <table class="table">
          <thead><tr><th>Date</th><th>Type</th><th>Fourniture</th><th>Qté</th><th>Emplacement</th><th>Motif</th></tr></thead>
          <tbody>
            ${mvts.map(m => {
              const f = Store.state.fournitures.find(x => x.id === m.fournitureId);
              const empLabel = m.emplacement === 'atelier' ? '🏭 Atelier' : `🚚 ${Store.state.equipes.find(e => e.id === m.emplacement)?.nom || '?'}`;
              const typeLabel = { entree: '➕ Entrée', sortie: '➖ Sortie', transfert: '⇄ Transfert' }[m.type] || m.type;
              return `<tr>
                <td>${Format.dateShort(m.date)}</td>
                <td>${typeLabel}</td>
                <td>${Helpers.esc(f?.nom || '?')}</td>
                <td class="mono">${m.quantite}</td>
                <td>${empLabel}</td>
                <td>${Helpers.esc(m.motif || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `,
      footer: `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
    });
  }

  // ============================================================
  // EXPORT MOUVEMENTS (choix période + format)
  // ============================================================
  function openExportMouvements() {
    const mvts = Store.state.mouvements || [];
    // Années disponibles
    const annees = [...new Set(mvts.map(m => new Date(m.date).getFullYear()))].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!annees.includes(currentYear)) annees.unshift(currentYear);

    const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    Modal.open({
      title: '📥 Exporter les mouvements',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Période</label>
            <select id="exp_periode" class="form-select">
              <option value="all">Tous les mouvements</option>
              <option value="year">Une année entière</option>
              <option value="month" selected>Un mois précis</option>
            </select>
          </div>

          <div class="form-field" id="exp_year_wrap">
            <label>Année</label>
            <select id="exp_year" class="form-select">
              ${annees.map(a => `<option value="${a}" ${a === currentYear ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>

          <div class="form-field" id="exp_month_wrap">
            <label>Mois</label>
            <select id="exp_month" class="form-select">
              ${MOIS.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>

          <div class="form-field form-field--full">
            <label>Format</label>
            <div class="export-format-choice">
              <label class="export-format-option">
                <input type="radio" name="exp_format" value="pdf" checked>
                <span class="export-format-icon">📄</span>
                <span>PDF</span>
              </label>
              <label class="export-format-option">
                <input type="radio" name="exp_format" value="excel">
                <span class="export-format-icon">📊</span>
                <span>Excel</span>
              </label>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="exp_go">Télécharger</button>
      `,
      onOpen: () => {
        const periodeSelect = document.getElementById('exp_periode');
        const yearWrap = document.getElementById('exp_year_wrap');
        const monthWrap = document.getElementById('exp_month_wrap');

        const updateVisibility = () => {
          const v = periodeSelect.value;
          yearWrap.style.display = (v === 'year' || v === 'month') ? '' : 'none';
          monthWrap.style.display = (v === 'month') ? '' : 'none';
        };
        periodeSelect.addEventListener('change', updateVisibility);
        updateVisibility();

        document.getElementById('exp_go').addEventListener('click', () => {
          const periode = periodeSelect.value;
          const format = document.querySelector('input[name="exp_format"]:checked').value;
          let filter = null;

          if (periode === 'year') {
            filter = { year: parseInt(document.getElementById('exp_year').value) };
          } else if (periode === 'month') {
            filter = {
              year: parseInt(document.getElementById('exp_year').value),
              month: parseInt(document.getElementById('exp_month').value)
            };
          }

          Modal.close();
          if (format === 'pdf') {
            window.PdfExport?.mouvements(filter);
          } else {
            window.ExcelExport?.mouvements(filter);
          }
        });
      }
    });
  }

  return { render };
})();
