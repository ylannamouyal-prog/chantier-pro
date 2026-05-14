/* =================================================================
   FORMAT — Formatages dates, nombres, devises
   ================================================================= */

const Format = {
  /** Date ISO → "12 mai 2026" */
  date(d) {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  /** Date courte "12/05/2026" */
  dateShort(d) {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('fr-FR');
  },

  /** Date longue "lundi 12 mai 2026" */
  dateLong(d) {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  },

  /** ISO YYYY-MM-DD pour input type=date */
  dateISO(d) {
    if (!d) return '';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return '';
    return date.toISOString().split('T')[0];
  },

  /** Plage de dates */
  dateRange(start, end) {
    if (!start && !end) return '—';
    if (!end || start === end) return this.date(start);
    return `${this.date(start)} → ${this.date(end)}`;
  },

  /** Nombre avec séparateurs FR */
  num(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  /** Devise euros */
  euro(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  },

  /** Dimensions mm → "1200 × 800 mm" */
  dim(largeur, hauteur) {
    return `${this.num(largeur)} × ${this.num(hauteur)} mm`;
  },

  /** Surface m² depuis mm */
  surface(largeur, hauteur) {
    if (!largeur || !hauteur) return 0;
    return (largeur * hauteur) / 1_000_000;
  },

  /** Téléphone FR */
  phone(p) {
    if (!p) return '';
    const clean = p.replace(/\D/g, '');
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    return p;
  },

  /** Pluralisation simple */
  plural(n, singular, plural = null) {
    return `${n} ${n > 1 ? (plural || singular + 's') : singular}`;
  }
};

window.Format = Format;
