/* =================================================================
   TOASTS — Notifications éphémères
   ================================================================= */

const Toast = {
  show({ title = '', message = '', type = 'info', duration = 3500 } = {}) {
    const container = $('#toastContainer');
    if (!container) return;

    const icons = { success: '✓', warning: '!', danger: '✕', info: 'i' };
    const t = el('div', { class: `toast toast--${type}` },
      el('div', { class: 'toast__icon' }, icons[type] || 'i'),
      el('div', { class: 'toast__content' },
        title ? el('div', { class: 'toast__title' }, title) : null,
        el('div', { class: 'toast__msg' }, message)
      ),
      el('button', { class: 'toast__close', 'aria-label': 'Fermer' }, '✕')
    );

    container.appendChild(t);

    const close = () => {
      t.style.transition = 'all 200ms';
      t.style.opacity = 0;
      t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 220);
    };

    t.querySelector('.toast__close').addEventListener('click', close);
    setTimeout(close, duration);

    return t;
  },

  success(message, title = 'Succès')   { return this.show({ type: 'success', title, message }); },
  warning(message, title = 'Attention') { return this.show({ type: 'warning', title, message }); },
  error(message, title = 'Erreur')     { return this.show({ type: 'danger', title, message }); },
  info(message, title = '')            { return this.show({ type: 'info', title, message }); }
};

window.Toast = Toast;
