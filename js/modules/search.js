// Search global multi-entités
window.Search = (function () {
  let dropdown = null;
  let input = null;

  function init() {
    input = document.getElementById('globalSearch');
    dropdown = document.getElementById('searchResults');
    if (!input || !dropdown) return;

    input.addEventListener('input', Helpers.debounce(handleInput, 200));
    input.addEventListener('focus', handleInput);
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) hide();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { hide(); input.blur(); }
    });
  }

  function handleInput() {
    const q = input.value.trim().toLowerCase();
    if (!q || q.length < 2) { hide(); return; }

    const results = {
      chantiers: searchChantiers(q),
      clients: searchClients(q),
      fournitures: searchFournitures(q),
      fournisseurs: searchFournisseurs(q),
      engins: searchEngins(q),
      cotes: searchCotes(q)
    };

    const total = Object.values(results).reduce((s, r) => s + r.length, 0);
    if (total === 0) {
      dropdown.innerHTML = `<div class="search-empty">Aucun résultat pour "${Helpers.esc(q)}"</div>`;
    } else {
      dropdown.innerHTML = renderResults(results);
      bindResults();
    }
    show();
  }

  function searchChantiers(q) {
    return Store.state.chantiers.filter(c =>
      c.titre.toLowerCase().includes(q) ||
      c.numero.toLowerCase().includes(q) ||
      (c.ville || '').toLowerCase().includes(q) ||
      (c.adresse || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }
  function searchClients(q) {
    return Store.state.clients.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      (c.entreprise || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telephone || '').includes(q) ||
      (c.ville || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }
  function searchFournitures(q) {
    return Store.state.fournitures.filter(f =>
      f.nom.toLowerCase().includes(q) ||
      (f.reference || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }
  function searchFournisseurs(q) {
    return (Store.state.fournisseurs || []).filter(f =>
      f.nom.toLowerCase().includes(q) ||
      (f.contact || '').toLowerCase().includes(q)
    ).slice(0, 3);
  }
  function searchEngins(q) {
    return (Store.state.engins || []).filter(e =>
      e.nom.toLowerCase().includes(q) ||
      (e.type || '').toLowerCase().includes(q)
    ).slice(0, 3);
  }
  function searchCotes(q) {
    return Store.state.cotes.filter(c =>
      (c.emplacement || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }

  function renderResults(r) {
    let html = '';
    if (r.chantiers.length) {
      html += '<div class="search-section"><h4>🏗️ Chantiers</h4>';
      r.chantiers.forEach(c => {
        const status = Helpers.computeStatus(c);
        html += `<div class="search-item" data-type="chantier" data-id="${c.id}">
          <span class="search-num mono">${c.numero}</span>
          <div class="search-info"><strong>${Helpers.esc(c.titre)}</strong><span>${Helpers.esc(c.ville || '')}</span></div>
          ${UI.statusBadge(status)}
        </div>`;
      });
      html += '</div>';
    }
    if (r.clients.length) {
      html += '<div class="search-section"><h4>👥 Clients</h4>';
      r.clients.forEach(c => {
        html += `<div class="search-item" data-type="client" data-id="${c.id}">
          ${UI.avatar(c.nom, 'sm')}
          <div class="search-info"><strong>${Helpers.esc(c.nom)}</strong><span>${Helpers.esc(c.ville || c.email || '')}</span></div>
        </div>`;
      });
      html += '</div>';
    }
    if (r.fournitures.length) {
      html += '<div class="search-section"><h4>📦 Fournitures</h4>';
      r.fournitures.forEach(f => {
        html += `<div class="search-item" data-type="fourniture" data-id="${f.id}">
          <span class="search-icon">📦</span>
          <div class="search-info"><strong>${Helpers.esc(f.nom)}</strong><span class="mono">${Helpers.esc(f.reference || '')}</span></div>
        </div>`;
      });
      html += '</div>';
    }
    if (r.fournisseurs.length) {
      html += '<div class="search-section"><h4>🏭 Fournisseurs</h4>';
      r.fournisseurs.forEach(f => {
        html += `<div class="search-item" data-type="fournisseur" data-id="${f.id}">
          <span class="search-icon">🏭</span>
          <div class="search-info"><strong>${Helpers.esc(f.nom)}</strong><span>${Helpers.esc(f.contact || '')}</span></div>
        </div>`;
      });
      html += '</div>';
    }
    if (r.engins.length) {
      html += '<div class="search-section"><h4>🚜 Engins</h4>';
      r.engins.forEach(e => {
        html += `<div class="search-item" data-type="engin" data-id="${e.id}">
          <span class="search-icon">${e.icone || '🚜'}</span>
          <div class="search-info"><strong>${Helpers.esc(e.nom)}</strong><span>${Helpers.esc(e.type || '')}</span></div>
        </div>`;
      });
      html += '</div>';
    }
    if (r.cotes.length) {
      html += '<div class="search-section"><h4>📐 Cotes</h4>';
      r.cotes.forEach(c => {
        const ch = Store.state.chantiers.find(x => x.id === c.chantierId);
        html += `<div class="search-item" data-type="cote" data-id="${c.id}" data-chantier="${c.chantierId}">
          <span class="search-icon">📐</span>
          <div class="search-info"><strong>${Helpers.esc(c.emplacement)}</strong><span>${Helpers.esc(ch?.titre || '')}</span></div>
        </div>`;
      });
      html += '</div>';
    }
    return html;
  }

  function bindResults() {
    dropdown.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        const { type, id, chantier } = item.dataset;
        hide();
        input.value = '';
        switch (type) {
          case 'chantier': window.Chantiers?.openDetail(id); break;
          case 'client': window.Clients?.openDetail(id); break;
          case 'fournisseur': window.location.hash = '#/fournisseurs'; break;
          case 'fourniture': window.location.hash = '#/stocks'; break;
          case 'engin': window.location.hash = '#/engins'; break;
          case 'cote': window.location.hash = `#/cotes/${chantier}`; break;
        }
      });
    });
  }

  function show() { dropdown.classList.add('is-open'); }
  function hide() { dropdown.classList.remove('is-open'); dropdown.innerHTML = ''; }

  return { init };
})();
