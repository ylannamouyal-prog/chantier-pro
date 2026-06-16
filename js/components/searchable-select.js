// SearchableSelect — transforme un <select> en menu déroulant avec recherche
// Usage : automatique sur tous les <select class="form-select"> ayant >= 8 options.
// Ou forcé via l'attribut data-searchable. Désactivé via data-no-search.
window.SearchableSelect = (function () {

  const SEUIL_AUTO = 8; // au-delà de N options, on active la recherche automatiquement

  /**
   * Améliore tous les selects présents dans un conteneur (par défaut : document).
   * À appeler après l'ouverture d'une modale / le rendu d'un formulaire.
   */
  function enhanceAll(root = document) {
    const selects = root.querySelectorAll('select.form-select:not([data-ss-done])');
    selects.forEach(sel => {
      const force = sel.hasAttribute('data-searchable');
      const disabled = sel.hasAttribute('data-no-search');
      const optionCount = sel.querySelectorAll('option').length;
      if (disabled) return;
      if (force || optionCount >= SEUIL_AUTO) {
        enhance(sel);
      }
    });
  }

  function enhance(select) {
    if (select.dataset.ssDone) return;
    select.dataset.ssDone = '1';

    // Conteneur principal
    const wrapper = document.createElement('div');
    wrapper.className = 'ss-wrap';
    select.parentNode.insertBefore(wrapper, select);

    // On cache le vrai select (il garde la valeur pour le formulaire)
    select.style.display = 'none';
    wrapper.appendChild(select);

    // Bouton d'affichage
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ss-trigger form-input';
    wrapper.appendChild(trigger);

    // Panneau déroulant
    const panel = document.createElement('div');
    panel.className = 'ss-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ss-search-wrap">
        <input type="text" class="ss-search" placeholder="🔍 Rechercher..." autocomplete="off">
      </div>
      <div class="ss-options"></div>
    `;
    wrapper.appendChild(panel);

    const searchInput = panel.querySelector('.ss-search');
    const optionsBox = panel.querySelector('.ss-options');

    // Construit la liste d'options à partir du <select>
    const getOptions = () => Array.from(select.options).map(o => ({
      value: o.value,
      label: o.textContent,
      selected: o.selected,
      disabled: o.disabled
    }));

    const updateTriggerLabel = () => {
      const sel = select.options[select.selectedIndex];
      const label = sel ? sel.textContent : '';
      trigger.textContent = label && label.trim() ? label : '— Sélectionner —';
      trigger.classList.toggle('ss-trigger--placeholder', !label || !label.trim() || label.trim() === '—');
    };

    const renderOptions = (filter = '') => {
      const q = filter.toLowerCase().trim();
      const opts = getOptions().filter(o => !q || o.label.toLowerCase().includes(q));
      if (opts.length === 0) {
        optionsBox.innerHTML = `<div class="ss-empty">Aucun résultat</div>`;
        return;
      }
      optionsBox.innerHTML = opts.map(o => `
        <div class="ss-option ${o.selected ? 'is-selected' : ''} ${o.disabled ? 'is-disabled' : ''}"
             data-value="${escAttr(o.value)}">
          ${highlight(o.label, q)}
        </div>
      `).join('');

      optionsBox.querySelectorAll('.ss-option:not(.is-disabled)').forEach(el => {
        el.addEventListener('click', () => {
          select.value = el.dataset.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          updateTriggerLabel();
          closePanel();
        });
      });
    };

    const openPanel = () => {
      // Fermer les autres panneaux ouverts
      document.querySelectorAll('.ss-panel:not([hidden])').forEach(p => {
        if (p !== panel) { p.hidden = true; p.closest('.ss-wrap')?.querySelector('.ss-trigger')?.classList.remove('ss-trigger--open'); }
      });
      panel.hidden = false;
      trigger.classList.add('ss-trigger--open');
      searchInput.value = '';
      renderOptions();
      setTimeout(() => searchInput.focus(), 30);
      document.addEventListener('click', onOutside, true);
    };

    const closePanel = () => {
      panel.hidden = true;
      trigger.classList.remove('ss-trigger--open');
      document.removeEventListener('click', onOutside, true);
    };

    const onOutside = (e) => {
      if (!wrapper.contains(e.target)) closePanel();
    };

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (panel.hidden) openPanel();
      else closePanel();
    });

    searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePanel(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = optionsBox.querySelector('.ss-option:not(.is-disabled)');
        if (first) first.click();
      }
    });

    // Si le code change la valeur du select par programmation, on met à jour le label
    select.addEventListener('ss-refresh', updateTriggerLabel);

    updateTriggerLabel();
  }

  function highlight(text, q) {
    const safe = escHtml(text);
    if (!q) return safe;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return safe;
    const before = escHtml(text.slice(0, idx));
    const match = escHtml(text.slice(idx, idx + q.length));
    const after = escHtml(text.slice(idx + q.length));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  return { enhanceAll, enhance };
})();
