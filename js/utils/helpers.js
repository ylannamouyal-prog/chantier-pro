/* =================================================================
   HELPERS — Fonctions utilitaires globales
   ================================================================= */

const Helpers = {
  /** UID compact basé sur timestamp + random */
  uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /** Capitalise première lettre */
  capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  },

  /** Initiales (max 2 chars) */
  initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  },

  /** Génère un numéro chantier CH-YYYY-NNN */
  chantierNumber(existing = []) {
    const year = new Date().getFullYear();
    const yearChantiers = existing.filter(c => c.numero?.startsWith(`CH-${year}`));
    const max = yearChantiers.reduce((m, c) => {
      const n = parseInt(c.numero.split('-')[2], 10);
      return Math.max(m, isNaN(n) ? 0 : n);
    }, 0);
    return `CH-${year}-${String(max + 1).padStart(3, '0')}`;
  },

  /** Couleur d'avatar déterministe depuis une string */
  colorFromString(s) {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#A855F7',
      '#EC4899', '#06B6D4', '#EF4444', '#8B5CF6'
    ];
    let h = 0;
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  },

  /** Debounce */
  debounce(fn, wait = 200) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  /** Deep clone via JSON (suffisant pour nos objets de données) */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** Calcule le statut d'un chantier selon ses dates */
  computeStatus(chantier) {
    // Si statut manuel "non-temporel", on le respecte
    const manual = ['en-attente-cotes', 'en-attente-devis', 'commande', 'reporte'];
    if (manual.includes(chantier.statut)) return chantier.statut;

    // Lit une date "YYYY-MM-DD" comme une date LOCALE à minuit
    // (évite le décalage de fuseau horaire qui faussait le statut).
    const toLocalDate = (s) => {
      if (!s) return null;
      const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = toLocalDate(chantier.dateDebut);
    const end   = toLocalDate(chantier.dateFin);

    if (start && end) {
      if (now < start) return 'prevu';    // pas encore commencé
      if (now > end) return 'termine';    // le jour de fin reste "en cours" ; terminé le lendemain
      return 'en-cours';                  // entre le début et la fin (bornes incluses)
    }
    return chantier.statut || 'en-attente-cotes';
  },

  /** Labels lisibles des statuts */
  statusLabel(s) {
    return ({
      'en-attente-cotes':  'En attente cotes',
      'en-attente-devis':  'En attente devis',
      'commande':          'Commandé',
      'prevu':             'Prévu',
      'en-cours':          'En cours',
      'termine':           'Terminé',
      'reporte':           'Reporté'
    })[s] || s;
  },

  /** Classes CSS de badge selon statut */
  statusBadgeClass(s) {
    return ({
      'en-attente-cotes':  'badge--pending',
      'en-attente-devis':  'badge--quote',
      'commande':          'badge--ordered',
      'prevu':             'badge--planned',
      'en-cours':          'badge--ongoing',
      'termine':           'badge--done',
      'reporte':           'badge--delayed'
    })[s] || 'badge--pending';
  },

  /** Couleur du statut */
  statusColor(s) {
    return ({
      'en-attente-cotes':  '#94A3B8',
      'en-attente-devis':  '#A855F7',
      'commande':          '#06B6D4',
      'prevu':             '#3B82F6',
      'en-cours':          '#F59E0B',
      'termine':           '#10B981',
      'reporte':           '#EF4444'
    })[s] || '#94A3B8';
  },

  /** Échappe HTML */
  esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /** Test mobile */
  isMobile() {
    return window.innerWidth < 768;
  },

  /** Télécharger un blob */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

window.Helpers = Helpers;
