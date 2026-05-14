/* =================================================================
   UI COMPONENTS — Helpers de rendu réutilisables
   ================================================================= */

const UI = {
  /** Badge de statut */
  statusBadge(statut) {
    const cls = Helpers.statusBadgeClass(statut);
    const label = Helpers.statusLabel(statut);
    return `<span class="badge ${cls}">${label}</span>`;
  },

  /** Avatar circulaire avec initiales */
  avatar(name, size = 36) {
    const color = Helpers.colorFromString(name || '?');
    return `<div class="client-avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${size * 0.4}px">${Helpers.initials(name)}</div>`;
  },

  /** État vide */
  emptyState({ icon = '○', title = 'Rien à afficher', message = '', action = null }) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${icon}</div>
        <div class="empty-state__title">${Helpers.esc(title)}</div>
        <div class="empty-state__msg">${Helpers.esc(message)}</div>
        ${action ? `<div style="margin-top:var(--s-3)">${action}</div>` : ''}
      </div>
    `;
  },

  /** Petit point coloré (équipe / conducteur) */
  colorDot(color) {
    return `<span class="color-dot" style="background:${color}"></span>`;
  },

  /** Header de vue standard */
  viewHeader({ title, subtitle = '', actions = '' }) {
    return `
      <div class="view-header">
        <div>
          <h1 class="view-title">${Helpers.esc(title)}</h1>
          ${subtitle ? `<div class="view-subtitle">${Helpers.esc(subtitle)}</div>` : ''}
        </div>
        ${actions ? `<div class="view-header__actions">${actions}</div>` : ''}
      </div>
    `;
  },

  /** Stat card */
  statCard({ label, value, sub = '', trend = null, accent = 'var(--c-primary-500)', icon = '' }) {
    const trendCls = trend === 'up' ? 'stat-card__trend--up' : trend === 'down' ? 'stat-card__trend--down' : '';
    return `
      <div class="stat-card">
        <div class="stat-card__deco" style="background:${accent}"></div>
        <div class="stat-card__label">${icon ? `<span>${icon}</span>` : ''}${Helpers.esc(label)}</div>
        <div class="stat-card__value">${value}</div>
        ${sub ? `<div class="stat-card__sub ${trendCls}">${sub}</div>` : ''}
      </div>
    `;
  }
};

window.UI = UI;
