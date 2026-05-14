// Module Fournisseurs
window.Fournisseurs = (function () {
  function render(container) {
    const list = Store.state.fournisseurs || [];

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">🏭 Fournisseurs</h1>
          <p class="view-subtitle">${list.length} fournisseur${list.length > 1 ? 's' : ''} référencé${list.length > 1 ? 's' : ''}</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="frnAdd">+ Nouveau fournisseur</button>
        </div>
      </div>

      ${list.length === 0 ? UI.emptyState({
        icon: '🏭', title: 'Aucun fournisseur',
        message: 'Ajoutez vos fournisseurs pour faciliter les commandes.',
        action: '<button class="btn btn--primary" onclick="Fournisseurs._add()">+ Nouveau fournisseur</button>'
      }) : `<div class="fournisseurs-grid">${list.map(renderCard).join('')}</div>`}
    `;

    document.getElementById('frnAdd')?.addEventListener('click', () => openForm());

    container.querySelectorAll('[data-fournisseur-id]').forEach(card => {
      card.querySelector('[data-frn-edit]')?.addEventListener('click', () => openForm(card.dataset.fournisseurId));
      card.querySelector('[data-frn-delete]')?.addEventListener('click', () => deleteFournisseur(card.dataset.fournisseurId));
      card.querySelector('[data-frn-view]')?.addEventListener('click', () => openDetail(card.dataset.fournisseurId));
    });
  }

  function renderCard(f) {
    const refs = (f.references || []).length;
    return `
      <div class="fournisseur-card" data-fournisseur-id="${f.id}">
        <div class="fournisseur-card__header">
          <div class="fournisseur-icon">🏭</div>
          <div>
            <h3>${Helpers.esc(f.nom)}</h3>
            ${f.categorie ? `<span class="badge badge--info">${Helpers.esc(f.categorie)}</span>` : ''}
          </div>
        </div>
        <div class="fournisseur-card__meta">
          ${f.contact ? `<div>👤 ${Helpers.esc(f.contact)}</div>` : ''}
          ${f.telephone ? `<div>📞 ${Format.phone(f.telephone)}</div>` : ''}
          ${f.email ? `<div>✉ ${Helpers.esc(f.email)}</div>` : ''}
          ${f.delaiLivraison ? `<div>⏱ Délai : ${f.delaiLivraison} jours</div>` : ''}
        </div>
        ${refs > 0 ? `<div class="fournisseur-refs">${refs} référence${refs > 1 ? 's' : ''}</div>` : ''}
        <div class="fournisseur-card__actions">
          <button class="btn btn--ghost btn--sm" data-frn-view>Détail</button>
          <button class="btn-icon" data-frn-edit title="Modifier">✎</button>
          <button class="btn-icon btn-icon--danger" data-frn-delete title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }

  function openForm(id = null) {
    const existing = id ? Store.state.fournisseurs.find(f => f.id === id) : null;
    const f = existing || { nom: '', categorie: '', contact: '', telephone: '', email: '', adresse: '', delaiLivraison: 7, notes: '' };

    Modal.open({
      title: existing ? 'Modifier le fournisseur' : 'Nouveau fournisseur',
      size: 'medium',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Nom *</label>
            <input id="f_nom" class="form-input" value="${Helpers.esc(f.nom)}" autofocus>
          </div>
          <div class="form-field">
            <label>Catégorie</label>
            <select id="f_cat" class="form-select">
              ${['', 'Vitrage', 'Quincaillerie', 'Bois', 'Stores', 'Outillage', 'Multi-produits', 'Autre']
                .map(c => `<option value="${c}" ${f.categorie === c ? 'selected' : ''}>${c || '—'}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Délai livraison (jours)</label>
            <input id="f_delai" class="form-input mono" type="number" min="0" value="${f.delaiLivraison || 7}">
          </div>
          <div class="form-field form-field--full">
            <label>Contact</label>
            <input id="f_contact" class="form-input" value="${Helpers.esc(f.contact || '')}">
          </div>
          <div class="form-field">
            <label>Téléphone</label>
            <input id="f_tel" class="form-input" value="${Helpers.esc(f.telephone || '')}">
          </div>
          <div class="form-field">
            <label>Email</label>
            <input id="f_email" class="form-input" type="email" value="${Helpers.esc(f.email || '')}">
          </div>
          <div class="form-field form-field--full">
            <label>Adresse</label>
            <input id="f_adresse" class="form-input" value="${Helpers.esc(f.adresse || '')}">
          </div>
          <div class="form-field form-field--full">
            <label>Notes</label>
            <textarea id="f_notes" class="form-textarea" rows="2">${Helpers.esc(f.notes || '')}</textarea>
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
            categorie: document.getElementById('f_cat').value,
            contact: document.getElementById('f_contact').value.trim(),
            telephone: document.getElementById('f_tel').value.trim(),
            email: document.getElementById('f_email').value.trim(),
            adresse: document.getElementById('f_adresse').value.trim(),
            delaiLivraison: parseInt(document.getElementById('f_delai').value) || 0,
            notes: document.getElementById('f_notes').value.trim()
          };
          if (!data.nom) { Toast.warning('Le nom est requis'); return; }
          if (existing) {
            Store.updateFournisseur(existing.id, data);
            Toast.success('Fournisseur mis à jour');
          } else {
            Store.addFournisseur(data);
            Toast.success('Fournisseur créé');
          }
          Modal.close();
          if (window.Router) Router.refresh();
        });
      }
    });
  }

  function openDetail(id) {
    const f = Store.state.fournisseurs.find(x => x.id === id);
    if (!f) return;

    // Suggestion de commandes : fournitures en alerte
    const enAlerte = Store.state.fournitures.filter(fr => {
      const total = Store.getStockTotal(fr.id);
      return total <= (fr.seuilAlerte || 0);
    });

    Modal.open({
      title: `🏭 ${f.nom}`,
      size: 'large',
      body: `
        <div class="detail-section">
          <h3>Informations</h3>
          <dl class="detail-list">
            ${f.categorie ? `<dt>Catégorie</dt><dd><span class="badge badge--info">${Helpers.esc(f.categorie)}</span></dd>` : ''}
            ${f.contact ? `<dt>Contact</dt><dd>${Helpers.esc(f.contact)}</dd>` : ''}
            ${f.telephone ? `<dt>Téléphone</dt><dd>${Format.phone(f.telephone)}</dd>` : ''}
            ${f.email ? `<dt>Email</dt><dd><a href="mailto:${Helpers.esc(f.email)}">${Helpers.esc(f.email)}</a></dd>` : ''}
            ${f.adresse ? `<dt>Adresse</dt><dd>${Helpers.esc(f.adresse)}</dd>` : ''}
            ${f.delaiLivraison ? `<dt>Délai</dt><dd>${f.delaiLivraison} jours</dd>` : ''}
          </dl>
        </div>
        ${f.notes ? `<div class="detail-section"><h3>Notes</h3><p>${Helpers.esc(f.notes)}</p></div>` : ''}
        ${enAlerte.length > 0 ? `
          <div class="detail-section">
            <h3>💡 Suggestions de commande</h3>
            <p class="hint">${enAlerte.length} fourniture${enAlerte.length > 1 ? 's sont' : ' est'} en dessous du seuil d'alerte :</p>
            <table class="table">
              <thead><tr><th>Fourniture</th><th>Stock total</th><th>Seuil</th><th>À commander</th></tr></thead>
              <tbody>
                ${enAlerte.slice(0, 10).map(fr => {
                  const total = Store.getStockTotal(fr.id);
                  const aCommander = Math.max(0, (fr.seuilAlerte * 3) - total);
                  return `<tr>
                    <td><strong>${Helpers.esc(fr.nom)}</strong></td>
                    <td class="mono text-danger">${total}</td>
                    <td class="mono">${fr.seuilAlerte}</td>
                    <td class="mono"><strong>${aCommander} ${fr.unite}</strong></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      `,
      footer: `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
    });
  }

  function deleteFournisseur(id) {
    Modal.confirm({
      title: 'Supprimer ce fournisseur ?',
      message: 'Cette action est irréversible.',
      danger: true,
      onConfirm: () => {
        Store.deleteFournisseur(id);
        Toast.success('Fournisseur supprimé');
        if (window.Router) Router.refresh();
      }
    });
  }

  return { render, _add: () => openForm() };
})();
