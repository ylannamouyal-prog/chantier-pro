/* =================================================================
   STORE — État central de l'application
   Persistance localStorage + système de souscription (pub/sub)
   ================================================================= */

const STORAGE_KEY = 'chantierpro_data_v1';

const Store = {
  state: {
    chantiers:    [],
    clients:      [],
    cotes:        [],       // prises de cotes (rattachées à un chantierId)
    fournitures:  [],       // référentiel fournitures
    stockAtelier: {},       // { fournitureId: qte }
    stockCamions: {},       // { equipeId: { fournitureId: qte } }
    reservations: [],       // réservations stock par chantier
    mouvements:   [],       // historique mouvements stock
    engins:       [],       // engins/nacelles
    reservationsEngins: [], // { id, enginId, chantierId, dateDebut, dateFin }
    fournisseurs: [],
    equipes:      [],       // équipes avec couleur
    conducteurs:  [],       // conducteurs avec couleur
    parametres: {
      entreprise: {
        nom: 'Menuiserie SAS',
        adresse: '',
        telephone: '',
        email: '',
        siret: ''
      },
      theme: 'light'
    }
  },

  _subscribers: new Set(),

  /** S'abonner aux changements */
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  },

  _notify(action, payload) {
    this._subscribers.forEach(fn => {
      try { fn(action, payload, this.state); }
      catch (e) { console.error('Store subscriber error:', e); }
    });
  },

  /** Charge depuis localStorage */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // Merge en préservant la structure par défaut (compat évolutive)
        this.state = { ...this.state, ...data };
        // Garantir que les sous-objets existent
        if (!this.state.parametres) this.state.parametres = { entreprise: {}, theme: 'light' };
        if (!this.state.parametres.entreprise) this.state.parametres.entreprise = {};
      }
    } catch (e) {
      console.error('Erreur chargement store:', e);
    }
  },

  /** Sauvegarde dans localStorage */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
      Toast.error('Impossible de sauvegarder. Espace de stockage saturé ?');
    }
  },

  /** Wrapper : applique modif + save + notify */
  commit(action, mutator) {
    mutator(this.state);
    this.save();
    this._notify(action, this.state);
  },

  // ============================================================
  // CHANTIERS
  // ============================================================
  addChantier(data) {
    const chantier = {
      id: Helpers.uid('ch_'),
      numero: Helpers.chantierNumber(this.state.chantiers),
      titre: '',
      clientId: null,
      ville: '',
      adresse: '',
      conducteurId: null,
      equipeId: null,
      statut: 'en-attente-cotes',
      priorite: 'normale',
      dateDebut: null,
      dateFin: null,
      notes: '',
      ...data,
      createdAt: new Date().toISOString()
    };
    this.commit('chantier:add', s => s.chantiers.push(chantier));
    return chantier;
  },

  updateChantier(id, patch) {
    this.commit('chantier:update', s => {
      const c = s.chantiers.find(x => x.id === id);
      if (c) Object.assign(c, patch, { updatedAt: new Date().toISOString() });
    });
  },

  deleteChantier(id) {
    this.commit('chantier:delete', s => {
      s.chantiers = s.chantiers.filter(c => c.id !== id);
      s.cotes = s.cotes.filter(c => c.chantierId !== id);
      s.reservationsEngins = s.reservationsEngins.filter(r => r.chantierId !== id);
    });
  },

  getChantier(id) {
    return this.state.chantiers.find(c => c.id === id);
  },

  // ============================================================
  // CLIENTS
  // ============================================================
  addClient(data) {
    const client = {
      id: Helpers.uid('cl_'),
      nom: '',
      telephone: '',
      email: '',
      adresse: '',
      notes: '',
      ...data,
      createdAt: new Date().toISOString()
    };
    this.commit('client:add', s => s.clients.push(client));
    return client;
  },

  updateClient(id, patch) {
    this.commit('client:update', s => {
      const c = s.clients.find(x => x.id === id);
      if (c) Object.assign(c, patch);
    });
  },

  deleteClient(id) {
    this.commit('client:delete', s => {
      s.clients = s.clients.filter(c => c.id !== id);
    });
  },

  getClient(id) {
    return this.state.clients.find(c => c.id === id);
  },

  // ============================================================
  // COTES (prises de cotes)
  // ============================================================
  addCote(data) {
    const cote = {
      id: Helpers.uid('cot_'),
      chantierId: null,
      emplacement: '',
      type: 'vitrage',
      typeCote: 'tableau',
      largeur: 0,
      hauteur: 0,
      quantite: 1,
      acces: '',
      notes: '',
      order: this.state.cotes.length,
      ...data,
      createdAt: new Date().toISOString()
    };
    this.commit('cote:add', s => s.cotes.push(cote));
    return cote;
  },

  updateCote(id, patch) {
    this.commit('cote:update', s => {
      const c = s.cotes.find(x => x.id === id);
      if (c) Object.assign(c, patch);
    });
  },

  deleteCote(id) {
    this.commit('cote:delete', s => {
      s.cotes = s.cotes.filter(c => c.id !== id);
    });
  },

  reorderCotes(chantierId, orderedIds) {
    this.commit('cote:reorder', s => {
      orderedIds.forEach((id, idx) => {
        const c = s.cotes.find(x => x.id === id);
        if (c) c.order = idx;
      });
    });
  },

  getCotesByChantier(chantierId) {
    return this.state.cotes
      .filter(c => c.chantierId === chantierId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  // ============================================================
  // FOURNITURES
  // ============================================================
  addFourniture(data) {
    const f = {
      id: Helpers.uid('f_'),
      reference: '',
      designation: '',
      categorie: 'visserie',
      unite: 'unité',
      prixUnitaire: 0,
      seuilAlerte: 5,
      ...data
    };
    this.commit('fourniture:add', s => s.fournitures.push(f));
    return f;
  },

  updateFourniture(id, patch) {
    this.commit('fourniture:update', s => {
      const f = s.fournitures.find(x => x.id === id);
      if (f) Object.assign(f, patch);
    });
  },

  deleteFourniture(id) {
    this.commit('fourniture:delete', s => {
      s.fournitures = s.fournitures.filter(f => f.id !== id);
      delete s.stockAtelier[id];
      Object.values(s.stockCamions).forEach(stock => delete stock[id]);
    });
  },

  // ============================================================
  // STOCK
  // ============================================================
  setStockAtelier(fournitureId, qte) {
    this.commit('stock:atelier', s => {
      s.stockAtelier[fournitureId] = Math.max(0, qte);
    });
  },

  setStockCamion(equipeId, fournitureId, qte) {
    this.commit('stock:camion', s => {
      if (!s.stockCamions[equipeId]) s.stockCamions[equipeId] = {};
      s.stockCamions[equipeId][fournitureId] = Math.max(0, qte);
    });
  },

  addMouvement(data) {
    this.commit('mouvement:add', s => {
      s.mouvements.push({
        id: Helpers.uid('mvt_'),
        date: new Date().toISOString(),
        ...data
      });
    });
  },

  getStockTotal(fournitureId) {
    const atelier = this.state.stockAtelier[fournitureId] || 0;
    const camions = Object.values(this.state.stockCamions).reduce(
      (acc, st) => acc + (st[fournitureId] || 0), 0
    );
    return { atelier, camions, total: atelier + camions };
  },

  // ============================================================
  // ENGINS
  // ============================================================
  addEngin(data) {
    const e = {
      id: Helpers.uid('eng_'),
      nom: '',
      type: 'nacelle',
      modele: '',
      fournisseur: '',
      ...data
    };
    this.commit('engin:add', s => s.engins.push(e));
    return e;
  },

  updateEngin(id, patch) {
    this.commit('engin:update', s => {
      const e = s.engins.find(x => x.id === id);
      if (e) Object.assign(e, patch);
    });
  },

  deleteEngin(id) {
    this.commit('engin:delete', s => {
      s.engins = s.engins.filter(e => e.id !== id);
      s.reservationsEngins = s.reservationsEngins.filter(r => r.enginId !== id);
    });
  },

  reserveEngin(data) {
    const r = {
      id: Helpers.uid('res_'),
      enginId: null,
      chantierId: null,
      dateDebut: null,
      dateFin: null,
      ...data
    };
    this.commit('engin:reserve', s => s.reservationsEngins.push(r));
    return r;
  },

  deleteReservationEngin(id) {
    this.commit('engin:unreserve', s => {
      s.reservationsEngins = s.reservationsEngins.filter(r => r.id !== id);
    });
  },

  // ============================================================
  // FOURNISSEURS
  // ============================================================
  addFournisseur(data) {
    const f = {
      id: Helpers.uid('fr_'),
      nom: '',
      contact: '',
      telephone: '',
      email: '',
      delaiLivraison: 5,
      categories: [],
      ...data
    };
    this.commit('fournisseur:add', s => s.fournisseurs.push(f));
    return f;
  },

  updateFournisseur(id, patch) {
    this.commit('fournisseur:update', s => {
      const f = s.fournisseurs.find(x => x.id === id);
      if (f) Object.assign(f, patch);
    });
  },

  deleteFournisseur(id) {
    this.commit('fournisseur:delete', s => {
      s.fournisseurs = s.fournisseurs.filter(f => f.id !== id);
    });
  },

  // ============================================================
  // EQUIPES / CONDUCTEURS
  // ============================================================
  addEquipe(data) {
    const e = {
      id: Helpers.uid('eq_'),
      nom: '',
      couleur: '#3B82F6',
      membres: [],
      ...data
    };
    this.commit('equipe:add', s => s.equipes.push(e));
    return e;
  },

  updateEquipe(id, patch) {
    this.commit('equipe:update', s => {
      const e = s.equipes.find(x => x.id === id);
      if (e) Object.assign(e, patch);
    });
  },

  deleteEquipe(id) {
    this.commit('equipe:delete', s => {
      s.equipes = s.equipes.filter(e => e.id !== id);
    });
  },

  addConducteur(data) {
    const c = {
      id: Helpers.uid('cd_'),
      nom: '',
      telephone: '',
      couleur: '#10B981',
      ...data
    };
    this.commit('conducteur:add', s => s.conducteurs.push(c));
    return c;
  },

  updateConducteur(id, patch) {
    this.commit('conducteur:update', s => {
      const c = s.conducteurs.find(x => x.id === id);
      if (c) Object.assign(c, patch);
    });
  },

  deleteConducteur(id) {
    this.commit('conducteur:delete', s => {
      s.conducteurs = s.conducteurs.filter(c => c.id !== id);
    });
  },

  // ============================================================
  // SAUVEGARDE / RESTAURATION
  // ============================================================
  exportJSON() {
    return JSON.stringify({
      app: 'ChantierPro',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: this.state
    }, null, 2);
  },

  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.data) throw new Error('Format de sauvegarde invalide');
    this.state = parsed.data;
    this.save();
    this._notify('store:imported', this.state);
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = {
      chantiers: [], clients: [], cotes: [], fournitures: [],
      stockAtelier: {}, stockCamions: {}, reservations: [], mouvements: [],
      engins: [], reservationsEngins: [], fournisseurs: [],
      equipes: [], conducteurs: [],
      parametres: { entreprise: { nom: 'Menuiserie SAS' }, theme: 'light' }
    };
    this._notify('store:reset', this.state);
  },

  loadDemoData() {
    if (typeof DemoData !== 'undefined') {
      DemoData.populate(this);
    }
  }
};

window.Store = Store;
