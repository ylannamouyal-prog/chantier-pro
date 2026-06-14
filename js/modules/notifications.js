// Module Notifications - cloche en haut à droite avec panneau déroulant
window.Notifications = (function () {

  let isOpen = false;

  function init() {
    const btn = document.getElementById('notifBtn');
    const panel = document.getElementById('notifPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggle();
    });

    // Rafraîchir le badge au démarrage et après chaque changement du store
    refreshBadge();
    Store.subscribe(() => refreshBadge());
  }

  // Handler de clic extérieur (attaché seulement quand le panneau est ouvert)
  function handleOutsideClick(e) {
    const btn = document.getElementById('notifBtn');
    const panel = document.getElementById('notifPanel');
    if (!panel || !btn) return;
    // Si le clic est en dehors du panneau ET en dehors du bouton → fermer
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  }

  // Fermer avec la touche Échap
  function handleEscape(e) {
    if (e.key === 'Escape') close();
  }

  function refreshBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const notifs = Store.getNotifications(7);
    const count = notifs.length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  function open() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.innerHTML = renderPanel();
    panel.hidden = false;
    isOpen = true;
    bindPanelEvents();
    // Attacher les listeners de fermeture APRÈS ce cycle d'événement
    // (pour éviter que le clic d'ouverture ne déclenche immédiatement la fermeture)
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }, 0);
  }

  function close() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.hidden = true;
    isOpen = false;
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
  }

  function renderPanel() {
    const notifs = Store.getNotifications(7);

    // Séparer : demain mis en avant + reste groupé
    const tomorrow = notifs.filter(n => n.isTomorrow);
    const today = notifs.filter(n => n.isToday);
    const later = notifs.filter(n => !n.isToday && !n.isTomorrow);

    if (notifs.length === 0) {
      return `
        <div class="notif-panel__header">
          <strong>Notifications</strong>
        </div>
        <div class="notif-empty">
          <span class="notif-empty__icon">✓</span>
          <p>Rien de prévu dans les 7 prochains jours</p>
        </div>
      `;
    }

    return `
      <div class="notif-panel__header">
        <strong>Notifications</strong>
        <span class="notif-panel__count">${notifs.length} à venir (7 jours)</span>
      </div>
      <div class="notif-panel__body">
        ${today.length > 0 ? `
          <div class="notif-group">
            <div class="notif-group__title notif-group__title--urgent">⚡ Aujourd'hui</div>
            ${today.map(renderNotifItem).join('')}
          </div>
        ` : ''}
        ${tomorrow.length > 0 ? `
          <div class="notif-group">
            <div class="notif-group__title notif-group__title--tomorrow">🔆 Demain</div>
            ${tomorrow.map(renderNotifItem).join('')}
          </div>
        ` : ''}
        ${later.length > 0 ? `
          <div class="notif-group">
            <div class="notif-group__title">📅 Cette semaine</div>
            ${later.map(renderNotifItem).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderNotifItem(n) {
    return `
      <div class="notif-item" data-action-kind="${n.action.kind}" data-action-id="${n.action.id}">
        <span class="notif-item__icon" style="background:${n.color}22;color:${n.color}">${n.icon}</span>
        <div class="notif-item__content">
          <strong>${Helpers.esc(n.title)}</strong>
          ${n.subtitle ? `<span>${Helpers.esc(n.subtitle)}</span>` : ''}
        </div>
        <span class="notif-item__date">${formatRelativeDate(n)}</span>
      </div>
    `;
  }

  function formatRelativeDate(n) {
    if (n.isToday) return "Auj.";
    if (n.isTomorrow) return "Demain";
    const d = new Date(n.date);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
  }

  function bindPanelEvents() {
    document.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const kind = item.dataset.actionKind;
        const id = item.dataset.actionId;
        close();
        handleAction(kind, id);
      });
    });
  }

  function handleAction(kind, id) {
    switch (kind) {
      case 'chantier':
        location.hash = '#/chantiers';
        setTimeout(() => window.Chantiers?.openDetail?.(id), 150);
        break;
      case 'reappro':
        // Ouvrir directement le formulaire de commande pré-rempli
        location.hash = '#/commandes';
        setTimeout(() => {
          if (window.Commandes?.openFormForFourniture) {
            window.Commandes.openFormForFourniture(id);
          } else if (window.Planning?._openCreateCommandeForAlerte) {
            window.Planning._openCreateCommandeForAlerte(id);
          }
        }, 150);
        break;
      case 'absence':
        location.hash = '#/planning';
        setTimeout(() => window.Absences?.openDetail?.(id), 150);
        break;
      case 'commande':
        location.hash = '#/commandes';
        setTimeout(() => window.Commandes?.openForm?.(id), 150);
        break;
    }
  }

  return { init, refreshBadge, open, close };
})();
