/*
  ChantierPro - Synchronisation cloud (Supabase)
  ------------------------------------------------
  Stocke l'état de l'app dans une base en ligne pour :
   - synchroniser tes données entre plusieurs appareils
   - ne plus jamais les perdre (le localStorage reste en secours)
  Un seul utilisateur (toi) : connexion par email + mot de passe.
*/
window.Cloud = (function () {
  'use strict';

  // --- Configuration de TON projet Supabase ---
  const SUPABASE_URL = 'https://ahxtayasggxurzocyisc.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_hJKx5XAAxkrC9V3cqwYa4Q_XtwHPv50';

  let sb = null;          // client Supabase
  let userId = null;      // identifiant de l'utilisateur connecté
  let userEmail = null;   // email affiché dans l'indicateur
  let active = false;     // true quand connecté + données chargées
  let saveTimer = null;   // pour différer les sauvegardes (debounce)

  /** Initialise le client Supabase. Retourne null si la librairie n'est pas chargée. */
  function init() {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) {
      console.error('[Cloud] Librairie Supabase absente — mode hors-ligne (localStorage seul)');
      return null;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return sb;
  }

  /** Récupère la session en cours (ou null si non connecté). */
  async function getSession() {
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      return data && data.session ? data.session : null;
    } catch (e) {
      console.error('[Cloud] getSession', e);
      return null;
    }
  }

  /** Mémorise l'utilisateur connecté et affiche l'indicateur de synchro. */
  function beginSession(session) {
    userId = session.user.id;
    userEmail = session.user.email || '';
    mountSyncPill();
  }

  /** Connexion email + mot de passe. Lève une erreur si échec. */
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: (email || '').trim(),
      password: password || ''
    });
    if (error) throw error;
    return data;
  }

  /** Déconnexion puis rechargement de la page. */
  async function signOut() {
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    location.reload();
  }

  /** Charge l'état depuis le cloud. Retourne l'objet data (ou null s'il n'y a rien encore). */
  async function loadState() {
    if (!sb || !userId) return null;
    try {
      const { data, error } = await sb
        .from('app_state')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) { console.error('[Cloud] loadState', error); return null; }
      return data && data.data ? data.data : null;
    } catch (e) {
      console.error('[Cloud] loadState', e);
      return null;
    }
  }

  /** Sauvegarde immédiate de l'état complet dans le cloud. */
  async function saveNow(state) {
    if (!sb || !userId) return;
    setSyncStatus('saving');
    try {
      const { error } = await sb
        .from('app_state')
        .upsert({
          user_id: userId,
          data: state,
          updated_at: new Date().toISOString()
        });
      if (error) { console.error('[Cloud] saveNow', error); setSyncStatus('error'); }
      else { setSyncStatus('saved'); }
    } catch (e) {
      console.error('[Cloud] saveNow', e);
      setSyncStatus('error');
    }
  }

  /** Sauvegarde différée : appelée à chaque modif, regroupe les changements rapprochés. */
  function scheduleSave(state) {
    if (!active) return;
    setSyncStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(state), 1500);
  }

  /** Active la synchro (après le chargement initial). */
  function activate() { active = true; setSyncStatus('saved'); }
  function isReady() { return active; }

  // ============================================================
  // ÉCRAN DE CONNEXION
  // ============================================================
  function renderLogin() {
    const shell = document.getElementById('appShell');
    if (shell) shell.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.className = 'cloud-login';
    overlay.innerHTML = `
      <div class="cloud-login__card">
        <div class="cloud-login__brand">
          <div class="cloud-login__logo">🏗️</div>
          <div>
            <div class="cloud-login__name">ChantierPro</div>
            <div class="cloud-login__sub">Connexion à votre espace</div>
          </div>
        </div>
        <label class="cloud-login__label">Email</label>
        <input type="email" id="cloudEmail" class="form-input" placeholder="votre@email.com" autocomplete="username">
        <label class="cloud-login__label">Mot de passe</label>
        <input type="password" id="cloudPassword" class="form-input" placeholder="••••••••" autocomplete="current-password">
        <div class="cloud-login__error" id="cloudError" hidden></div>
        <button class="btn btn--primary cloud-login__btn" id="cloudSignIn">Se connecter</button>
        <p class="cloud-login__hint">Vos données sont synchronisées et sécurisées.</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const emailEl = document.getElementById('cloudEmail');
    const pwdEl = document.getElementById('cloudPassword');
    const errEl = document.getElementById('cloudError');
    const btn = document.getElementById('cloudSignIn');

    const showError = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

    const doLogin = async () => {
      errEl.hidden = true;
      const email = emailEl.value;
      const pwd = pwdEl.value;
      if (!email || !pwd) { showError('Renseignez votre email et votre mot de passe.'); return; }
      btn.disabled = true;
      btn.textContent = 'Connexion…';
      try {
        await signIn(email, pwd);
        btn.textContent = 'Connecté ✓';
        location.reload();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Se connecter';
        const m = (e && e.message) ? e.message.toLowerCase() : '';
        if (m.includes('invalid')) showError('Email ou mot de passe incorrect.');
        else showError('Connexion impossible. Vérifiez votre connexion internet.');
      }
    };

    btn.addEventListener('click', doLogin);
    pwdEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    emailEl.focus();
  }

  // ============================================================
  // INDICATEUR DE SYNCHRO (petit badge en bas à gauche)
  // ============================================================
  let syncEl = null;

  function mountSyncPill() {
    if (syncEl) return;
    syncEl = document.createElement('div');
    syncEl.className = 'cloud-sync';
    syncEl.innerHTML = `
      <span class="cloud-sync__dot"></span>
      <span class="cloud-sync__text">Synchronisé</span>
      <button class="cloud-sync__logout" title="Se déconnecter">⏻</button>
    `;
    document.body.appendChild(syncEl);
    syncEl.querySelector('.cloud-sync__logout').addEventListener('click', () => {
      if (confirm('Se déconnecter de ChantierPro ?')) signOut();
    });
    setSyncStatus('saved');
  }

  function setSyncStatus(status) {
    if (!syncEl) return;
    const txt = syncEl.querySelector('.cloud-sync__text');
    syncEl.classList.remove('is-saving', 'is-pending', 'is-error', 'is-saved');
    switch (status) {
      case 'pending':
        syncEl.classList.add('is-pending'); txt.textContent = 'Modifié…'; break;
      case 'saving':
        syncEl.classList.add('is-saving'); txt.textContent = 'Enregistrement…'; break;
      case 'error':
        syncEl.classList.add('is-error'); txt.textContent = 'Erreur de synchro'; break;
      case 'saved':
      default:
        syncEl.classList.add('is-saved'); txt.textContent = 'Synchronisé'; break;
    }
  }

  return {
    init, getSession, beginSession, signIn, signOut,
    loadState, saveNow, scheduleSave, activate, isReady,
    renderLogin
  };
})();
