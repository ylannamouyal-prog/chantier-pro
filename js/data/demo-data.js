/* =================================================================
   DEMO DATA — Jeu de données réalistes pour menuiserie/vitrage
   ================================================================= */

const DemoData = {
  populate(store) {
    // Reset propre
    store.reset();

    const today = new Date();
    const addDays = (d, n) => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x.toISOString().split('T')[0];
    };

    // ====================== CONDUCTEURS ======================
    const cd1 = store.addConducteur({ nom: 'Marc Dupont',     telephone: '06 12 34 56 78', couleur: '#3B82F6' });
    const cd2 = store.addConducteur({ nom: 'Sophie Martin',   telephone: '06 23 45 67 89', couleur: '#10B981' });
    const cd3 = store.addConducteur({ nom: 'Antoine Bernard', telephone: '06 34 56 78 90', couleur: '#F59E0B' });
    const cd4 = store.addConducteur({ nom: 'Julie Lefèvre',   telephone: '06 45 67 89 01', couleur: '#A855F7' });

    // ====================== ÉQUIPES ======================
    const eq1 = store.addEquipe({ nom: 'Équipe Alpha',  couleur: '#3B82F6', membres: ['Pierre L.', 'Jean V.', 'Karim B.'] });
    const eq2 = store.addEquipe({ nom: 'Équipe Bravo',  couleur: '#10B981', membres: ['Lucas P.', 'Hugo M.'] });
    const eq3 = store.addEquipe({ nom: 'Équipe Charlie', couleur: '#F59E0B', membres: ['Marc D.', 'Théo G.', 'Sami R.'] });
    const eq4 = store.addEquipe({ nom: 'Équipe Delta',  couleur: '#A855F7', membres: ['Romain F.', 'Nora T.'] });

    // ====================== CLIENTS ======================
    const cl1 = store.addClient({ nom: 'SCI Les Acacias',       telephone: '01 42 51 22 33', email: 'contact@sci-acacias.fr',   adresse: '12 rue de Rivoli, 75001 Paris' });
    const cl2 = store.addClient({ nom: 'Mairie de Versailles',  telephone: '01 30 97 84 84', email: 'urbanisme@versailles.fr',  adresse: '4 avenue de Paris, 78000 Versailles' });
    const cl3 = store.addClient({ nom: 'Résidence Le Parc',     telephone: '01 47 12 88 77', email: 'syndic@residenceparc.fr',   adresse: '8 boulevard Voltaire, 92100 Boulogne' });
    const cl4 = store.addClient({ nom: 'Hôtel Saint-Germain',   telephone: '01 45 48 23 11', email: 'maintenance@hsg.com',      adresse: '36 rue Bonaparte, 75006 Paris' });
    const cl5 = store.addClient({ nom: 'M. et Mme Lefort',      telephone: '06 78 90 12 34', email: 'p.lefort@gmail.com',       adresse: '45 rue des Tilleuls, 92200 Neuilly' });
    const cl6 = store.addClient({ nom: 'Cabinet Médical Dr Roy', telephone: '01 56 23 45 67', email: 'cabinet@drroy.fr',         adresse: '17 avenue Mozart, 75016 Paris' });

    // ====================== FOURNITURES ======================
    const f01 = store.addFourniture({ reference: 'JOI-EPDM-9',  designation: 'Joint EPDM 9mm noir',      categorie: 'joints',     unite: 'mètre',  prixUnitaire: 1.20, seuilAlerte: 50 });
    const f02 = store.addFourniture({ reference: 'JOI-SIL-CL',  designation: 'Joint silicone clair',     categorie: 'joints',     unite: 'cartouche', prixUnitaire: 8.50, seuilAlerte: 20 });
    const f03 = store.addFourniture({ reference: 'VIT-44.2-CL', designation: 'Vitrage 44.2 clair feuil.',categorie: 'vitrage',    unite: 'm²',     prixUnitaire: 95,   seuilAlerte: 5 });
    const f04 = store.addFourniture({ reference: 'VIT-DV-4-16', designation: 'Double vitrage 4/16/4 ITR',categorie: 'vitrage',    unite: 'm²',     prixUnitaire: 78,   seuilAlerte: 5 });
    const f05 = store.addFourniture({ reference: 'PAR-CHENE',   designation: 'Parclose chêne 18×18',     categorie: 'bois',       unite: 'mètre',  prixUnitaire: 4.20, seuilAlerte: 30 });
    const f06 = store.addFourniture({ reference: 'PAR-ALU-G',   designation: 'Parclose alu gris',        categorie: 'metal',      unite: 'mètre',  prixUnitaire: 6.80, seuilAlerte: 30 });
    const f07 = store.addFourniture({ reference: 'VIS-INOX-40', designation: 'Vis inox A2 4×40',         categorie: 'visserie',   unite: 'boîte',  prixUnitaire: 12.00, seuilAlerte: 8 });
    const f08 = store.addFourniture({ reference: 'POIG-INOX',   designation: 'Poignée inox brossé',      categorie: 'quincaillerie', unite: 'unité', prixUnitaire: 32, seuilAlerte: 10 });
    const f09 = store.addFourniture({ reference: 'STO-BSO-G',   designation: 'Store BSO Z90 gris',       categorie: 'stores',     unite: 'm²',     prixUnitaire: 220,  seuilAlerte: 3 });
    const f10 = store.addFourniture({ reference: 'CALES-PVC',   designation: 'Cales PVC vitrage 4mm',    categorie: 'accessoires', unite: 'sachet 100', prixUnitaire: 14, seuilAlerte: 15 });
    const f11 = store.addFourniture({ reference: 'MOUS-EXP',    designation: 'Mousse expansive PU',      categorie: 'isolation',  unite: 'cartouche', prixUnitaire: 11, seuilAlerte: 15 });
    const f12 = store.addFourniture({ reference: 'CHEV-MOL-8',  designation: 'Cheville Molly M8',        categorie: 'visserie',   unite: 'boîte',  prixUnitaire: 18, seuilAlerte: 6 });

    // ====================== STOCK ATELIER ======================
    store.setStockAtelier(f01.id, 280);
    store.setStockAtelier(f02.id, 42);
    store.setStockAtelier(f03.id, 18);
    store.setStockAtelier(f04.id, 22);
    store.setStockAtelier(f05.id, 110);
    store.setStockAtelier(f06.id, 75);
    store.setStockAtelier(f07.id, 15);
    store.setStockAtelier(f08.id, 24);
    store.setStockAtelier(f09.id, 8);
    store.setStockAtelier(f10.id, 32);
    store.setStockAtelier(f11.id, 28);
    store.setStockAtelier(f12.id, 4); // critique

    // ====================== STOCK CAMIONS ======================
    [eq1, eq2, eq3, eq4].forEach(eq => {
      store.setStockCamion(eq.id, f01.id, Math.floor(Math.random() * 40) + 10);
      store.setStockCamion(eq.id, f02.id, Math.floor(Math.random() * 8) + 2);
      store.setStockCamion(eq.id, f05.id, Math.floor(Math.random() * 20) + 5);
      store.setStockCamion(eq.id, f07.id, Math.floor(Math.random() * 4) + 1);
      store.setStockCamion(eq.id, f10.id, Math.floor(Math.random() * 6) + 1);
      store.setStockCamion(eq.id, f11.id, Math.floor(Math.random() * 5) + 1);
    });

    // ====================== ENGINS ======================
    const en1 = store.addEngin({ nom: 'Nacelle Haulotte 16m',  type: 'nacelle', modele: 'Compact 16', fournisseur: 'Loxam' });
    const en2 = store.addEngin({ nom: 'Nacelle ciseaux 12m',    type: 'nacelle', modele: 'JLG 3246ES', fournisseur: 'Kiloutou' });
    const en3 = store.addEngin({ nom: 'Échafaudage roulant 8m', type: 'echafaudage', modele: 'Layher Uniroll', fournisseur: 'Loxam' });
    const en4 = store.addEngin({ nom: 'Camion grue 26T',        type: 'camion',  modele: 'MAN TGS', fournisseur: 'Interne' });

    // ====================== FOURNISSEURS ======================
    store.addFournisseur({ nom: 'Vitragexpert SARL',  contact: 'M. Petit',    telephone: '01 48 77 22 33', email: 'commandes@vitragexpert.fr',  delaiLivraison: 5, categories: ['vitrage'] });
    store.addFournisseur({ nom: 'JointPro',            contact: 'Mme Dubois',  telephone: '01 56 12 88 33', email: 'sav@jointpro.fr',            delaiLivraison: 3, categories: ['joints', 'isolation'] });
    store.addFournisseur({ nom: 'Boismax',             contact: 'M. Roussel',  telephone: '02 38 45 67 89', email: 'pro@boismax.fr',              delaiLivraison: 7, categories: ['bois'] });
    store.addFournisseur({ nom: 'Würth France',        contact: 'Service Pro', telephone: '03 88 64 53 00', email: 'pro@wurth.fr',                delaiLivraison: 2, categories: ['visserie', 'accessoires'] });
    store.addFournisseur({ nom: 'StoresDirect',        contact: 'M. Lambert',  telephone: '04 72 38 21 45', email: 'commande@storesdirect.com', delaiLivraison: 10, categories: ['stores'] });

    // ====================== CHANTIERS ======================
    const chantiers = [
      { titre: 'Remplacement vitrages bureaux',
        clientId: cl1.id, ville: 'Paris 1er', adresse: '12 rue de Rivoli',
        conducteurId: cd1.id, equipeId: eq1.id,
        dateDebut: addDays(today, -3), dateFin: addDays(today, 4),
        priorite: 'haute', notes: 'Accès par cour intérieure. Prévoir protections sol.' },
      { titre: 'Pose stores BSO école primaire',
        clientId: cl2.id, ville: 'Versailles', adresse: '4 avenue de Paris',
        conducteurId: cd2.id, equipeId: eq2.id,
        dateDebut: addDays(today, 7),  dateFin: addDays(today, 12),
        priorite: 'normale', notes: 'Intervention vacances scolaires.' },
      { titre: 'Rénovation menuiseries hall',
        clientId: cl3.id, ville: 'Boulogne', adresse: '8 bd Voltaire',
        conducteurId: cd1.id, equipeId: eq3.id,
        dateDebut: addDays(today, 14), dateFin: addDays(today, 21),
        priorite: 'normale' },
      { titre: 'Vitrines hôtel — remplacement',
        clientId: cl4.id, ville: 'Paris 6e',  adresse: '36 rue Bonaparte',
        conducteurId: cd3.id, equipeId: eq4.id,
        dateDebut: addDays(today, -10), dateFin: addDays(today, -2),
        priorite: 'haute', notes: 'Chantier terminé — facturation en cours.' },
      { titre: 'Véranda sur mesure',
        clientId: cl5.id, ville: 'Neuilly', adresse: '45 rue des Tilleuls',
        conducteurId: cd4.id, equipeId: eq1.id,
        statut: 'en-attente-cotes', priorite: 'normale' },
      { titre: 'Devis fenêtres cabinet',
        clientId: cl6.id, ville: 'Paris 16e', adresse: '17 avenue Mozart',
        conducteurId: cd2.id, statut: 'en-attente-devis', priorite: 'basse' },
      { titre: 'Réparation porte vitrée bureau',
        clientId: cl1.id, ville: 'Paris 1er', adresse: '12 rue de Rivoli',
        conducteurId: cd1.id, equipeId: eq2.id,
        dateDebut: addDays(today, 28), dateFin: addDays(today, 29),
        priorite: 'normale' },
      { titre: 'Pose stores intérieurs résidence',
        clientId: cl3.id, ville: 'Boulogne', adresse: '8 bd Voltaire',
        conducteurId: cd4.id, equipeId: eq3.id,
        dateDebut: addDays(today, 35), dateFin: addDays(today, 40),
        priorite: 'basse', statut: 'commande' }
    ];

    const createdChantiers = chantiers.map(c => store.addChantier(c));

    // ====================== COTES ======================
    // Cotes pour le premier chantier (Paris 1er)
    const chId = createdChantiers[0].id;
    [
      { emplacement: 'Bureau 1 — fenêtre Nord', type: 'vitrage', typeCote: 'tableau', largeur: 1200, hauteur: 1500, quantite: 2, acces: 'plain-pied' },
      { emplacement: 'Bureau 1 — fenêtre Est',  type: 'vitrage', typeCote: 'tableau', largeur: 800,  hauteur: 1500, quantite: 1, acces: 'plain-pied' },
      { emplacement: 'Bureau 2 — baie',         type: 'vitrage', typeCote: 'feuillure', largeur: 2400, hauteur: 2100, quantite: 1, acces: 'plain-pied', notes: 'Vitrage feuilleté obligatoire' },
      { emplacement: 'Couloir — imposte',       type: 'vitrage', typeCote: 'tableau', largeur: 1000, hauteur: 600,  quantite: 3, acces: 'échafaudage' }
    ].forEach(c => store.addCote({ ...c, chantierId: chId }));

    // ====================== RÉSERVATIONS ENGINS ======================
    store.reserveEngin({ enginId: en1.id, chantierId: createdChantiers[0].id, dateDebut: addDays(today, -1), dateFin: addDays(today, 2) });
    store.reserveEngin({ enginId: en2.id, chantierId: createdChantiers[1].id, dateDebut: addDays(today, 7),  dateFin: addDays(today, 9) });
    store.reserveEngin({ enginId: en3.id, chantierId: createdChantiers[2].id, dateDebut: addDays(today, 14), dateFin: addDays(today, 18) });

    // ====================== MOUVEMENTS RÉCENTS ======================
    const mvts = [
      { type: 'entree',    fournitureId: f03.id, quantite: 12, source: 'Vitragexpert SARL', note: 'Réception commande #2026-042' },
      { type: 'sortie',    fournitureId: f01.id, quantite: 18, source: createdChantiers[0].numero, note: 'Pose vitrages bureau 1' },
      { type: 'transfert', fournitureId: f07.id, quantite: 4,  source: 'Atelier → Équipe Alpha' },
      { type: 'sortie',    fournitureId: f10.id, quantite: 2,  source: createdChantiers[0].numero }
    ];
    mvts.forEach(m => store.addMouvement(m));

    Toast.success(`${createdChantiers.length} chantiers, ${store.state.clients.length} clients chargés`, 'Données démo prêtes');
  }
};

window.DemoData = DemoData;
