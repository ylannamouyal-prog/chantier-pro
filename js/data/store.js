/* =================================================================
   STORE — État central de l'application
   Persistance localStorage + système de souscription (pub/sub)
   ================================================================= */

const STORAGE_KEY = 'chantierpro_data_v1';

const Store = {
  state: {
    chantiers:    [],
    clients:      [],
    cotes:        [],       // prises de cotes (rattachées à un chantierId + categorieId)
    categoriesCotes: [],    // catégories d'ouvrages (regroupent les cotes par type)
    fournitures:  [],       // référentiel fournitures
    stockAtelier: {},       // { fournitureId: qte }
    stockCamions: {},       // { equipeId: { fournitureId: qte } }
    reservations: [],       // réservations stock par chantier
    mouvements:   [],       // historique mouvements stock
    engins:       [],       // engins/nacelles
    reservationsEngins: [], // { id, enginId, chantierId, dateDebut, dateFin }
    fournisseurs: [],
    categoriesFournisseurs: [], // liste gérable de catégories fournisseurs
    commandes:    [],       // bons de commande fournisseurs
    articlesSpecifiques: [], // articles sur-mesure par chantier (vitrage, store...) avec cycle de vie
    rdvs:         [],       // rendez-vous (visites, métrés, etc.)
    modeles:      [],       // modèles de chantier (bibliothèque de fournitures par type)
    equipes:      [],       // équipes avec couleur
    conducteurs:  [],       // conducteurs avec couleur (legacy - migré vers personnel)
    personnel:    [],       // personnel complet : conducteurs, chefs, ouvriers, alternants
    absences:     [],       // congés, maladie, formation, etc.
    typesAbsence: [],       // types personnalisés en plus des types par défaut
    journal:      [],       // journal automatique des actions
    rendezVous:   [],       // rendez-vous (métré, visite, livraison...)
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
    this._autoJournal(action);
    this._notify(action, this.state);
  },

  /** Génère une entrée de journal lisible selon l'action (sauf pour le journal lui-même) */
  _autoJournal(action) {
    if (!action || action.startsWith('journal:')) return;
    const labels = {
      'chantier:add': '🏗️ Chantier créé',
      'chantier:update': '🏗️ Chantier modifié',
      'chantier:delete': '🗑️ Chantier supprimé',
      'chantier:addDepense': '💰 Dépense ajoutée à un chantier',
      'client:add': '👤 Client créé',
      'client:update': '👤 Client modifié',
      'client:delete': '🗑️ Client supprimé',
      'fournisseur:add': '🏢 Fournisseur créé',
      'fournisseur:update': '🏢 Fournisseur modifié',
      'fournisseur:delete': '🗑️ Fournisseur supprimé',
      'commande:add': '📦 Commande créée',
      'commande:update': '📦 Commande modifiée',
      'commande:livree': '✅ Commande livrée',
      'engin:add': '🚜 Engin ajouté',
      'engin:update': '🚜 Engin modifié',
      'engin:delete': '🗑️ Engin supprimé',
      'engin:reserve': '📅 Engin réservé',
      'personnel:add': '👷 Personne ajoutée au personnel',
      'personnel:update': '👷 Personne modifiée',
      'personnel:delete': '🗑️ Personne supprimée',
      'absence:add': '🌴 Absence enregistrée',
      'absence:delete': '🗑️ Absence supprimée',
      'equipe:add': '◈ Équipe créée',
      'equipe:update': '◈ Équipe modifiée',
      'equipe:delete': '🗑️ Équipe supprimée',
      'cote:add': '📐 Cote ajoutée',
      'modele:add': '📋 Modèle créé',
      'rdv:add': '📅 Rendez-vous créé'
    };
    const label = labels[action];
    if (!label) return; // on ne journalise que les actions "importantes"
    if (!this.state.journal) this.state.journal = [];
    this.state.journal.unshift({
      id: Helpers.uid('log_'),
      message: label,
      type: 'auto',
      date: new Date().toISOString()
    });
    if (this.state.journal.length > 200) {
      this.state.journal = this.state.journal.slice(0, 200);
    }
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
      montantFacture: 0,       // prix de vente HT facturé au client
      dateDebut: null,
      dateFin: null,
      notes: '',
      depensesManuelles: [],   // [{id, libelle, montant, categorie, date}]
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

  // ============================================================
  // DÉPENSES MANUELLES D'UN CHANTIER
  // ============================================================
  addDepenseChantier(chantierId, depense) {
    const d = {
      id: Helpers.uid('dep_'),
      libelle: '',
      montant: 0,
      categorie: 'autre',  // 'location' | 'carburant' | 'main-oeuvre' | 'sous-traitance' | 'autre'
      date: new Date().toISOString().split('T')[0],
      ...depense
    };
    this.commit('chantier:addDepense', s => {
      const c = s.chantiers.find(x => x.id === chantierId);
      if (!c) return;
      if (!c.depensesManuelles) c.depensesManuelles = [];
      c.depensesManuelles.push(d);
    });
    return d;
  },

  updateDepenseChantier(chantierId, depenseId, patch) {
    this.commit('chantier:updateDepense', s => {
      const c = s.chantiers.find(x => x.id === chantierId);
      if (!c || !c.depensesManuelles) return;
      const d = c.depensesManuelles.find(x => x.id === depenseId);
      if (d) Object.assign(d, patch);
    });
  },

  deleteDepenseChantier(chantierId, depenseId) {
    this.commit('chantier:deleteDepense', s => {
      const c = s.chantiers.find(x => x.id === chantierId);
      if (!c || !c.depensesManuelles) return;
      c.depensesManuelles = c.depensesManuelles.filter(x => x.id !== depenseId);
    });
  },

  /**
   * Ajoute une fourniture consommée manuellement à un chantier et la déduit du stock.
   * source = 'atelier' ou un id d'équipe (camion).
   * Déduit ce qui est disponible et enregistre le manque éventuel.
   * Retourne { deduit, manque }.
   */
  addFournitureConsommee(chantierId, fournitureId, quantite, source = 'atelier') {
    const fourniture = this.state.fournitures.find(f => f.id === fournitureId);
    if (!fourniture) return { deduit: 0, manque: quantite };

    const qteDemandee = Number(quantite) || 0;
    if (qteDemandee <= 0) return { deduit: 0, manque: 0 };

    let deduit = 0;
    let manque = 0;

    this.commit('chantier:addFourniture', s => {
      const c = s.chantiers.find(x => x.id === chantierId);
      if (!c) return;

      // Stock disponible selon la source
      let dispo;
      if (source === 'atelier') {
        dispo = s.stockAtelier[fournitureId] || 0;
      } else {
        if (!s.stockCamions[source]) s.stockCamions[source] = {};
        dispo = s.stockCamions[source][fournitureId] || 0;
      }

      deduit = Math.min(dispo, qteDemandee);
      manque = Math.max(0, qteDemandee - dispo);

      // Déduction
      if (deduit > 0) {
        if (source === 'atelier') {
          s.stockAtelier[fournitureId] = dispo - deduit;
        } else {
          s.stockCamions[source][fournitureId] = dispo - deduit;
        }
        // Trace mouvement
        if (!s.mouvements) s.mouvements = [];
        s.mouvements.push({
          id: Helpers.uid('mv_'),
          fournitureId,
          type: 'sortie',
          quantite: deduit,
          emplacement: source,
          motif: `Chantier ${c.numero} (ajout manuel)`,
          date: new Date().toISOString()
        });
      }

      // Enregistre comme dépense (au prix du stock, sur la quantité demandée)
      if (!c.depensesManuelles) c.depensesManuelles = [];
      const sourceLabel = source === 'atelier' ? 'Atelier'
        : (s.equipes.find(e => e.id === source)?.nom || 'Camion');
      c.depensesManuelles.push({
        id: Helpers.uid('dep_'),
        libelle: `${fourniture.nom} (${qteDemandee} ${fourniture.unite || 'u'}) — ${sourceLabel}`,
        montant: qteDemandee * (fourniture.prixUnitaire || 0),
        categorie: 'fourniture',
        date: new Date().toISOString().split('T')[0],
        fournitureId,
        quantite: qteDemandee
      });

      // Enregistre le manque éventuel sur le chantier
      if (manque > 0) {
        if (!c.fournituresManquantes) c.fournituresManquantes = [];
        const existant = c.fournituresManquantes.find(m => m.fournitureId === fournitureId);
        if (existant) {
          existant.quantite = Math.ceil((existant.quantite + manque) * 100) / 100;
        } else {
          c.fournituresManquantes.push({
            fournitureId,
            designation: fourniture.nom,
            unite: fourniture.unite || 'u',
            quantite: Math.ceil(manque * 100) / 100
          });
        }
      }
    });

    return { deduit, manque };
  },

  /**
   * Calcule le bilan complet des dépenses d'un chantier.
   * Retourne { fournitures: [...], commandes: [...], manuelles: [...],
   *            totalFournitures, totalCommandes, totalManuelles, totalGeneral }
   */
  getBilanChantier(chantierId) {
    const chantier = this.state.chantiers.find(c => c.id === chantierId);
    if (!chantier) return null;

    // 1) Fournitures estimées depuis les cotes
    const cotes = this.getCotesByChantier(chantierId);
    let fournitures = [];
    let totalFournitures = 0;
    if (window.PdfExport && typeof PdfExport.computeFournituresChantier === 'function') {
      fournitures = PdfExport.computeFournituresChantier(cotes);
      totalFournitures = fournitures.reduce((s, f) => s + (f.total || 0), 0);
    }

    // 1bis) Prix saisis manuellement sur chaque cote (vitrage 55€, etc.)
    const totalPrixCotes = cotes.reduce((s, c) => s + ((parseFloat(c.prix) || 0) * (c.quantite || 1)), 0);
    totalFournitures += totalPrixCotes;

    // 2) Commandes réelles passées pour ce chantier
    const commandes = (this.state.commandes || [])
      .filter(c => c.chantierId === chantierId && c.statut !== 'annulee');
    let totalCommandes = commandes.reduce((s, c) =>
      s + (c.lignes || []).reduce((ls, l) => ls + (l.quantite * (l.prixUnitaire || 0)), 0), 0);

    // 2bis) Articles spécifiques (sur-mesure) commandés pour ce chantier
    const articlesSpec = (this.state.articlesSpecifiques || [])
      .filter(a => a.chantierId === chantierId && !a.libre);
    const totalArticlesSpec = articlesSpec.reduce((s, a) =>
      s + ((a.quantite || 0) * (a.prixUnitaire || 0)), 0);
    totalCommandes += totalArticlesSpec;

    // 3) Dépenses manuelles
    const manuelles = chantier.depensesManuelles || [];
    const totalManuelles = manuelles.reduce((s, d) => s + (parseFloat(d.montant) || 0), 0);

    const totalGeneral = totalFournitures + totalCommandes + totalManuelles;
    const montantFacture = parseFloat(chantier.montantFacture) || 0;
    const marge = montantFacture - totalGeneral;
    const margePourcent = montantFacture > 0 ? (marge / montantFacture) * 100 : 0;

    return {
      fournitures, commandes, manuelles,
      totalFournitures, totalCommandes, totalManuelles,
      totalGeneral,
      montantFacture,
      marge,
      margePourcent
    };
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
  // ============================================================
  // ARTICLES SPÉCIFIQUES (sur-mesure par chantier)
  // Cycle de vie : a-commander → commande → livre → pose
  // Un surplus (commandé mais non posé) peut être remis en stock atelier non assigné.
  // ============================================================
  addArticleSpecifique(data) {
    const article = {
      id: Helpers.uid('art_'),
      designation: '',
      quantite: 1,
      quantitePosee: 0,
      chantierId: null,
      conducteurId: null,
      fournisseurId: null,
      prixUnitaire: 0,
      statut: 'a-commander',  // a-commander | commande | livre | pose
      libre: false,           // true = remis en stock atelier non assigné
      createdAt: new Date().toISOString(),
      ...data
    };
    this.commit('article:add', s => {
      if (!s.articlesSpecifiques) s.articlesSpecifiques = [];
      s.articlesSpecifiques.push(article);
    });
    return article;
  },

  updateArticleSpecifique(id, patch) {
    this.commit('article:update', s => {
      const a = s.articlesSpecifiques.find(x => x.id === id);
      if (a) Object.assign(a, patch);
    });
  },

  deleteArticleSpecifique(id) {
    this.commit('article:delete', s => {
      s.articlesSpecifiques = (s.articlesSpecifiques || []).filter(a => a.id !== id);
    });
  },

  setStatutArticle(id, statut) {
    this.commit('article:statut', s => {
      const a = s.articlesSpecifiques.find(x => x.id === id);
      if (a) {
        a.statut = statut;
        if (statut === 'livre') a.livreAt = new Date().toISOString();
        if (statut === 'pose') a.poseAt = new Date().toISOString();
      }
    });
  },

  /**
   * Marque un article comme posé avec une quantité réellement posée.
   * Si surplus (commandé > posé), retourne le surplus pour proposer la remise en stock.
   */
  posarArticle(id, quantitePosee) {
    let surplus = 0;
    this.commit('article:pose', s => {
      const a = s.articlesSpecifiques.find(x => x.id === id);
      if (!a) return;
      a.quantitePosee = quantitePosee;
      a.statut = 'pose';
      a.poseAt = new Date().toISOString();
      surplus = Math.max(0, a.quantite - quantitePosee);
    });
    return surplus;
  },

  /** Remet le surplus d'un article en stock atelier non assigné (article libre) */
  remettreEnStockArticle(id, quantiteSurplus) {
    this.commit('article:remiseStock', s => {
      const a = s.articlesSpecifiques.find(x => x.id === id);
      if (!a) return;
      // Crée un nouvel article "libre" pour le surplus
      s.articlesSpecifiques.push({
        id: Helpers.uid('art_'),
        designation: a.designation,
        quantite: quantiteSurplus,
        quantitePosee: 0,
        chantierId: null,
        conducteurId: null,
        fournisseurId: a.fournisseurId,
        prixUnitaire: a.prixUnitaire,
        statut: 'livre',
        libre: true,
        createdAt: new Date().toISOString(),
        sourceId: a.id
      });
    });
  },

  getArticlesSpecifiques() {
    return this.state.articlesSpecifiques || [];
  },

  addClient(data) {
    const client = {
      id: Helpers.uid('cl_'),
      nom: '',
      telephone: '',
      email: '',
      adresse: '',
      notes: '',
      role: '',          // rôle du contact principal (ex: Directeur)
      contacts: [],      // contacts secondaires : [{id, nom, role, telephone, email, afficherPdf}]
      lieux: [],         // lieux/adresses : [{id, nom, adresse, ville}]
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

  // ============================================================
  // CONTACTS SECONDAIRES D'UN CLIENT
  // ============================================================
  addContactToClient(clientId, contactData) {
    const id = Helpers.uid('ct_');
    const contact = {
      id,
      nom: '',
      role: '',
      telephone: '',
      email: '',
      afficherPdf: false,
      ...contactData
    };
    this.commit('client:addContact', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c) return;
      if (!c.contacts) c.contacts = [];
      c.contacts.push(contact);
    });
    return contact;
  },

  updateContactInClient(clientId, contactId, patch) {
    this.commit('client:updateContact', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c || !c.contacts) return;
      const ct = c.contacts.find(x => x.id === contactId);
      if (ct) Object.assign(ct, patch);
    });
  },

  deleteContactFromClient(clientId, contactId) {
    this.commit('client:deleteContact', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c || !c.contacts) return;
      c.contacts = c.contacts.filter(x => x.id !== contactId);
    });
  },

  // ===== LIEUX / ADRESSES d'un client =====
  addLieuToClient(clientId, lieuData) {
    const lieu = {
      id: Helpers.uid('lieu_'),
      nom: '',
      adresse: '',
      ville: '',
      ...lieuData
    };
    this.commit('client:addLieu', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c) return;
      if (!c.lieux) c.lieux = [];
      c.lieux.push(lieu);
    });
    return lieu;
  },

  updateLieuInClient(clientId, lieuId, patch) {
    this.commit('client:updateLieu', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c || !c.lieux) return;
      const l = c.lieux.find(x => x.id === lieuId);
      if (l) Object.assign(l, patch);
    });
  },

  deleteLieuFromClient(clientId, lieuId) {
    this.commit('client:deleteLieu', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c || !c.lieux) return;
      c.lieux = c.lieux.filter(x => x.id !== lieuId);
    });
  },

  getLieuxByClient(clientId) {
    const c = this.state.clients.find(x => x.id === clientId);
    return (c && c.lieux) || [];
  },

  /** Promeut un contact secondaire au rang de contact principal (échange avec l'actuel principal) */
  promoteContactToPrincipal(clientId, contactId) {
    this.commit('client:promoteContact', s => {
      const c = s.clients.find(x => x.id === clientId);
      if (!c || !c.contacts) return;
      const ct = c.contacts.find(x => x.id === contactId);
      if (!ct) return;
      // L'ancien principal devient un contact secondaire
      const ancienPrincipal = {
        id: Helpers.uid('ct_'),
        nom: c.nom,
        role: c.role || '',
        telephone: c.telephone || '',
        email: c.email || '',
        afficherPdf: false
      };
      // Nouveau principal = ce contact
      c.nom = ct.nom;
      c.role = ct.role || '';
      c.telephone = ct.telephone || '';
      c.email = ct.email || '';
      // Retire l'ancien contact de la liste et ajoute l'ex-principal
      c.contacts = c.contacts.filter(x => x.id !== contactId);
      if (ancienPrincipal.nom || ancienPrincipal.telephone || ancienPrincipal.email) {
        c.contacts.push(ancienPrincipal);
      }
    });
  },

  /** Retourne tous les contacts d'un client (principal en premier) */
  getAllContacts(clientId) {
    const c = this.state.clients.find(x => x.id === clientId);
    if (!c) return [];
    const principal = {
      id: '__principal__',
      nom: c.nom,
      role: c.role || '',
      telephone: c.telephone || '',
      email: c.email || '',
      afficherPdf: true,
      isPrincipal: true
    };
    return [principal, ...(c.contacts || [])];
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
      prix: 0,           // prix de la fourniture pour cette cote (€ HT)
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
  // CATÉGORIES DE COTES (regroupement par type d'ouvrage)
  // ============================================================
  /**
   * Une catégorie = {
   *   id, chantierId, nom (libre, ex: "Vitrage"),
   *   schema (string base64 du dessin SVG/PNG), schemaData (Fabric JSON),
   *   photos: [{ id, dataUrl, name }],
   *   order, createdAt, updatedAt
   * }
   */
  addCategorieCote(data) {
    if (!this.state.categoriesCotes) this.state.categoriesCotes = [];
    const existingForChantier = this.state.categoriesCotes
      .filter(c => c.chantierId === data.chantierId).length;
    const cat = {
      id: Helpers.uid('cat_'),
      chantierId: null,
      nom: '',
      schema: null,
      schemaData: null,
      photos: [],
      order: existingForChantier,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    this.commit('catCote:add', s => {
      if (!s.categoriesCotes) s.categoriesCotes = [];
      s.categoriesCotes.push(cat);
    });
    return cat;
  },

  updateCategorieCote(id, patch) {
    this.commit('catCote:update', s => {
      if (!s.categoriesCotes) return;
      const c = s.categoriesCotes.find(x => x.id === id);
      if (c) {
        Object.assign(c, patch);
        c.updatedAt = new Date().toISOString();
      }
    });
  },

  deleteCategorieCote(id) {
    this.commit('catCote:delete', s => {
      if (!s.categoriesCotes) return;
      // Supprime aussi toutes les cotes rattachées à cette catégorie
      s.cotes = s.cotes.filter(c => c.categorieId !== id);
      s.categoriesCotes = s.categoriesCotes.filter(c => c.id !== id);
    });
  },

  getCategoriesByChantier(chantierId) {
    // Migration auto : si le chantier a des cotes sans catégorie, créer "Cotes générales"
    this._migrateLegacyCotes(chantierId);

    if (!this.state.categoriesCotes) return [];
    return this.state.categoriesCotes
      .filter(c => c.chantierId === chantierId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  getCotesByCategorie(categorieId) {
    return this.state.cotes
      .filter(c => c.categorieId === categorieId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  /** Migration automatique : cotes sans categorieId → catégorie "Cotes générales" */
  _migrateLegacyCotes(chantierId) {
    const orphanCotes = this.state.cotes.filter(
      c => c.chantierId === chantierId && !c.categorieId
    );
    if (orphanCotes.length === 0) return;

    // Cherche si "Cotes générales" existe déjà pour ce chantier
    let cat = (this.state.categoriesCotes || []).find(
      c => c.chantierId === chantierId && c.nom === 'Cotes générales'
    );

    if (!cat) {
      // Création sans déclencher commit/save (sera fait par le caller suivant)
      cat = {
        id: Helpers.uid('cat_'),
        chantierId,
        nom: 'Cotes générales',
        schema: null,
        schemaData: null,
        photos: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (!this.state.categoriesCotes) this.state.categoriesCotes = [];
      this.state.categoriesCotes.push(cat);
    }

    // Rattache toutes les cotes orphelines à cette catégorie
    orphanCotes.forEach(c => { c.categorieId = cat.id; });
    this.save();
  },

  reorderCategoriesCotes(chantierId, orderedIds) {
    this.commit('catCote:reorder', s => {
      if (!s.categoriesCotes) return;
      orderedIds.forEach((id, idx) => {
        const c = s.categoriesCotes.find(x => x.id === id);
        if (c && c.chantierId === chantierId) c.order = idx;
      });
    });
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
  // RÉSERVATIONS PRÉVISIONNELLES "À VENIR"
  // Pour chaque chantier au statut "prévu" (dates futures, cotes faites)
  // et NON encore déstocké, on calcule les fournitures nécessaires
  // via les ouvrages associés aux catégories de cotes.
  // ============================================================

  /** Calcule les besoins en fournitures d'un chantier (depuis ses cotes + ouvrages) */
  getBesoinsFournitures(chantierId) {
    const cotes = this.getCotesByChantier
      ? this.getCotesByChantier(chantierId)
      : (this.state.cotes || []).filter(c => c.chantierId === chantierId);

    const besoins = {}; // fournitureId → { fournitureId, designation, unite, quantite }

    (cotes || []).forEach(cote => {
      const cat = (this.state.categoriesCotes || []).find(c => c.id === cote.categorieId);
      if (!cat || !cat.modeleId) return;
      const modele = (this.state.modeles || []).find(m => m.id === cat.modeleId);
      if (!modele || !modele.lignes) return;

      const qte = cote.quantite || 1;
      const largeur = (cote.largeur || 0) / 1000;
      const hauteur = (cote.hauteur || 0) / 1000;
      const surface = largeur * hauteur * qte;
      const perimetre = 2 * (largeur + hauteur) * qte;

      modele.lignes.forEach(ligne => {
        if (!ligne.fournitureId) return;
        const mode = ligne.mode || 'm2';
        let q;
        if (mode === 'm2') q = ligne.quantite * surface;
        else if (mode === 'perimetre') q = ligne.quantite * perimetre;
        else q = ligne.quantite * qte;

        if (!besoins[ligne.fournitureId]) {
          const f = this.state.fournitures.find(x => x.id === ligne.fournitureId);
          besoins[ligne.fournitureId] = {
            fournitureId: ligne.fournitureId,
            designation: ligne.designation || f?.nom || 'Fourniture',
            unite: ligne.unite || f?.unite || 'u',
            quantite: 0
          };
        }
        besoins[ligne.fournitureId].quantite += q;
      });
    });

    // Arrondi
    return Object.values(besoins).map(b => ({
      ...b,
      quantite: Math.ceil(b.quantite * 100) / 100
    }));
  },

  /** Quantité totale "à venir" (réservée) pour une fourniture, tous chantiers prévus confondus */
  getReserveAVenir(fournitureId) {
    const chantiers = (this.state.chantiers || []).filter(c => {
      if (c.destockEffectue) return false; // déjà déduit
      const statut = Helpers.computeStatus(c);
      return statut === 'prevu'; // uniquement les chantiers prévus (pas en-attente-cotes)
    });

    let total = 0;
    // Copie de travail des stocks camions pour simuler la déduction camion d'abord
    const camionSim = {};
    chantiers.forEach(c => {
      const besoins = this.getBesoinsFournitures(c.id);
      const b = besoins.find(x => x.fournitureId === fournitureId);
      if (!b) return;

      let restant = b.quantite;
      // Le camion de l'équipe assignée absorbe d'abord
      const eqId = c.equipeId;
      if (eqId && this.state.stockCamions[eqId]) {
        if (camionSim[eqId] === undefined) {
          camionSim[eqId] = this.state.stockCamions[eqId][fournitureId] || 0;
        }
        const prendreCamion = Math.min(camionSim[eqId], restant);
        camionSim[eqId] -= prendreCamion;
        restant -= prendreCamion;
      }
      // Le reste touchera l'atelier
      total += restant;
    });
    return Math.ceil(total * 100) / 100;
  },

  /** Détail des chantiers qui réservent une fourniture (pour info) */
  getReservationsDetail(fournitureId) {
    const result = [];
    (this.state.chantiers || []).forEach(c => {
      if (c.destockEffectue) return;
      const statut = Helpers.computeStatus(c);
      if (statut !== 'prevu') return;
      const besoins = this.getBesoinsFournitures(c.id);
      const b = besoins.find(x => x.fournitureId === fournitureId);
      if (b) result.push({ chantier: c, quantite: b.quantite });
    });
    return result;
  },

  // ============================================================
  // DÉSTOCKAGE AUTOMATIQUE (le jour du chantier)
  // ============================================================
  /**
   * Parcourt les chantiers dont la date de début est arrivée/passée
   * et qui n'ont pas encore été déstockés. Déduit leurs fournitures
   * du stock atelier (avec gestion du manque). Retourne la liste des
   * chantiers traités pour pouvoir afficher un message.
   */
  processDestockageAuto() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const traites = [];

    (this.state.chantiers || []).forEach(chantier => {
      if (chantier.destockEffectue) return;          // déjà fait
      if (!chantier.dateDebut) return;                // pas de date
      const debut = new Date(chantier.dateDebut);
      debut.setHours(0, 0, 0, 0);
      if (debut > now) return;                        // pas encore commencé

      // Le chantier a démarré : on déstocke
      const besoins = this.getBesoinsFournitures(chantier.id);
      if (besoins.length === 0) {
        // Rien à déduire, mais on marque comme traité pour ne pas reboucler
        this._markDestockEffectue(chantier.id, []);
        return;
      }

      const manques = [];
      this.commit('chantier:destockage', s => {
        const ch = s.chantiers.find(x => x.id === chantier.id);
        if (!ch) return;
        besoins.forEach(b => {
          const res = this._deduireStockCamionPuisAtelier(s, ch, b.fournitureId, b.quantite, '');
          if (res.manque > 0) {
            manques.push({
              fournitureId: b.fournitureId,
              designation: b.designation,
              unite: b.unite,
              quantite: Math.ceil(res.manque * 100) / 100
            });
          }
        });
        ch.destockEffectue = true;
        ch.destockAt = new Date().toISOString();
        ch.fournituresManquantes = manques;

        // Articles spécifiques livrés de ce chantier → passent automatiquement à "posé"
        (s.articlesSpecifiques || []).forEach(art => {
          if (art.chantierId === ch.id && !art.libre && art.statut === 'livre') {
            art.statut = 'pose';
            art.quantitePosee = art.quantite;
            art.poseAt = new Date().toISOString();
          }
        });
      });

      traites.push({ chantier, manques });
    });

    return traites;
  },

  /**
   * Déduit une quantité d'une fourniture en piochant D'ABORD dans le camion
   * de l'équipe assignée au chantier, PUIS dans l'atelier pour le reste.
   * Doit être appelé à l'intérieur d'un commit (reçoit le state mutable s).
   * Retourne { deduit, manque }.
   */
  _deduireStockCamionPuisAtelier(s, chantier, fournitureId, quantite, suffixeMotif) {
    let restant = quantite;
    let deduitTotal = 0;
    const suffix = suffixeMotif ? ` ${suffixeMotif}` : '';

    const trace = (type, qte, emplacement, motif) => {
      if (!s.mouvements) s.mouvements = [];
      s.mouvements.push({
        id: Helpers.uid('mv_'),
        fournitureId,
        type: 'sortie',
        quantite: qte,
        emplacement,
        motif,
        date: new Date().toISOString()
      });
    };

    // 1) Camion de l'équipe assignée (si elle a un stock)
    const equipeId = chantier.equipeId;
    if (equipeId && s.stockCamions[equipeId]) {
      const dispoCamion = s.stockCamions[equipeId][fournitureId] || 0;
      const prendreCamion = Math.min(dispoCamion, restant);
      if (prendreCamion > 0) {
        s.stockCamions[equipeId][fournitureId] = dispoCamion - prendreCamion;
        const equipeNom = s.equipes.find(e => e.id === equipeId)?.nom || 'Camion';
        trace('sortie', prendreCamion, equipeId, `Chantier ${chantier.numero} (camion ${equipeNom})${suffix}`);
        restant -= prendreCamion;
        deduitTotal += prendreCamion;
      }
    }

    // 2) Atelier pour le reste
    if (restant > 0) {
      const dispoAtelier = s.stockAtelier[fournitureId] || 0;
      const prendreAtelier = Math.min(dispoAtelier, restant);
      if (prendreAtelier > 0) {
        s.stockAtelier[fournitureId] = dispoAtelier - prendreAtelier;
        trace('sortie', prendreAtelier, 'atelier', `Chantier ${chantier.numero} (atelier)${suffix}`);
        restant -= prendreAtelier;
        deduitTotal += prendreAtelier;
      }
    }

    return { deduit: deduitTotal, manque: Math.max(0, Math.ceil(restant * 100) / 100) };
  },

  _markDestockEffectue(chantierId, manques) {
    this.commit('chantier:destockage', s => {
      const ch = s.chantiers.find(x => x.id === chantierId);
      if (ch) {
        ch.destockEffectue = true;
        ch.destockAt = new Date().toISOString();
        ch.fournituresManquantes = manques || [];
      }
    });
  },

  /**
   * Complète les fournitures manquantes d'un chantier (déduit ce qui manquait,
   * uniquement si du stock est désormais disponible). Retourne ce qui a été complété.
   */
  completerFournituresManquantes(chantierId) {
    const chantier = this.state.chantiers.find(c => c.id === chantierId);
    if (!chantier || !chantier.fournituresManquantes) return { completes: [], restants: [] };

    const completes = [];
    const restants = [];

    this.commit('chantier:completManques', s => {
      const ch = s.chantiers.find(x => x.id === chantierId);
      if (!ch || !ch.fournituresManquantes) return;

      const nouveauxManques = [];
      ch.fournituresManquantes.forEach(m => {
        const res = this._deduireStockCamionPuisAtelier(s, ch, m.fournitureId, m.quantite, '(complément)');
        if (res.deduit > 0) {
          completes.push({ ...m, quantite: res.deduit });
        }
        if (res.manque > 0) {
          nouveauxManques.push({ ...m, quantite: Math.ceil(res.manque * 100) / 100 });
          restants.push({ ...m, quantite: Math.ceil(res.manque * 100) / 100 });
        }
      });
      ch.fournituresManquantes = nouveauxManques;
    });

    return { completes, restants };
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
  // CATÉGORIES FOURNISSEURS (liste gérable)
  // ============================================================
  getCategoriesFournisseurs() {
    return this.state.categoriesFournisseurs || [];
  },

  addCategorieFournisseur(nom) {
    const clean = (nom || '').trim();
    if (!clean) return null;
    // Éviter les doublons
    if ((this.state.categoriesFournisseurs || []).some(c => c.nom.toLowerCase() === clean.toLowerCase())) {
      return null;
    }
    const cat = { id: Helpers.uid('catf_'), nom: clean };
    this.commit('catFournisseur:add', s => {
      if (!s.categoriesFournisseurs) s.categoriesFournisseurs = [];
      s.categoriesFournisseurs.push(cat);
    });
    return cat;
  },

  deleteCategorieFournisseur(id) {
    this.commit('catFournisseur:delete', s => {
      if (!s.categoriesFournisseurs) return;
      const cat = s.categoriesFournisseurs.find(c => c.id === id);
      s.categoriesFournisseurs = s.categoriesFournisseurs.filter(c => c.id !== id);
      // Retirer cette catégorie des fournisseurs qui l'utilisent
      if (cat) {
        s.fournisseurs.forEach(f => {
          if (Array.isArray(f.categories)) {
            f.categories = f.categories.filter(c => c !== cat.nom && c !== id);
          }
        });
      }
    });
  },

  // ============================================================
  // JOURNAL DES ACTIONS (automatique)
  // ============================================================
  logAction(message, type = 'info') {
    if (!this.state.journal) this.state.journal = [];
    this.state.journal.unshift({
      id: Helpers.uid('log_'),
      message,
      type,
      date: new Date().toISOString()
    });
    // Limiter à 200 entrées pour ne pas saturer le stockage
    if (this.state.journal.length > 200) {
      this.state.journal = this.state.journal.slice(0, 200);
    }
    this.save();
  },

  getJournal(limit = 100) {
    return (this.state.journal || []).slice(0, limit);
  },

  clearJournal() {
    this.commit('journal:clear', s => { s.journal = []; });
  },

  // ============================================================
  // COMMANDES (bons de commande fournisseurs)
  // ============================================================
  /**
   * Une commande = {
   *   id, numero, dateCommande, dateLivraisonPrevue,
   *   fournisseurId, chantierId (optionnel), conducteurId (optionnel),
   *   lignes: [{ fournitureId, designation, quantite, prixUnitaire, unite }],
   *   statut: 'a-passer' | 'passee' | 'livree' | 'annulee',
   *   motif: 'chantier' | 'reappro',
   *   notes,
   *   createdAt, updatedAt, livreeAt
   * }
   */
  addCommande(data) {
    const num = this._nextCommandeNumber();
    const c = {
      id: Helpers.uid('cmd_'),
      numero: num,
      dateCommande: new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: '',
      fournisseurId: '',
      chantierId: null,
      conducteurId: null,
      lignes: [],
      statut: 'a-passer',
      motif: 'reappro',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      livreeAt: null,
      ...data
    };
    this.commit('commande:add', s => s.commandes.push(c));
    return c;
  },

  updateCommande(id, patch) {
    this.commit('commande:update', s => {
      const c = s.commandes.find(x => x.id === id);
      if (c) {
        Object.assign(c, patch);
        c.updatedAt = new Date().toISOString();
      }
    });
  },

  deleteCommande(id) {
    this.commit('commande:delete', s => {
      s.commandes = s.commandes.filter(c => c.id !== id);
    });
  },

  /** Marquer une commande comme livrée → injecte les quantités dans le stock atelier */
  markCommandeLivree(id) {
    this.commit('commande:livree', s => {
      const c = s.commandes.find(x => x.id === id);
      if (!c) return;
      c.statut = 'livree';
      c.livreeAt = new Date().toISOString();
      c.updatedAt = new Date().toISOString();
      // Injection automatique dans le stock atelier
      (c.lignes || []).forEach(ligne => {
        if (!ligne.fournitureId || !ligne.quantite) return;
        const current = s.stockAtelier[ligne.fournitureId] || 0;
        s.stockAtelier[ligne.fournitureId] = current + Number(ligne.quantite);
        // Trace dans l'historique des mouvements
        if (!s.mouvements) s.mouvements = [];
        s.mouvements.push({
          id: Helpers.uid('mv_'),
          fournitureId: ligne.fournitureId,
          type: 'entree',
          quantite: Number(ligne.quantite),
          emplacement: 'atelier',
          motif: `Livraison commande ${c.numero}`,
          date: new Date().toISOString()
        });
      });
    });
  },

  _nextCommandeNumber() {
    const year = new Date().getFullYear();
    const prefix = `CMD-${year}-`;
    const existing = this.state.commandes
      .filter(c => c.numero && c.numero.startsWith(prefix))
      .map(c => parseInt(c.numero.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    return prefix + String(next).padStart(4, '0');
  },

  /** Suggère des commandes auto basées sur les seuils d'alerte et délais fournisseur */
  suggestCommandes() {
    const suggestions = [];
    const byFournisseur = new Map();

    this.state.fournitures.forEach(f => {
      const total = (this.state.stockAtelier[f.id] || 0) +
        Object.values(this.state.stockCamions || {})
          .reduce((s, c) => s + (c[f.id] || 0), 0);
      if (total > (f.seuilAlerte || 0)) return;

      // Trouver le meilleur fournisseur pour cette fourniture
      // (par défaut : le 1er qui a la même catégorie, sinon n'importe lequel)
      const candidats = this.state.fournisseurs.filter(fr =>
        !fr.categorie || !f.categorie || fr.categorie === f.categorie
      );
      const fournisseur = candidats[0] || this.state.fournisseurs[0];
      if (!fournisseur) return;

      const aCommander = Math.max((f.seuilAlerte || 5) * 3 - total, (f.seuilAlerte || 5));

      if (!byFournisseur.has(fournisseur.id)) {
        byFournisseur.set(fournisseur.id, {
          fournisseurId: fournisseur.id,
          fournisseurNom: fournisseur.nom,
          delaiLivraison: fournisseur.delaiLivraison || 5,
          lignes: []
        });
      }
      byFournisseur.get(fournisseur.id).lignes.push({
        fournitureId: f.id,
        designation: f.nom,
        quantite: aCommander,
        prixUnitaire: f.prixUnitaire || 0,
        unite: f.unite || 'pcs'
      });
    });

    // Date de commande suggérée : aujourd'hui ; livraison = aujourd'hui + délai
    const today = new Date();
    byFournisseur.forEach(s => {
      const livraison = new Date(today);
      livraison.setDate(livraison.getDate() + s.delaiLivraison);
      suggestions.push({
        ...s,
        dateCommande: today.toISOString().split('T')[0],
        dateLivraisonPrevue: livraison.toISOString().split('T')[0],
        motif: 'reappro',
        montantEstime: s.lignes.reduce((sum, l) => sum + (l.quantite * l.prixUnitaire), 0)
      });
    });

    return suggestions;
  },

  /** Récupère les commandes dans une plage de dates pour le planning */
  getCommandesByPeriod(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    return this.state.commandes.filter(c => {
      if (!c.dateCommande) return false;
      const d = new Date(c.dateCommande);
      return d >= s && d <= e;
    });
  },

  // ============================================================
  // NOTIFICATIONS & RÉAPPROVISIONNEMENT
  // ============================================================
  /**
   * Calcule la date à laquelle il faut commander une fourniture
   * pour ne pas tomber en rupture (en tenant compte du délai fournisseur).
   * Logique simple : si le stock est déjà sous le seuil, il faut commander
   * aujourd'hui. La "date limite de commande" = aujourd'hui (urgent).
   * Retourne { fourniture, fournisseur, delai, dateLimiteCommande, total, seuil } ou null.
   */
  getReapproInfo(fournitureId) {
    const f = this.state.fournitures.find(x => x.id === fournitureId);
    if (!f) return null;
    const total = this.getStockTotal(f.id).total;
    const seuil = f.seuilAlerte || 0;
    if (total > seuil) return null; // pas besoin de réappro

    const candidats = this.state.fournisseurs.filter(fr =>
      !fr.categorie || !f.categorie || fr.categorie === f.categorie
    );
    const fournisseur = candidats[0] || this.state.fournisseurs[0];
    const delai = fournisseur?.delaiLivraison || 5;

    // Date limite : il faut commander maintenant (stock déjà bas)
    const today = new Date();
    return {
      fourniture: f,
      fournisseur,
      delai,
      dateLimiteCommande: today.toISOString().split('T')[0],
      total,
      seuil,
      isRupture: total === 0
    };
  },

  /** Liste de toutes les fournitures nécessitant un réappro */
  getAllReapproNeeded() {
    return this.state.fournitures
      .map(f => this.getReapproInfo(f.id))
      .filter(Boolean);
  },

  /**
   * Génère toutes les notifications à venir dans les N prochains jours.
   * Retourne un tableau trié par date : [{ type, date, isToday, isTomorrow, title, subtitle, icon, color, action }]
   */
  getNotifications(daysAhead = 7) {
    const notifs = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + daysAhead);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // 1) Chantiers qui démarrent
    (this.state.chantiers || []).forEach(c => {
      if (!c.dateDebut) return;
      const d = new Date(c.dateDebut);
      d.setHours(0, 0, 0, 0);
      if (d >= now && d <= horizon) {
        notifs.push({
          type: 'chantier',
          date: c.dateDebut,
          dateObj: d,
          isToday: isSameDay(d, now),
          isTomorrow: isSameDay(d, tomorrow),
          icon: '🏗️',
          color: '#3b82f6',
          title: `Démarrage chantier ${c.numero}`,
          subtitle: c.titre || '',
          action: { kind: 'chantier', id: c.id }
        });
      }
    });

    // 2) Réapprovisionnements nécessaires
    this.getAllReapproNeeded().forEach(info => {
      notifs.push({
        type: 'reappro',
        date: now.toISOString().split('T')[0],
        dateObj: now,
        isToday: true,
        isTomorrow: false,
        icon: '📦',
        color: info.isRupture ? '#ef4444' : '#f59e0b',
        title: info.isRupture
          ? `RUPTURE : ${info.fourniture.nom}`
          : `Stock bas : ${info.fourniture.nom}`,
        subtitle: `${info.total} en stock (seuil ${info.seuil})${info.fournisseur ? ' · délai ' + info.delai + 'j' : ''}`,
        action: { kind: 'reappro', id: info.fourniture.id }
      });
    });

    // 3) Absences qui commencent + périodes d'école (départ ET retour)
    (this.state.absences || []).forEach(a => {
      const p = (this.state.personnel || []).find(x => x.id === a.personnelId);
      if (!p) return;
      const type = this.getTypeAbsence(a.typeId);
      const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;
      const isAlternant = p.role === 'alternant';
      const isEcole = a.typeId === 'ecole';

      const dDebut = new Date(a.dateDebut);
      dDebut.setHours(0, 0, 0, 0);

      // --- Cas spécial : période d'école → notifier le départ ET le retour ---
      if (isEcole) {
        // Départ à l'école
        if (dDebut >= now && dDebut <= horizon) {
          notifs.push({
            type: 'ecole',
            date: a.dateDebut,
            dateObj: dDebut,
            isToday: isSameDay(dDebut, now),
            isTomorrow: isSameDay(dDebut, tomorrow),
            icon: '🎓',
            color: type.couleur,
            title: `${fullName} part à l'école`,
            subtitle: `Jusqu'au ${this._formatDateFr(a.dateFin)}`,
            action: { kind: 'absence', id: a.id }
          });
        }
        // Retour en entreprise = lendemain de la date de fin
        const dRetour = new Date(a.dateFin);
        dRetour.setHours(0, 0, 0, 0);
        dRetour.setDate(dRetour.getDate() + 1);
        if (dRetour >= now && dRetour <= horizon) {
          notifs.push({
            type: 'ecole',
            date: dRetour.toISOString().split('T')[0],
            dateObj: dRetour,
            isToday: isSameDay(dRetour, now),
            isTomorrow: isSameDay(dRetour, tomorrow),
            icon: '🏢',
            color: '#10b981',
            title: `${fullName} revient de l'école`,
            subtitle: `Retour en entreprise`,
            action: { kind: 'absence', id: a.id }
          });
        }
        return; // on a déjà géré l'école
      }

      // --- Cas normal : absence qui commence ---
      if (dDebut >= now && dDebut <= horizon) {
        notifs.push({
          type: isAlternant ? 'alternant' : 'absence',
          date: a.dateDebut,
          dateObj: dDebut,
          isToday: isSameDay(dDebut, now),
          isTomorrow: isSameDay(dDebut, tomorrow),
          icon: isAlternant ? '🎓' : type.icon,
          color: type.couleur,
          title: isAlternant
            ? `${fullName} (alternant) absent`
            : `${fullName} — ${type.label}`,
          subtitle: `Du ${this._formatDateFr(a.dateDebut)} au ${this._formatDateFr(a.dateFin)}`,
          action: { kind: 'absence', id: a.id }
        });
      }
    });

    // 4) Livraisons de commandes prévues
    (this.state.commandes || []).forEach(c => {
      if (!c.dateLivraisonPrevue || c.statut === 'livree' || c.statut === 'annulee') return;
      const d = new Date(c.dateLivraisonPrevue);
      d.setHours(0, 0, 0, 0);
      if (d >= now && d <= horizon) {
        const fournisseur = this.state.fournisseurs.find(f => f.id === c.fournisseurId);
        notifs.push({
          type: 'livraison',
          date: c.dateLivraisonPrevue,
          dateObj: d,
          isToday: isSameDay(d, now),
          isTomorrow: isSameDay(d, tomorrow),
          icon: '🚚',
          color: '#06b6d4',
          title: `Livraison ${c.numero}`,
          subtitle: fournisseur ? fournisseur.nom : '',
          action: { kind: 'commande', id: c.id }
        });
      }
    });

    // 5) Fournitures manquantes sur des chantiers (stock insuffisant)
    (this.state.chantiers || []).forEach(c => {
      const manques = c.fournituresManquantes || [];
      if (manques.length === 0) return;
      notifs.push({
        type: 'manque',
        date: now.toISOString().split('T')[0],
        dateObj: now,
        isToday: true,
        isTomorrow: false,
        icon: '⚠️',
        color: '#ef4444',
        title: `${manques.length} fourniture(s) à commander`,
        subtitle: `Chantier ${c.numero} — stock insuffisant`,
        action: { kind: 'chantier', id: c.id }
      });
    });

    // Tri par date croissante, puis demain/aujourd'hui en avant
    notifs.sort((a, b) => a.dateObj - b.dateObj);
    return notifs;
  },

  _formatDateFr(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  },

  // ============================================================
  // RENDEZ-VOUS (rdvs)
  // ============================================================
  /**
   * Un rendez-vous = {
   *   id, titre, date, heureDebut, heureFin,
   *   conducteurId, clientId, adresse, telephone,
   *   type: 'metre'|'visite'|'devis'|'livraison'|'autre',
   *   notes,
   *   createdAt, updatedAt
   * }
   */
  addRdv(data) {
    const r = {
      id: Helpers.uid('rdv_'),
      titre: '',
      date: new Date().toISOString().split('T')[0],
      heureDebut: '09:00',
      heureFin: '10:00',
      conducteurId: null,
      clientId: null,
      adresse: '',
      telephone: '',
      type: 'visite',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    this.commit('rdv:add', s => {
      if (!s.rdvs) s.rdvs = [];
      s.rdvs.push(r);
    });
    return r;
  },

  updateRdv(id, patch) {
    this.commit('rdv:update', s => {
      if (!s.rdvs) return;
      const r = s.rdvs.find(x => x.id === id);
      if (r) {
        Object.assign(r, patch);
        r.updatedAt = new Date().toISOString();
      }
    });
  },

  deleteRdv(id) {
    this.commit('rdv:delete', s => {
      if (!s.rdvs) return;
      s.rdvs = s.rdvs.filter(r => r.id !== id);
    });
  },

  // ============================================================
  // EQUIPES / CONDUCTEURS
  // ============================================================
  /**
   * Une équipe = {
   *   id, nom, couleur, specialite,
   *   chefId: id du personnel chef d'équipe (optionnel),
   *   membresIds: [ids personnel] (ouvriers/alternants),
   *   membres: ancien champ texte libre (déprécié mais gardé pour compatibilité)
   * }
   */
  addEquipe(data) {
    const e = {
      id: Helpers.uid('eq_'),
      nom: '',
      couleur: '#3B82F6',
      specialite: '',
      chefId: null,
      membresIds: [],
      membres: [], // legacy, ne plus utiliser
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

  /** Récupère tous les membres d'une équipe (chef + ouvriers + alternants) */
  getEquipeMembers(equipeId) {
    const eq = this.state.equipes.find(e => e.id === equipeId);
    if (!eq) return { chef: null, membres: [] };
    const chef = eq.chefId ? this.state.personnel.find(p => p.id === eq.chefId) : null;
    const membres = (eq.membresIds || [])
      .map(id => this.state.personnel.find(p => p.id === id))
      .filter(Boolean);
    return { chef, membres };
  },

  /** Vérifie si une personne est déjà engagée ailleurs un jour donné (chantier ou absence)
   *  Retourne { ok: bool, reason, chantierId? } */
  isPersonAvailable(personnelId, dateDebut, dateFin, excludeChantierId = null) {
    // Vérif absence
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin || dateDebut);
    const absences = (this.state.absences || []).filter(a => {
      if (a.personnelId !== personnelId) return false;
      const ad = new Date(a.dateDebut);
      const af = new Date(a.dateFin);
      return ad <= d2 && af >= d1;
    });
    if (absences.length > 0) {
      const type = this.getTypeAbsence(absences[0].typeId);
      return { ok: false, reason: 'absence', type, absence: absences[0] };
    }

    // Vérif chantier en cours
    const conflits = this.state.chantiers.filter(c => {
      if (excludeChantierId && c.id === excludeChantierId) return false;
      if (!c.dateDebut || !c.dateFin) return false;
      const cd = new Date(c.dateDebut);
      const cf = new Date(c.dateFin);
      if (!(cd <= d2 && cf >= d1)) return false;

      // La personne est-elle dans l'équipe ou les renforts du chantier ?
      const eq = c.equipeId ? this.state.equipes.find(e => e.id === c.equipeId) : null;
      const inEquipe = eq && (eq.chefId === personnelId || (eq.membresIds || []).includes(personnelId));
      const inRenforts = (c.renforts || []).includes(personnelId);

      // S'il y a personnel exclu/ajouté pour ce chantier précisément
      const exclude = (c.personnelExclu || []).includes(personnelId);
      if (exclude) return false; // exclu de ce chantier précis, donc pas de conflit ici

      return inEquipe || inRenforts;
    });
    if (conflits.length > 0) {
      return { ok: false, reason: 'chantier', chantier: conflits[0] };
    }

    return { ok: true };
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
  // PERSONNEL (unifié : conducteurs, chefs, ouvriers, alternants)
  // ============================================================
  /**
   * Un membre du personnel = {
   *   id, nom, prenom (optionnel), role ('conducteur'|'chef'|'ouvrier'|'alternant'|'autre'),
   *   couleur, telephone, email, equipeIds: [],
   *   actif (bool), createdAt, updatedAt
   * }
   */
  addPersonnel(data) {
    const p = {
      id: Helpers.uid('pers_'),
      nom: '',
      prenom: '',
      role: 'ouvrier',
      couleur: '#3b82f6',
      telephone: '',
      email: '',
      equipeIds: [],
      actif: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    this.commit('personnel:add', s => {
      if (!s.personnel) s.personnel = [];
      s.personnel.push(p);
    });
    return p;
  },

  updatePersonnel(id, patch) {
    this.commit('personnel:update', s => {
      if (!s.personnel) return;
      const p = s.personnel.find(x => x.id === id);
      if (p) {
        Object.assign(p, patch);
        p.updatedAt = new Date().toISOString();
      }
    });
  },

  deletePersonnel(id) {
    this.commit('personnel:delete', s => {
      if (!s.personnel) return;
      // Supprimer aussi les absences liées
      if (s.absences) s.absences = s.absences.filter(a => a.personnelId !== id);
      s.personnel = s.personnel.filter(p => p.id !== id);
    });
  },

  // ============================================================
  // PÉRIODES À L'ÉCOLE (alternants) — stockées comme absences type 'ecole'
  // ============================================================
  /** Ajoute une période d'école pour un alternant */
  addPeriodeEcole(personnelId, dateDebut, dateFin, notes = '') {
    return this.addAbsence({
      personnelId,
      typeId: 'ecole',
      dateDebut,
      dateFin,
      notes
    });
  },

  /** Récupère les périodes d'école d'un alternant (triées par date) */
  getPeriodesEcole(personnelId) {
    return (this.state.absences || [])
      .filter(a => a.personnelId === personnelId && a.typeId === 'ecole')
      .sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));
  },

  /**
   * Migration automatique :
   * - Conducteurs existants → personnel (rôle = 'conducteur')
   * - Membres texte libre des équipes → personnel (rôle = 'ouvrier')
   */
  migrateConducteursToPersonnel() {
    if (!this.state.personnel) this.state.personnel = [];

    let migrated = 0;

    // Migrer les conducteurs
    (this.state.conducteurs || []).forEach(c => {
      // Vérifier qu'il n'existe pas déjà dans le personnel
      const exists = this.state.personnel.some(p =>
        p._legacyConducteurId === c.id ||
        (p.role === 'conducteur' && p.nom === c.nom)
      );
      if (exists) return;

      this.state.personnel.push({
        id: Helpers.uid('pers_'),
        _legacyConducteurId: c.id,
        nom: c.nom || 'Sans nom',
        prenom: c.prenom || '',
        role: 'conducteur',
        couleur: c.couleur || '#3b82f6',
        telephone: c.telephone || '',
        email: c.email || '',
        equipeIds: [],
        actif: true,
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      migrated++;
    });

    // Migrer les membres texte libre des équipes
    (this.state.equipes || []).forEach(eq => {
      if (!eq.membres) return;
      // Les membres peuvent être string ou array
      let membresArr = [];
      if (typeof eq.membres === 'string') {
        membresArr = eq.membres.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(eq.membres)) {
        membresArr = eq.membres.filter(Boolean);
      }

      membresArr.forEach(nom => {
        if (typeof nom !== 'string' || !nom.trim()) return;
        const cleanNom = nom.trim();
        // Vérifier doublon
        const exists = this.state.personnel.some(p =>
          (p.nom + ' ' + (p.prenom || '')).toLowerCase().includes(cleanNom.toLowerCase()) ||
          cleanNom.toLowerCase().includes(p.nom.toLowerCase())
        );
        if (exists) {
          // Ajouter l'équipe à la personne existante si pas déjà
          const existing = this.state.personnel.find(p =>
            (p.nom + ' ' + (p.prenom || '')).toLowerCase().includes(cleanNom.toLowerCase()) ||
            cleanNom.toLowerCase().includes(p.nom.toLowerCase())
          );
          if (existing && !existing.equipeIds.includes(eq.id)) {
            existing.equipeIds.push(eq.id);
          }
          return;
        }

        this.state.personnel.push({
          id: Helpers.uid('pers_'),
          nom: cleanNom,
          prenom: '',
          role: 'ouvrier',
          couleur: eq.couleur || '#3b82f6',
          telephone: '',
          email: '',
          equipeIds: [eq.id],
          actif: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        migrated++;
      });
    });

    if (migrated > 0) {
      this.save();
    }
    return migrated;
  },

  getPersonnelByRole(role) {
    return (this.state.personnel || []).filter(p => p.role === role && p.actif !== false);
  },

  getPersonnelByEquipe(equipeId) {
    return (this.state.personnel || []).filter(p =>
      (p.equipeIds || []).includes(equipeId) && p.actif !== false
    );
  },

  // ============================================================
  // ABSENCES (congés, maladie, formation, etc.)
  // ============================================================
  /**
   * Types d'absence par défaut. L'utilisateur peut en ajouter d'autres via typesAbsence.
   */
  TYPES_ABSENCE_DEFAUT: [
    { id: 'conges',    label: 'Congés payés',    icon: '🌴', couleur: '#10b981' },
    { id: 'maladie',   label: 'Maladie',         icon: '🏥', couleur: '#ef4444' },
    { id: 'familial',  label: 'Congé familial',  icon: '👶', couleur: '#f59e0b' },
    { id: 'formation', label: 'Formation',       icon: '📚', couleur: '#8b5cf6' },
    { id: 'ecole',     label: 'École (alternance)', icon: '🎓', couleur: '#ec4899' },
    { id: 'rtt',       label: 'RTT',             icon: '⏰', couleur: '#06b6d4' },
    { id: 'autre',     label: 'Autre',           icon: '📅', couleur: '#64748b' }
  ],

  getTypesAbsence() {
    return [...this.TYPES_ABSENCE_DEFAUT, ...(this.state.typesAbsence || [])];
  },

  getTypeAbsence(typeId) {
    return this.getTypesAbsence().find(t => t.id === typeId) || this.TYPES_ABSENCE_DEFAUT[this.TYPES_ABSENCE_DEFAUT.length - 1];
  },

  addTypeAbsence(data) {
    const t = {
      id: 'custom_' + Helpers.uid('').replace('_', ''),
      label: '',
      icon: '📅',
      couleur: '#64748b',
      ...data
    };
    this.commit('typeAbsence:add', s => {
      if (!s.typesAbsence) s.typesAbsence = [];
      s.typesAbsence.push(t);
    });
    return t;
  },

  /**
   * Une absence = {
   *   id, personnelId, typeId, dateDebut, dateFin,
   *   notes, createdAt, updatedAt
   * }
   */
  addAbsence(data) {
    const a = {
      id: Helpers.uid('abs_'),
      personnelId: null,
      typeId: 'conges',
      dateDebut: new Date().toISOString().split('T')[0],
      dateFin: new Date().toISOString().split('T')[0],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    this.commit('absence:add', s => {
      if (!s.absences) s.absences = [];
      s.absences.push(a);
    });
    return a;
  },

  updateAbsence(id, patch) {
    this.commit('absence:update', s => {
      if (!s.absences) return;
      const a = s.absences.find(x => x.id === id);
      if (a) {
        Object.assign(a, patch);
        a.updatedAt = new Date().toISOString();
      }
    });
  },

  deleteAbsence(id) {
    this.commit('absence:delete', s => {
      if (!s.absences) return;
      s.absences = s.absences.filter(a => a.id !== id);
    });
  },

  /** Vérifie si une personne est en absence à une date donnée */
  isPersonnelAbsent(personnelId, dateISO) {
    const d = new Date(dateISO);
    return (this.state.absences || []).some(a => {
      if (a.personnelId !== personnelId) return false;
      const debut = new Date(a.dateDebut);
      const fin = new Date(a.dateFin);
      return d >= debut && d <= fin;
    });
  },

  /** Retourne les absences qui chevauchent une période */
  getAbsencesForPeriod(personnelId, dateDebut, dateFin) {
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    return (this.state.absences || []).filter(a => {
      if (a.personnelId !== personnelId) return false;
      const ad = new Date(a.dateDebut);
      const af = new Date(a.dateFin);
      // Chevauchement si: début_a <= fin_periode && fin_a >= début_periode
      return ad <= d2 && af >= d1;
    });
  },

  /** Vérifie si un conducteur peut être attribué à un chantier (pas d'absence) */
  canAssignToChantier(personnelOrConducteurId, dateDebut, dateFin) {
    // Cherche dans le personnel (avec support legacy conducteur)
    const personnel = (this.state.personnel || []).find(p =>
      p.id === personnelOrConducteurId || p._legacyConducteurId === personnelOrConducteurId
    );
    if (!personnel) return { ok: true };

    const conflicts = this.getAbsencesForPeriod(personnel.id, dateDebut, dateFin);
    if (conflicts.length === 0) return { ok: true };

    return {
      ok: false,
      personnel,
      conflicts
    };
  },

  // ============================================================
  // MODELES DE CHANTIER (bibliothèque de fournitures par type)
  // ============================================================
  /**
   * Un modèle = {
   *   id, nom, description, categorie,
   *   lignes: [{ fournitureId, designation, quantite, mode ('m2'|'fixe'), unite }],
   *   createdAt, updatedAt
   * }
   */
  addModele(data) {
    const m = {
      id: Helpers.uid('mod_'),
      nom: '',
      description: '',
      categorie: '',
      lignes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    this.commit('modele:add', s => {
      if (!s.modeles) s.modeles = [];
      s.modeles.push(m);
    });
    return m;
  },

  updateModele(id, patch) {
    this.commit('modele:update', s => {
      if (!s.modeles) return;
      const m = s.modeles.find(x => x.id === id);
      if (m) {
        Object.assign(m, patch);
        m.updatedAt = new Date().toISOString();
      }
    });
  },

  deleteModele(id) {
    this.commit('modele:delete', s => {
      if (!s.modeles) return;
      s.modeles = s.modeles.filter(m => m.id !== id);
    });
  },

  duplicateModele(id) {
    const orig = this.state.modeles?.find(m => m.id === id);
    if (!orig) return null;
    return this.addModele({
      ...orig,
      id: undefined,
      nom: orig.nom + ' (copie)',
      createdAt: undefined,
      updatedAt: undefined
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
      chantiers: [], clients: [], cotes: [], categoriesCotes: [], fournitures: [],
      stockAtelier: {}, stockCamions: {}, reservations: [], mouvements: [],
      engins: [], reservationsEngins: [], fournisseurs: [], commandes: [], rdvs: [],
      modeles: [], equipes: [], conducteurs: [], personnel: [], absences: [], typesAbsence: [], rendezVous: [],
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
