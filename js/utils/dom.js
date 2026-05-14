/* =================================================================
   DOM UTILS — Sélection et création
   ================================================================= */

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Crée un élément avec attributs et enfants */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(node.style, attrs[k]);
    else if (k.startsWith('on') && typeof attrs[k] === 'function') {
      node.addEventListener(k.substring(2).toLowerCase(), attrs[k]);
    } else if (k === 'html') node.innerHTML = attrs[k];
    else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) {
      node.setAttribute(k, attrs[k]);
    }
  }
  children.flat().forEach(c => {
    if (c === null || c === undefined || c === false) return;
    if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });
  return node;
}

/** Délégation d'événements */
function on(parent, event, selector, handler) {
  parent.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) handler.call(target, e, target);
  });
}

window.$ = $;
window.$$ = $$;
window.el = el;
window.on = on;
