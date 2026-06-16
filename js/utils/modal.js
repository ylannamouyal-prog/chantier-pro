/* =================================================================
   MODAL — Système central de fenêtres modales
   ================================================================= */

const Modal = {
  _onClose: null,

  open({ title = '', body = '', footer = null, size = '', onClose = null, onOpen = null } = {}) {
    const backdrop = $('#modalBackdrop');
    const modal    = $('#modal');
    const bodyEl   = $('#modalBody');
    const titleEl  = $('#modalTitle');
    const footerEl = $('#modalFooter');

    titleEl.textContent = title;

    // Body
    bodyEl.innerHTML = '';
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);

    // Footer
    footerEl.innerHTML = '';
    if (footer) {
      if (typeof footer === 'string') footerEl.innerHTML = footer;
      else if (Array.isArray(footer)) footer.forEach(b => footerEl.appendChild(b));
      else footerEl.appendChild(footer);
    }

    // Size (alias)
    modal.classList.remove('modal--sm', 'modal--md', 'modal--lg', 'modal--xl');
    const sizeMap = { small: 'modal--sm', medium: 'modal--md', large: 'modal--lg', xl: 'modal--xl', lg: 'modal--lg' };
    if (sizeMap[size]) modal.classList.add(sizeMap[size]);

    backdrop.hidden = false;
    this._onClose = onClose;

    // onOpen callback after DOM ready
    if (typeof onOpen === 'function') {
      setTimeout(onOpen, 0);
    }

    // Améliore les menus déroulants longs avec une recherche (après le onOpen
    // pour capturer aussi les selects injectés dynamiquement par le formulaire)
    setTimeout(() => {
      try { window.SearchableSelect?.enhanceAll(bodyEl); } catch (e) { /* silencieux */ }
    }, 10);

    return { backdrop, modal, body: bodyEl, footer: footerEl };
  },

  close() {
    const backdrop = $('#modalBackdrop');
    backdrop.hidden = true;
    if (this._onClose) {
      const cb = this._onClose;
      this._onClose = null;
      cb();
    }
  },

  /** Confirmation oui/non. Supporte onConfirm callback ET Promise. */
  confirm({ title = 'Confirmation', message = '', confirmLabel = 'Confirmer', danger = false, onConfirm = null, onCancel = null } = {}) {
    return new Promise(resolve => {
      const body = el('div', { class: 'confirm-msg', html: message });
      const cancelBtn  = el('button', { class: 'btn btn--secondary' }, 'Annuler');
      const confirmBtn = el('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}` }, confirmLabel);

      cancelBtn.addEventListener('click', () => {
        Modal.close();
        if (typeof onCancel === 'function') onCancel();
        resolve(false);
      });
      confirmBtn.addEventListener('click', () => {
        Modal.close();
        if (typeof onConfirm === 'function') onConfirm();
        resolve(true);
      });

      this.open({ title, body, footer: [cancelBtn, confirmBtn] });
    });
  }
};

// Bind global close handlers - fonctionne même si DOM déjà chargé
function _bindModalHandlers() {
  $('#modalClose')?.addEventListener('click', () => Modal.close());
  $('#modalBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') Modal.close();
  });
  document.addEventListener('keydown', (e) => {
    const bd = $('#modalBackdrop');
    if (e.key === 'Escape' && bd && !bd.hidden) Modal.close();
  });
  // S'assurer que le modal est caché au démarrage
  const bd = $('#modalBackdrop');
  if (bd) bd.hidden = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bindModalHandlers);
} else {
  _bindModalHandlers();
}

window.Modal = Modal;
