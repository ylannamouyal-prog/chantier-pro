// PdfExport - génération PDF pro avec jsPDF
window.PdfExport = (function () {
  function getJsPDF() {
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  // ============================================================
  // CALCUL FOURNITURES ESTIMÉES D'UN CHANTIER
  // Basé sur les OUVRAGES (modèles) associés aux catégories de cotes.
  // Pour chaque cote : surface = L×H×qté, périmètre = 2(L+H)×qté, nombre = qté.
  // On applique le modèle de la catégorie pour calculer chaque fourniture.
  // Retourne un tableau de lignes { designation, quantite, unite, prixUnitaire, total, prixSource }
  // ============================================================
  function computeFournituresChantier(cotes) {
    // Regroupe les quantités par fourniture (clé = fournitureId ou designation)
    const accumulator = {};

    (cotes || []).forEach(cote => {
      const cat = (Store.state.categoriesCotes || []).find(c => c.id === cote.categorieId);
      if (!cat || !cat.modeleId) return; // pas de modèle associé → pas de calcul auto

      const modele = (Store.state.modeles || []).find(m => m.id === cat.modeleId);
      if (!modele || !modele.lignes) return;

      const qte = cote.quantite || 1;
      const largeur = (cote.largeur || 0) / 1000;  // mm → m
      const hauteur = (cote.hauteur || 0) / 1000;  // mm → m
      const surface = largeur * hauteur * qte;
      const perimetre = 2 * (largeur + hauteur) * qte;

      modele.lignes.forEach(ligne => {
        const mode = ligne.mode || 'm2';
        let quantite;
        if (mode === 'm2') quantite = ligne.quantite * surface;
        else if (mode === 'perimetre') quantite = ligne.quantite * perimetre;
        else quantite = ligne.quantite * qte; // fixe

        const key = ligne.fournitureId || ligne.designation;
        if (!accumulator[key]) {
          const fourn = Store.state.fournitures.find(f => f.id === ligne.fournitureId);
          accumulator[key] = {
            designation: ligne.designation || fourn?.nom || 'Fourniture',
            quantite: 0,
            unite: ligne.unite || fourn?.unite || 'u',
            prixUnitaire: fourn?.prixUnitaire || 0,
            prixSource: fourn?.prixUnitaire ? 'stock' : 'défaut'
          };
        }
        accumulator[key].quantite += quantite;
      });
    });

    // Transforme en tableau avec total
    return Object.values(accumulator).map(item => ({
      ...item,
      quantite: Math.ceil(item.quantite * 100) / 100, // arrondi 2 décimales
      total: item.quantite * item.prixUnitaire
    }));
  }

  function chantier(id) {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const ch = Store.state.chantiers.find(c => c.id === id);
    if (!ch) return;
    const client = Store.state.clients.find(c => c.id === ch.clientId);
    const conducteur = Store.state.conducteurs.find(c => c.id === ch.conducteurId);
    const equipe = Store.state.equipes.find(e => e.id === ch.equipeId);
    const cotes = Store.getCotesByChantier(id);
    const reservations = (Store.state.reservationsEngins || []).filter(r => r.chantierId === id);
    const entreprise = Store.state.parametres?.entreprise || {};

    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Header entreprise
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (entreprise.adresse) doc.text(entreprise.adresse, margin, 22);
    const contactLine = [entreprise.telephone, entreprise.email].filter(Boolean).join(' • ');
    if (contactLine) doc.text(contactLine, margin, 28);
    if (entreprise.siret) doc.text(`SIRET : ${entreprise.siret}`, margin, 33);

    // N° chantier à droite
    doc.setFontSize(10);
    doc.text(`N° ${ch.numero}`, pageWidth - margin, 15, { align: 'right' });
    doc.text(`Émis le ${Format.date(new Date())}`, pageWidth - margin, 22, { align: 'right' });

    y = 45;
    doc.setTextColor(15, 23, 42);

    // Titre chantier
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHE CHANTIER', margin, y);
    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(ch.titre, margin, y);
    y += 10;

    // Bloc client / chantier
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, pageWidth - 2 * margin, 35);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT', margin + 3, y + 6);
    doc.text('CHANTIER', pageWidth / 2 + 3, y + 6);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let yc = y + 12;
    if (client) {
      doc.setFont('helvetica', 'bold');
      doc.text(client.nom, margin + 3, yc);
      doc.setFont('helvetica', 'normal');
      yc += 5;
      if (client.role) {
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(client.role, margin + 3, yc); yc += 4;
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
      }
      if (client.adresse) { doc.text(client.adresse, margin + 3, yc); yc += 4; }
      const cityLine = [client.codePostal, client.ville].filter(Boolean).join(' ');
      if (cityLine) { doc.text(cityLine, margin + 3, yc); yc += 4; }
      if (client.telephone) { doc.text('Tél : ' + client.telephone, margin + 3, yc); yc += 4; }
      if (client.email) { doc.text('Email : ' + client.email, margin + 3, yc); yc += 4; }

      // Contacts secondaires marqués afficherPdf
      const contactsPdf = (client.contacts || []).filter(ct => ct.afficherPdf);
      if (contactsPdf.length > 0) {
        yc += 2;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('Autres contacts :', margin + 3, yc); yc += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        contactsPdf.forEach(ct => {
          const line1 = ct.nom + (ct.role ? ' — ' + ct.role : '');
          doc.text(line1, margin + 3, yc); yc += 3.5;
          const contactInfos = [];
          if (ct.telephone) contactInfos.push('☎ ' + ct.telephone);
          if (ct.email) contactInfos.push('✉ ' + ct.email);
          if (contactInfos.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(contactInfos.join('  ·  '), margin + 3, yc); yc += 4;
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
          }
        });
      }
    }

    let yr = y + 12;
    if (ch.adresse) { doc.text(ch.adresse, pageWidth / 2 + 3, yr); yr += 4; }
    if (ch.ville) { doc.text(ch.ville, pageWidth / 2 + 3, yr); yr += 4; }
    doc.text(`Période : du ${Format.dateShort(ch.dateDebut)} au ${Format.dateShort(ch.dateFin)}`, pageWidth / 2 + 3, yr); yr += 4;
    const status = Helpers.computeStatus(ch);
    doc.text(`Statut : ${Helpers.statusLabel(status)}`, pageWidth / 2 + 3, yr);

    y += 42;

    // Équipe
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('ÉQUIPE & CONDUCTEUR', margin, y);
    y += 5;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Conducteur : ${conducteur?.nom || '—'}`, margin, y);
    doc.text(`Équipe : ${equipe?.nom || '—'}`, margin + 80, y);
    y += 10;

    // Cotes
    if (cotes.length > 0 && doc.autoTable) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('PRISES DE COTES', margin, y);
      y += 3;

      const totalSurface = cotes.reduce((s, c) => s + (c.largeur * c.hauteur * (c.quantite || 1)) / 1000000, 0);

      doc.autoTable({
        startY: y + 2,
        head: [['N°', 'Emplacement', 'L (mm)', 'H (mm)', 'Qté', 'Surface', 'Type']],
        body: cotes.map((c, i) => [
          String(i + 1).padStart(2, '0'),
          c.emplacement || '',
          c.largeur,
          c.hauteur,
          c.quantite || 1,
          ((c.largeur * c.hauteur * (c.quantite || 1)) / 1000000).toFixed(3) + ' m²',
          c.type || ''
        ]),
        foot: [['', 'TOTAL', '', '', cotes.reduce((s, c) => s + (c.quantite || 1), 0), totalSurface.toFixed(3) + ' m²', '']],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // FOURNITURES & COÛT TOTAL
    if (cotes.length > 0 && doc.autoTable) {
      if (y > 220) { doc.addPage(); y = margin; }
      const fournitures = computeFournituresChantier(cotes);
      const totalHT = fournitures.reduce((s, f) => s + f.total, 0);
      const hasPrixDefaut = fournitures.some(f => f.prixSource === 'défaut');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('FOURNITURES ESTIMÉES & COÛT', margin, y);
      y += 3;

      doc.autoTable({
        startY: y + 2,
        head: [['Désignation', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT']],
        body: fournitures.map(f => [
          f.designation,
          f.quantite.toFixed(2),
          f.unite,
          f.prixUnitaire.toFixed(2) + ' €' + (f.prixSource === 'défaut' ? ' *' : ''),
          f.total.toFixed(2) + ' €'
        ]),
        foot: [['', '', '', 'TOTAL HT', totalHT.toFixed(2) + ' €']],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 11 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          1: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable.finalY + 4;

      if (hasPrixDefaut) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text('* Prix indicatif (fourniture non trouvée dans le stock — à ajuster dans la page Stocks)', margin, y);
        y += 6;
      } else {
        y += 4;
      }
      doc.setTextColor(15, 23, 42);
    }

    // BILAN DÉPENSES COMPLET (commandes chantier + dépenses manuelles + total)
    if (doc.autoTable) {
      const bilan = Store.getBilanChantier ? Store.getBilanChantier(id) : null;
      if (bilan) {
        // Commandes chantier réelles
        if (bilan.commandes.length > 0) {
          if (y > 230) { doc.addPage(); y = margin; }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text('COMMANDES PASSÉES POUR CE CHANTIER', margin, y);
          y += 3;

          const cmdRows = [];
          bilan.commandes.forEach(c => {
            (c.lignes || []).forEach(l => {
              cmdRows.push([
                c.numero,
                l.designation,
                l.quantite + ' ' + (l.unite || ''),
                (l.prixUnitaire || 0).toFixed(2) + ' €',
                (l.quantite * (l.prixUnitaire || 0)).toFixed(2) + ' €'
              ]);
            });
          });

          doc.autoTable({
            startY: y + 2,
            head: [['Commande', 'Désignation', 'Qté', 'PU HT', 'Total HT']],
            body: cmdRows,
            foot: [['', '', '', 'SOUS-TOTAL', bilan.totalCommandes.toFixed(2) + ' €']],
            theme: 'striped',
            headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
            margin: { left: margin, right: margin }
          });
          y = doc.lastAutoTable.finalY + 6;
        }

        // Dépenses manuelles
        if (bilan.manuelles.length > 0) {
          if (y > 230) { doc.addPage(); y = margin; }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text('AUTRES DÉPENSES', margin, y);
          y += 3;

          const CATS = {
            'location': 'Location', 'carburant': 'Carburant',
            'main-oeuvre': "Main d'œuvre", 'sous-traitance': 'Sous-traitance', 'autre': 'Autre'
          };

          doc.autoTable({
            startY: y + 2,
            head: [['Libellé', 'Catégorie', 'Date', 'Montant HT']],
            body: bilan.manuelles.map(d => [
              d.libelle,
              CATS[d.categorie] || 'Autre',
              d.date ? Format.dateShort(d.date) : '—',
              (parseFloat(d.montant) || 0).toFixed(2) + ' €'
            ]),
            foot: [['', '', 'SOUS-TOTAL', bilan.totalManuelles.toFixed(2) + ' €']],
            theme: 'striped',
            headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 3: { halign: 'right' } },
            margin: { left: margin, right: margin }
          });
          y = doc.lastAutoTable.finalY + 6;
        }

        // BILAN TOTAL (encadré)
        if (bilan.totalGeneral > 0) {
          if (y > 250) { doc.addPage(); y = margin; }
          const lineH = 7;
          const boxH = 8 + lineH * 4;
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(15, 23, 42);
          doc.rect(margin, y, pageWidth - 2 * margin, boxH, 'FD');

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 70, 90);
          let ly = y + 7;
          const lineItem = (label, val, bold) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            if (bold) { doc.setFontSize(12); doc.setTextColor(15, 23, 42); }
            doc.text(label, margin + 4, ly);
            doc.text(val, pageWidth - margin - 4, ly, { align: 'right' });
            ly += lineH;
            if (bold) { doc.setFontSize(10); doc.setTextColor(60, 70, 90); }
          };
          lineItem('Fournitures estimées', bilan.totalFournitures.toFixed(2) + ' €');
          lineItem('Commandes chantier', bilan.totalCommandes.toFixed(2) + ' €');
          lineItem('Autres dépenses', bilan.totalManuelles.toFixed(2) + ' €');
          // ligne séparation
          doc.setDrawColor(200, 205, 215);
          doc.line(margin + 4, ly - 4, pageWidth - margin - 4, ly - 4);
          lineItem('COÛT TOTAL DU CHANTIER (HT)', bilan.totalGeneral.toFixed(2) + ' €', true);
          y += boxH + 6;
          doc.setTextColor(15, 23, 42);
        }
      }
    }

    // Engins
    if (reservations.length > 0) {
      if (y > 240) { doc.addPage(); y = margin; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ENGINS RÉSERVÉS', margin, y);
      y += 3;
      doc.autoTable({
        startY: y + 2,
        head: [['Engin', 'Période']],
        body: reservations.map(r => {
          const e = Store.state.engins.find(en => en.id === r.enginId);
          return [e?.nom || '?', `${Format.dateShort(r.dateDebut)} au ${Format.dateShort(r.dateFin)}`];
        }),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Notes
    if (ch.notes) {
      if (y > 240) { doc.addPage(); y = margin; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('NOTES', margin, y);
      y += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(ch.notes, pageWidth - 2 * margin);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 5;
    }

    // Signatures
    if (y > 240) { doc.addPage(); y = margin; }
    y = Math.max(y, 240);
    doc.setDrawColor(100, 116, 139);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Signature conducteur', margin, y + 5);
    doc.text('Signature client', pageWidth - margin - 70, y + 5);

    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${entreprise.nom || 'ChantierPro'} • Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Chantier_${ch.numero}_${(client?.nom || 'client').replace(/\W+/g, '_')}.pdf`);
    Toast.success('PDF généré');
  }

  function planning() {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const entreprise = Store.state.parametres?.entreprise || {};

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 12);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('PLANNING DES CHANTIERS', margin, 20);
    doc.setFontSize(9);
    doc.text(`Édité le ${Format.date(new Date())}`, pageWidth - margin, 12, { align: 'right' });

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    const chantiers = Store.state.chantiers
      .filter(c => new Date(c.dateFin) >= startMonth && new Date(c.dateDebut) <= endMonth)
      .sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));

    if (doc.autoTable) {
      doc.autoTable({
        startY: 32,
        head: [['N°', 'Chantier', 'Client', 'Conducteur', 'Équipe', 'Début', 'Fin', 'Statut']],
        body: chantiers.map(c => {
          const client = Store.state.clients.find(cl => cl.id === c.clientId);
          const cond = Store.state.conducteurs.find(co => co.id === c.conducteurId);
          const eq = Store.state.equipes.find(e => e.id === c.equipeId);
          return [
            c.numero,
            c.titre,
            client?.nom || '—',
            cond?.nom || '—',
            eq?.nom || '—',
            Format.dateShort(c.dateDebut),
            Format.dateShort(c.dateFin),
            Helpers.statusLabel(Helpers.computeStatus(c))
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5 },
        margin: { left: margin, right: margin }
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${i}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Planning_${now.toISOString().split('T')[0]}.pdf`);
    Toast.success('Planning PDF généré');
  }

  // ============================================================
  // EXPORT MOUVEMENTS DE STOCK (PDF, filtrable par période)
  // ============================================================
  function mouvements(filter = null) {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const entreprise = Store.state.parametres?.entreprise || {};

    // Filtrage
    let mvts = (Store.state.mouvements || []).slice();
    if (filter && (filter.month != null || filter.year != null)) {
      mvts = mvts.filter(m => {
        const d = new Date(m.date);
        if (filter.year != null && d.getFullYear() !== filter.year) return false;
        if (filter.month != null && d.getMonth() !== filter.month) return false;
        return true;
      });
    }
    mvts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // En-tête
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 12);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('MOUVEMENTS DE STOCK', margin, 20);
    doc.setFontSize(9);
    doc.text(`Édité le ${Format.date(new Date())}`, pageWidth - margin, 12, { align: 'right' });

    const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    let periodeLabel = 'Tous les mouvements';
    if (filter && filter.month != null && filter.year != null) periodeLabel = `${MOIS[filter.month]} ${filter.year}`;
    else if (filter && filter.year != null) periodeLabel = `Année ${filter.year}`;
    doc.text(periodeLabel, pageWidth - margin, 20, { align: 'right' });

    if (mvts.length === 0) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text('Aucun mouvement pour cette période.', margin, 40);
      doc.save(`Mouvements_${new Date().toISOString().split('T')[0]}.pdf`);
      Toast.warning('Aucun mouvement pour cette période');
      return;
    }

    // Stats résumé
    const entrees = mvts.filter(m => m.type === 'entree').length;
    const sorties = mvts.filter(m => m.type === 'sortie').length;
    const transferts = mvts.filter(m => m.type === 'transfert').length;

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text(`${mvts.length} mouvement(s) · ${entrees} entrée(s) · ${sorties} sortie(s)${transferts ? ' · ' + transferts + ' transfert(s)' : ''}`, margin, 32);

    if (doc.autoTable) {
      doc.autoTable({
        startY: 37,
        head: [['Date', 'Type', 'Fourniture', 'Qté', 'Emplacement', 'Motif']],
        body: mvts.map(m => {
          const f = Store.state.fournitures.find(x => x.id === m.fournitureId);
          const empLabel = m.emplacement === 'atelier' ? 'Atelier'
            : Store.state.equipes.find(e => e.id === m.emplacement)?.nom || m.emplacement;
          const typeLabel = { entree: 'Entrée', sortie: 'Sortie', transfert: 'Transfert' }[m.type] || m.type;
          return [
            Format.dateShort(m.date),
            typeLabel,
            f?.nom || '—',
            (m.type === 'sortie' ? '-' : m.type === 'entree' ? '+' : '') + m.quantite + ' ' + (f?.unite || ''),
            empLabel,
            m.motif || '—'
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 3: { halign: 'right' } },
        margin: { left: margin, right: margin }
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${entreprise.nom || 'ChantierPro'} • Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Mouvements_${periodeLabel.replace(/\s+/g, '_')}.pdf`);
    Toast.success('Mouvements PDF générés');
  }

  // ============================================================
  // EXPORT ÉTAT DU STOCK (PDF, atelier + tous les camions)
  // ============================================================
  function stockEtat() {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const entreprise = Store.state.parametres?.entreprise || {};

    // En-tête
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 12);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('ÉTAT DU STOCK', margin, 20);
    doc.setFontSize(9);
    doc.text(`Édité le ${Format.date(new Date())}`, pageWidth - margin, 12, { align: 'right' });

    let y = 32;

    // Fonction qui dessine une section de stock
    const drawStockSection = (titre, stockObj, couleur) => {
      const rows = Store.state.fournitures
        .map(f => {
          const qte = stockObj[f.id] || 0;
          return { f, qte };
        })
        .filter(r => r.qte > 0); // n'afficher que ce qui est présent

      if (rows.length === 0) return;

      if (y > 250) { doc.addPage(); y = margin; }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(titre, margin, y);
      y += 2;

      const totalValue = rows.reduce((s, r) => s + r.qte * (r.f.prixUnitaire || 0), 0);

      doc.autoTable({
        startY: y + 2,
        head: [['Référence', 'Désignation', 'Quantité', 'Unité', 'Prix unit. HT', 'Valeur HT', 'Seuil']],
        body: rows.map(({ f, qte }) => {
          const sousSeuil = qte <= (f.seuilAlerte || 0);
          return [
            f.reference || '—',
            f.nom,
            { content: String(qte), styles: { fontStyle: sousSeuil ? 'bold' : 'normal', textColor: sousSeuil ? [220, 38, 38] : [15, 23, 42] } },
            f.unite || '',
            (f.prixUnitaire || 0).toFixed(2) + ' €',
            (qte * (f.prixUnitaire || 0)).toFixed(2) + ' €',
            String(f.seuilAlerte || 0)
          ];
        }),
        foot: [['', '', '', '', 'TOTAL', totalValue.toFixed(2) + ' €', '']],
        theme: 'striped',
        headStyles: { fillColor: couleur, textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable.finalY + 8;
    };

    // Atelier
    drawStockSection('🏭 Atelier', Store.state.stockAtelier || {}, [59, 130, 246]);

    // Chaque camion / équipe
    (Store.state.equipes || []).forEach(eq => {
      const stockCamion = (Store.state.stockCamions || {})[eq.id] || {};
      drawStockSection(`🚚 ${eq.nom}`, stockCamion, [16, 185, 129]);
    });

    // Valeur totale globale
    let grandTotal = 0;
    Store.state.fournitures.forEach(f => {
      const totalQte = Store.getStockTotal(f.id).total;
      grandTotal += totalQte * (f.prixUnitaire || 0);
    });

    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, pageWidth - 2 * margin, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VALEUR TOTALE DU STOCK (HT)', margin + 3, y + 8);
    doc.text(grandTotal.toFixed(2) + ' €', pageWidth - margin - 3, y + 8, { align: 'right' });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${entreprise.nom || 'ChantierPro'} • Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Etat_stock_${new Date().toISOString().split('T')[0]}.pdf`);
    Toast.success('État du stock PDF généré');
  }

  // ============================================================
  // EXPORT PDF — LISTE DES CLIENTS
  // ============================================================
  function clients() {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Librairie PDF non chargée'); return; }

    const liste = (Store.state.clients || []).slice().sort((a, b) =>
      (a.nom || '').localeCompare(b.nom || ''));
    const entreprise = Store.state.parametres?.entreprise || {};

    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header entreprise
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (entreprise.adresse) doc.text(entreprise.adresse, margin, 22);
    const contactLine = [entreprise.telephone, entreprise.email].filter(Boolean).join(' • ');
    if (contactLine) doc.text(contactLine, margin, 28);

    doc.setFontSize(10);
    doc.text(`Émis le ${Format.date(new Date())}`, pageWidth - margin, 15, { align: 'right' });
    doc.text(`${liste.length} client${liste.length > 1 ? 's' : ''}`, pageWidth - margin, 22, { align: 'right' });

    let y = 45;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTE DES CLIENTS', margin, y);
    y += 8;

    // Tableau des clients
    if (doc.autoTable) {
      const rows = liste.map(c => {
        const nbChantiers = (Store.state.chantiers || []).filter(ch => ch.clientId === c.id).length;
        const adresse = [c.adresse, c.codePostal, c.ville].filter(Boolean).join(', ');
        return [
          c.nom || '—',
          c.entreprise || '',
          c.telephone ? Format.phone(c.telephone) : '',
          c.email || '',
          adresse,
          String(nbChantiers)
        ];
      });

      doc.autoTable({
        startY: y,
        head: [['Nom', 'Entreprise', 'Téléphone', 'Email', 'Adresse', 'Chantiers']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          5: { halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
    }

    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${entreprise.nom || 'ChantierPro'} • Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Clients_${Format.date(new Date()).replace(/\//g, '-')}.pdf`);
    Toast.success('Liste des clients exportée en PDF');
  }

  return { chantier, planning, mouvements, stockEtat, computeFournituresChantier, reservationsEngins, clients };

  function reservationsEngins(filter = null) {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const entreprise = Store.state.parametres?.entreprise || {};

    let resas = (Store.state.reservationsEngins || []).slice();
    if (filter && (filter.month != null || filter.year != null)) {
      resas = resas.filter(r => {
        const d = new Date(r.dateDebut);
        if (filter.year != null && d.getFullYear() !== filter.year) return false;
        if (filter.month != null && d.getMonth() !== filter.month) return false;
        return true;
      });
    }
    resas.sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));

    // En-tête
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 12);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('RÉSERVATIONS ENGINS', margin, 20);
    doc.setFontSize(9);
    doc.text(`Édité le ${Format.date(new Date())}`, pageWidth - margin, 12, { align: 'right' });

    const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    let periodeLabel = 'Toutes les réservations';
    if (filter && filter.month != null && filter.year != null) periodeLabel = `${MOIS[filter.month]} ${filter.year}`;
    else if (filter && filter.year != null) periodeLabel = `Année ${filter.year}`;
    doc.text(periodeLabel, pageWidth - margin, 20, { align: 'right' });

    if (resas.length === 0) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text('Aucune réservation pour cette période.', margin, 40);
      doc.save(`Reservations_engins_${new Date().toISOString().split('T')[0]}.pdf`);
      Toast.warning('Aucune réservation pour cette période');
      return;
    }

    // Calcul coût total estimé
    let coutTotal = 0;
    const rows = resas.map(r => {
      const engin = Store.state.engins.find(e => e.id === r.enginId);
      const chantier = Store.state.chantiers.find(c => c.id === r.chantierId);
      const jours = Math.max(1, Math.round((new Date(r.dateFin) - new Date(r.dateDebut)) / 86400000) + 1);
      const cout = (engin?.coutJournalier || 0) * jours;
      coutTotal += cout;
      return [
        Format.dateShort(r.dateDebut) + ' au ' + Format.dateShort(r.dateFin),
        engin?.nom || '—',
        (engin?.disponibilite === 'location' ? '🔑 Location' : '🏭 Atelier'),
        chantier?.numero || '—',
        jours + ' j',
        cout > 0 ? cout.toFixed(2) + ' €' : '—'
      ];
    });

    if (doc.autoTable) {
      doc.autoTable({
        startY: 32,
        head: [['Période', 'Engin', 'Disponibilité', 'Chantier', 'Durée', 'Coût estimé']],
        body: rows,
        foot: [['', '', '', '', 'TOTAL', coutTotal.toFixed(2) + ' €']],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
        margin: { left: margin, right: margin }
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${entreprise.nom || 'ChantierPro'} • Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Reservations_engins_${periodeLabel.replace(/\s+/g, '_')}.pdf`);
    Toast.success('Réservations PDF générées');
  }
})();
