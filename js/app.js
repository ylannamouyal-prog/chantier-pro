// ChantierPro - Application principale & Router
(function () {
  'use strict';

  const ROUTES = {
    '/dashboard': { module: 'Dashboard', title: 'Tableau de bord', nav: 'dashboard' },
    '/planning': { module: 'Planning', title: 'Planning', nav: 'planning' },
    '/chantiers': { module: 'Chantiers', title: 'Chantiers', nav: 'chantiers' },
    '/cotes': { module: 'Cotes', title: 'Prises de cotes', nav: 'cotes', needsParam: true },
    '/clients': { module: 'Clients', title: 'Clients', nav: 'clients' },
    '/stocks': { module: 'Stocks', title: 'Stocks', nav: 'stocks' },
    '/engins': { module: 'Engins', title: 'Engins', nav: 'engins' },
    '/modeles': { module: 'Modeles', title: 'Modèles de chantier', nav: 'modeles' },
    '/fournisseurs': { module: 'Fournisseurs', title: 'Fournisseurs', nav: 'fournisseurs' },
    '/commandes': { module: 'Commandes', title: 'Commandes', nav: 'commandes' },
    '/equipes': { module: 'Equipes', title: 'Équipes', nav: 'equipes' },
    '/personnel': { module: 'Personnel', title: 'Personnel', nav: 'personnel' },
    '/parametres': { module: 'Parametres', title: 'Paramètres', nav: 'parametres' }
  };

  const Router = {
    current: null,
    currentParam: null,

    parse() {
      const hash = location.hash.slice(1) || '/dashboard';
      const parts = hash.split('/').filter(Boolean);
      const path = '/' + (parts[0] || 'dashboard');
      const param = parts[1] || null;
      return { path, param };
    },

    route() {
      const { path, param } = this.parse();
      const route = ROUTES[path];
      if (!route) { location.hash = '#/dashboard'; return; }

      this.current = path;
      this.currentParam = param;

      // Active nav
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('is-active', el.dataset.route === route.nav);
      });

      // Title
      document.title = `${route.title} — ChantierPro`;

      // Mobile : close sidebar
      document.getElementById('sidebar')?.classList.remove('is-open');

      const view = document.getElementById('view');
      view.innerHTML = '<div class="view-loading"><div class="loader"></div></div>';

      // Render after micro-task
      setTimeout(() => {
        const mod = window[route.module];
        if (!mod || typeof mod.render !== 'function') {
          view.innerHTML = `<div class="empty-state"><h2>Module ${route.module} non chargé</h2></div>`;
          return;
        }
        try {
          if (route.needsParam) mod.render(view, param);
          else mod.render(view);
          // Améliore les menus déroulants longs présents dans la vue (filtres, etc.)
          setTimeout(() => { try { window.SearchableSelect?.enhanceAll(view); } catch (e) {} }, 20);
        } catch (err) {
          console.error(err);
          view.innerHTML = `<div class="empty-state"><h2>Erreur</h2><p>${err.message}</p></div>`;
        }
      }, 30);
    },

    refresh() {
      this.route();
    },

    navigate(path) {
      location.hash = '#' + path;
    }
  };

  window.Router = Router;

  // Theme management
  function applyTheme(theme) {
    let actual = theme;
    if (theme === 'auto' || !theme) {
      actual = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', actual);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = actual === 'dark' ? '☀️' : '🌙';
  }
  window.applyTheme = applyTheme;

  function bindSidebar() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        Router.navigate('/' + item.dataset.route);
      });
    });
  }

  function bindHeader() {
    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      Store.commit('theme', state => {
        if (!state.parametres) state.parametres = {};
        state.parametres.theme = next;
      });
      applyTheme(next);
    });

    // Quick menu
    const quickBtn = document.getElementById('quickAddBtn');
    const quickMenu = document.getElementById('quickMenu');
    if (quickBtn && quickMenu) {
      quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickMenu.classList.toggle('is-open');
      });
      document.addEventListener('click', (e) => {
        if (!quickBtn.contains(e.target) && !quickMenu.contains(e.target)) {
          quickMenu.classList.remove('is-open');
        }
      });
      quickMenu.querySelectorAll('[data-action]').forEach(item => {
        item.addEventListener('click', () => {
          quickMenu.classList.remove('is-open');
          const action = item.dataset.action;
          switch (action) {
            case 'new-chantier': window.Chantiers?.openCreate?.(); break;
            case 'new-rdv': window.RendezVous?.openForm?.(); break;
            case 'new-client': window.Clients?.openCreate?.(); break;
            case 'new-cote': Router.navigate('/chantiers'); Toast.info('Sélectionnez un chantier pour ses cotes'); break;
            case 'new-fourniture': Router.navigate('/stocks'); break;
            case 'new-engin': Router.navigate('/engins'); break;
            case 'new-commande': window.Commandes?.openForm?.(); break;
          }
        });
      });
    }

    // Mobile menu
    document.getElementById('menuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      sidebar.classList.toggle('is-open');
      // Ajoute/retire l'overlay
      let overlay = document.querySelector('.sidebar-overlay');
      if (sidebar.classList.contains('is-open')) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          overlay.addEventListener('click', () => {
            sidebar.classList.remove('is-open');
            overlay.remove();
          });
          document.body.appendChild(overlay);
        }
      } else {
        overlay?.remove();
      }
    });

    // Fermer la sidebar quand on clique sur un lien (mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          document.getElementById('sidebar')?.classList.remove('is-open');
          document.querySelector('.sidebar-overlay')?.remove();
        }
      });
    });

    // Search
    window.Search?.init();
    window.Notifications?.init();
    document.getElementById('journalBtn')?.addEventListener('click', () => window.Journal?.open());
  }

  function updateBadges() {
    const enCours = Store.state.chantiers.filter(c => Helpers.computeStatus(c) === 'en-cours').length;
    const badge = document.getElementById('badgeChantiers');
    if (badge) {
      badge.textContent = enCours;
      badge.style.display = enCours > 0 ? 'inline-flex' : 'none';
    }
  }

  async function boot() {
    // --- Synchro cloud : vérifie la connexion avant de démarrer l'app ---
    const client = (window.Cloud && Cloud.init) ? Cloud.init() : null;

    if (!client) {
      // Librairie cloud absente → mode hors-ligne (localStorage seul)
      Store.load();
      bootApp();
      return;
    }

    const session = await Cloud.getSession();
    if (!session) {
      // Pas connecté → écran de connexion, on ne démarre pas l'app
      Cloud.renderLogin();
      return;
    }

    // Connecté : on charge les données
    Cloud.beginSession(session);
    Store.load(); // base locale (secours)
    const cloudData = await Cloud.loadState();
    if (cloudData && Object.keys(cloudData).length > 0) {
      // Le cloud fait foi (synchro entre appareils)
      Store.hydrate(cloudData);
    } else {
      // Cloud vide (1re fois) → on y envoie tes données locales actuelles
      await Cloud.saveNow(Store.state);
    }
    Cloud.activate(); // à partir de maintenant, chaque modif part au cloud
    bootApp();
  }

  function bootApp() {
    // 2) If empty, load demo
    if (Store.state.chantiers.length === 0 && Store.state.clients.length === 0) {
      Store.loadDemoData();
    }
    // 2bis) Migration : conducteurs + membres équipes → personnel
    if (typeof Store.migrateConducteursToPersonnel === 'function') {
      const migrated = Store.migrateConducteursToPersonnel();
      if (migrated > 0) {
        console.log(`[ChantierPro] ${migrated} membre(s) migré(s) vers la nouvelle entité Personnel`);
      }
    }
    // 3) Theme
    applyTheme(Store.state.parametres?.theme);
    // 4) Subscribe for badges update
    Store.subscribe(() => updateBadges());
    updateBadges();
    // 5) Bind UI
    bindSidebar();
    bindHeader();
    // 5bis) Déstockage automatique des chantiers démarrés
    if (typeof Store.processDestockageAuto === 'function') {
      try {
        const traites = Store.processDestockageAuto();
        if (traites.length > 0) {
          setTimeout(() => {
            traites.forEach(t => {
              const nbManques = (t.manques || []).length;
              if (nbManques > 0) {
                Toast.warning(`📦 Stock mis à jour : chantier ${t.chantier.numero} — ${nbManques} fourniture(s) à commander`);
              } else {
                Toast.info(`📦 Stock mis à jour : fournitures du chantier ${t.chantier.numero} déduites`);
              }
            });
          }, 800);
        }
      } catch (e) {
        console.error('Erreur déstockage auto:', e);
      }
    }
    // 6) Route
    window.addEventListener('hashchange', () => Router.route());
    Router.route();

    // Listen to system theme changes if auto
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((Store.state.parametres?.theme || 'auto') === 'auto') applyTheme('auto');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
