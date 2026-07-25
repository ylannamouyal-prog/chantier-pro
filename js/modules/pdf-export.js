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
      if (!cat || !cat.modeleId) return; // pas de modèle associé -> pas de calcul auto

      const modele = (Store.state.modeles || []).find(m => m.id === cat.modeleId);
      if (!modele || !modele.lignes) return;

      const qte = cote.quantite || 1;
      const largeur = (cote.largeur || 0) / 1000;  // mm -> m
      const hauteur = (cote.hauteur || 0) / 1000;  // mm -> m
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
    const contactLine = [entreprise.telephone, entreprise.email].filter(Boolean).join(' - ');
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
          const line1 = ct.nom + (ct.role ? ' - ' + ct.role : '');
          doc.text(line1, margin + 3, yc); yc += 3.5;
          const contactInfos = [];
          if (ct.telephone) contactInfos.push('Tel: ' + ct.telephone);
          if (ct.email) contactInfos.push('Email: ' + ct.email);
          if (contactInfos.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(contactInfos.join('  -  '), margin + 3, yc); yc += 4;
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
    doc.text(`Conducteur : ${conducteur?.nom || '-'}`, margin, y);
    doc.text(`Équipe : ${equipe?.nom || '-'}`, margin + 80, y);
    y += 10;

    // Cotes
    if (cotes.length > 0 && doc.autoTable) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('PRISES DE COTES', margin, y);
      y += 3;

      const totalSurface = cotes.reduce((s, c) => s + (c.largeur * c.hauteur * (c.quantite || 1)) / 1000000, 0);
      const totalPrixCotes = cotes.reduce((s, c) => s + ((parseFloat(c.prix) || 0) * (c.quantite || 1)), 0);
      const hasPrix = cotes.some(c => (parseFloat(c.prix) || 0) > 0);

      doc.autoTable({
        startY: y + 2,
        head: [['N°', 'Emplacement', 'L (mm)', 'H (mm)', 'Qté', 'Surface', 'Type', 'Prix HT']],
        body: cotes.map((c, i) => [
          String(i + 1).padStart(2, '0'),
          c.emplacement || '',
          c.largeur,
          c.hauteur,
          c.quantite || 1,
          ((c.largeur * c.hauteur * (c.quantite || 1)) / 1000000).toFixed(3) + ' m²',
          c.type || '',
          (parseFloat(c.prix) || 0) > 0 ? ((parseFloat(c.prix) || 0) * (c.quantite || 1)).toFixed(2) + ' €' : '-'
        ]),
        foot: [['', 'TOTAL', '', '', cotes.reduce((s, c) => s + (c.quantite || 1), 0), totalSurface.toFixed(3) + ' m²', '', hasPrix ? totalPrixCotes.toFixed(2) + ' €' : '-']],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 7: { halign: 'right' } },
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
        doc.text('* Prix indicatif (fourniture non trouvée dans le stock - à ajuster dans la page Stocks)', margin, y);
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
            'main-oeuvre': "Main d'oeuvre", 'sous-traitance': 'Sous-traitance', 'autre': 'Autre'
          };

          doc.autoTable({
            startY: y + 2,
            head: [['Libellé', 'Catégorie', 'Date', 'Montant HT']],
            body: bilan.manuelles.map(d => [
              d.libelle,
              CATS[d.categorie] || 'Autre',
              d.date ? Format.dateShort(d.date) : '-',
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
          if (y > 245) { doc.addPage(); y = margin; }
          const lineH = 7;
          const boxH = 8 + lineH * 5;
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
          const mo = bilan.mainOeuvre;
          const moLabel = mo && mo.membres.length > 0
            ? `Main d'oeuvre (${mo.membres.length} pers. x ${mo.heuresParPersonne} h)`
            : "Main d'oeuvre";
          lineItem(moLabel, (bilan.totalMainOeuvre || 0).toFixed(2) + ' €');
          lineItem('Autres dépenses', bilan.totalManuelles.toFixed(2) + ' €');
          // ligne séparation
          doc.setDrawColor(200, 205, 215);
          doc.line(margin + 4, ly - 4, pageWidth - margin - 4, ly - 4);
          lineItem('DÉBOURSÉ TOTAL DU CHANTIER (HT)', bilan.totalGeneral.toFixed(2) + ' €', true);
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
      doc.text(`${entreprise.nom || 'ChantierPro'} - Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Chantier_${ch.numero}_${(client?.nom || 'client').replace(/\W+/g, '_')}.pdf`);
    Toast.success('PDF généré');
  }

  function planning(options = {}) {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const include = options.include || { chantiers: true, rdvs: true, absences: true };
    const start = options.start ? new Date(options.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = options.end ? new Date(options.end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const entreprise = Store.state.parametres?.entreprise || {};

    const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    // Couleurs par type d'événement
    const COL_CHANTIER = [59, 130, 246];
    const COL_RDV = [139, 92, 246];
    const COL_ABSENCE = [16, 185, 129];

    // Récupère les événements d'un jour donné
    function eventsForDay(dayDate) {
      const dStart = new Date(dayDate); dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dayDate); dEnd.setHours(23, 59, 59, 999);
      const evs = [];

      if (include.chantiers) {
        (Store.state.chantiers || []).forEach(c => {
          if (!c.dateDebut || !c.dateFin) return;
          const cd = new Date(c.dateDebut); cd.setHours(0, 0, 0, 0);
          const cf = new Date(c.dateFin); cf.setHours(23, 59, 59, 999);
          if (cd <= dEnd && cf >= dStart) {
            evs.push({ type: 'chantier', color: COL_CHANTIER, label: c.titre || c.numero || 'Chantier' });
          }
        });
      }
      if (include.rdvs) {
        (Store.state.rdvs || []).forEach(r => {
          if (!r.date) return;
          const rd = new Date(r.date); rd.setHours(0, 0, 0, 0);
          if (rd.getTime() === dStart.getTime()) {
            evs.push({ type: 'rdv', color: COL_RDV, label: (r.heure ? r.heure + ' ' : '') + (r.titre || 'RDV') });
          }
        });
      }
      if (include.absences) {
        (Store.state.absences || []).forEach(a => {
          if (!a.dateDebut || !a.dateFin) return;
          const ad = new Date(a.dateDebut); ad.setHours(0, 0, 0, 0);
          const af = new Date(a.dateFin); af.setHours(23, 59, 59, 999);
          if (ad <= dEnd && af >= dStart) {
            const p = (Store.state.personnel || []).find(x => x.id === a.personnelId);
            const nom = p ? (p.prenom || p.nom || '') : '';
            const type = Store.getTypeAbsence ? Store.getTypeAbsence(a.typeId) : null;
            evs.push({ type: 'absence', color: COL_ABSENCE, label: (nom ? nom + ' ' : '') + (type?.label || '') });
          }
        });
      }
      return evs;
    }

    // Dessine un mois (une page)
    function drawMonth(year, month, isFirst) {
      if (!isFirst) doc.addPage();

      // En-tête
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text(entreprise.nom || 'ChantierPro', margin, 8);
      doc.setFontSize(13);
      doc.text(`${MOIS[month]} ${year}`, pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Édité le ${Format.date(new Date())}`, pageWidth - margin, 8, { align: 'right' });

      // Légende
      let lx = margin;
      const ly = 23;
      doc.setFontSize(7);
      const legende = [];
      if (include.chantiers) legende.push({ c: COL_CHANTIER, t: 'Chantiers' });
      if (include.rdvs) legende.push({ c: COL_RDV, t: 'Rendez-vous' });
      if (include.absences) legende.push({ c: COL_ABSENCE, t: 'Absences/Congés' });
      legende.forEach(l => {
        doc.setFillColor(l.c[0], l.c[1], l.c[2]);
        doc.rect(lx, ly - 3, 3, 3, 'F');
        doc.setTextColor(60, 60, 60);
        doc.text(l.t, lx + 4, ly);
        lx += doc.getTextWidth(l.t) + 12;
      });

      // Grille du calendrier
      const gridTop = 28;
      const gridBottom = pageHeight - 8;
      const cellW = (pageWidth - 2 * margin) / 7;
      const headerH = 6;

      // En-têtes des jours
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      JOURS.forEach((j, i) => {
        const x = margin + i * cellW;
        doc.rect(x, gridTop, cellW, headerH, 'F');
        doc.text(j, x + cellW / 2, gridTop + 4, { align: 'center' });
      });

      // Calcul des semaines du mois
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      let startOffset = (firstDay.getDay() || 7) - 1; // lundi=0
      const totalDays = lastDay.getDate();
      const totalCells = startOffset + totalDays;
      const weeks = Math.ceil(totalCells / 7);
      const cellH = (gridBottom - gridTop - headerH) / weeks;

      doc.setDrawColor(210, 214, 220);
      doc.setLineWidth(0.2);

      let dayNum = 1;
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const cellIndex = w * 7 + d;
          const x = margin + d * cellW;
          const yTop = gridTop + headerH + w * cellH;

          // Cellule
          doc.setFillColor(255, 255, 255);
          if (d >= 5) doc.setFillColor(247, 248, 250); // week-end grisé
          doc.rect(x, yTop, cellW, cellH, 'FD');

          if (cellIndex >= startOffset && dayNum <= totalDays) {
            const thisDate = new Date(year, month, dayNum);
            // Numéro du jour
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(String(dayNum), x + 1.5, yTop + 4);

            // Événements
            const evs = eventsForDay(thisDate);
            const maxShow = Math.max(1, Math.floor((cellH - 6) / 3.5));
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            evs.slice(0, maxShow).forEach((ev, idx) => {
              const ey = yTop + 6.5 + idx * 3.4;
              doc.setFillColor(ev.color[0], ev.color[1], ev.color[2]);
              doc.rect(x + 1, ey - 2, cellW - 2, 3, 'F');
              doc.setTextColor(255, 255, 255);
              let txt = ev.label;
              const maxChars = Math.floor((cellW - 3) / 1.1);
              if (txt.length > maxChars) txt = txt.slice(0, maxChars - 1) + '…';
              doc.text(txt, x + 1.8, ey + 0.3);
            });
            if (evs.length > maxShow) {
              doc.setTextColor(120, 120, 120);
              doc.setFontSize(5);
              doc.text(`+${evs.length - maxShow}`, x + 1.8, yTop + 6.5 + maxShow * 3.4);
            }
            dayNum++;
          }
        }
      }

      // Pied de page
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`${entreprise.nom || 'ChantierPro'}`, pageWidth / 2, pageHeight - 3, { align: 'center' });
    }

    // Génère une page par mois couvrant la période
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let isFirst = true;
    let guard = 0;
    while (cursor <= end && guard < 36) {
      drawMonth(cursor.getFullYear(), cursor.getMonth(), isFirst);
      isFirst = false;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      guard++;
    }

    doc.save(`Planning_${new Date().toISOString().split('T')[0]}.pdf`);
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
    doc.text(`${mvts.length} mouvement(s) - ${entrees} entrée(s) - ${sorties} sortie(s)${transferts ? ' - ' + transferts + ' transfert(s)' : ''}`, margin, 32);

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
            f?.nom || '-',
            (m.type === 'sortie' ? '-' : m.type === 'entree' ? '+' : '') + m.quantite + ' ' + (f?.unite || ''),
            empLabel,
            m.motif || '-'
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
      doc.text(`${entreprise.nom || 'ChantierPro'} - Page ${i}/${pageCount}`,
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
            f.reference || '-',
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
    drawStockSection('Atelier', Store.state.stockAtelier || {}, [59, 130, 246]);

    // Chaque camion / équipe
    (Store.state.equipes || []).forEach(eq => {
      const stockCamion = (Store.state.stockCamions || {})[eq.id] || {};
      drawStockSection(`Camion ${eq.nom}`, stockCamion, [16, 185, 129]);
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
      doc.text(`${entreprise.nom || 'ChantierPro'} - Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Etat_stock_${new Date().toISOString().split('T')[0]}.pdf`);
    Toast.success('État du stock PDF généré');
  }

  // ============================================================
  // EXPORT PDF - LISTE DES CLIENTS
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
    const contactLine = [entreprise.telephone, entreprise.email].filter(Boolean).join(' - ');
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
          c.nom || '-',
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
      doc.text(`${entreprise.nom || 'ChantierPro'} - Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Clients_${Format.date(new Date()).replace(/\//g, '-')}.pdf`);
    Toast.success('Liste des clients exportée en PDF');
  }

  return { chantier, planning, mouvements, stockEtat, computeFournituresChantier, reservationsEngins, clients, lps };

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
        engin?.nom || '-',
        (engin?.disponibilite === 'location' ? 'Location' : 'Atelier'),
        chantier?.numero || '-',
        jours + ' j',
        cout > 0 ? cout.toFixed(2) + ' €' : '-'
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
      doc.text(`${entreprise.nom || 'ChantierPro'} - Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Reservations_engins_${periodeLabel.replace(/\s+/g, '_')}.pdf`);
    Toast.success('Réservations PDF générées');
  }

  // ============================================================
  // EXPORT PDF - BILAN LAST PLANNER SYSTEM (LPS)
  // ============================================================
  function lps(semaine) {
    const JsPDF = getJsPDF();
    if (!JsPDF) { Toast.error('Bibliothèque PDF non chargée'); return; }

    const key = semaine || Store.getSemaineKey(new Date());
    const { lundi, dimanche } = Store.getSemaineDates(key);
    const taches = Store.getTachesLPSBySemaine(key);
    const ppc = Store.calculerPPC(key);
    const causes = Store.getCausesStatsLPS(key, 1); // causes de CETTE semaine
    const entreprise = Store.state.parametres?.entreprise || {};
    const numSem = key.split('-W')[1];

    // Libellés sans emoji (jsPDF ne les affiche pas correctement)
    const STATUT_TXT = {
      'en-attente':   'En attente',
      'engagee':      'Engagee',
      'terminee':     'Terminee',
      'non-realisee': 'Non realisee'
    };
    const JOURS_TXT = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven' };
    const CAUSE_TXT = {};
    (Store.CAUSES_LPS || []).forEach(c => { CAUSE_TXT[c.id] = c.label; });

    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // --- Header entreprise ---
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(entreprise.nom || 'ChantierPro', margin, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (entreprise.adresse) doc.text(entreprise.adresse, margin, 22);
    const contactLine = [entreprise.telephone, entreprise.email].filter(Boolean).join(' - ');
    if (contactLine) doc.text(contactLine, margin, 28);
    doc.setFontSize(10);
    doc.text(`Emis le ${Format.date(new Date())}`, pageWidth - margin, 15, { align: 'right' });

    y = 45;
    doc.setTextColor(15, 23, 42);

    // --- Titre ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BILAN LAST PLANNER SYSTEM', margin, y);
    y += 8;
    doc.setFontSize(13);
    doc.setTextColor(59, 130, 246);
    doc.text(`Semaine ${numSem} - du ${Format.dateShort(lundi.toISOString())} au ${Format.dateShort(dimanche.toISOString())}`, margin, y);
    y += 10;

    // --- Bloc PPC (mise en avant) ---
    const ppcVal = ppc.ppc === null ? '-' : ppc.ppc + ' %';
    // Couleur selon le PPC
    let ppcColor = [100, 116, 139];
    if (ppc.ppc !== null) {
      if (ppc.ppc >= 80) ppcColor = [16, 185, 129];
      else if (ppc.ppc >= 60) ppcColor = [245, 158, 11];
      else ppcColor = [239, 68, 68];
    }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 26, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PPC (Plan Percent Complete)', margin + 4, y + 7);
    doc.setTextColor(ppcColor[0], ppcColor[1], ppcColor[2]);
    doc.setFontSize(24);
    doc.text(ppcVal, margin + 4, y + 20);

    // Compteurs à droite
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const stats = [
      `Engagees : ${ppc.engagees}`,
      `Terminees : ${ppc.terminees}`,
      `Non realisees : ${ppc.nonRealisees}`,
      `En attente : ${ppc.enAttente}`
    ];
    let ys = y + 6;
    stats.forEach(s => { doc.text(s, pageWidth / 2 + 10, ys); ys += 5; });
    y += 32;

    // --- Tableau des engagements ---
    if (taches.length > 0 && doc.autoTable) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ENGAGEMENTS DE LA SEMAINE', margin, y);
      y += 2;

      doc.autoTable({
        startY: y + 2,
        head: [['Engagement', 'Equipe', 'Jours', 'Statut', 'Cause si non realise']],
        body: taches.map(t => {
          const equipe = (Store.state.equipes || []).find(e => e.id === t.equipeId);
          const jours = (t.jours || []).length > 0
            ? t.jours.map(j => JOURS_TXT[j]).filter(Boolean).join(', ')
            : '-';
          const cause = (t.statut === 'non-realisee' && t.cause)
            ? (CAUSE_TXT[t.cause.code] || 'Autre') + (t.cause.detail ? ' : ' + t.cause.detail : '')
            : '-';
          return [
            t.description || '(sans description)',
            equipe ? equipe.nom : '-',
            jours,
            STATUT_TXT[t.statut] || t.statut,
            cause
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 28 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Aucun engagement enregistre pour cette semaine.', margin, y + 4);
      y += 12;
    }

    // --- Tableau des causes (si des tâches non réalisées) ---
    if (causes.length > 0 && doc.autoTable) {
      if (y > 240) { doc.addPage(); y = margin; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ANALYSE DES CAUSES DE NON-REALISATION', margin, y);
      y += 2;

      const totalCauses = causes.reduce((s, c) => s + c.count, 0);
      doc.autoTable({
        startY: y + 2,
        head: [['Cause racine', 'Nombre', 'Part']],
        body: causes.map(c => [
          c.label,
          String(c.count),
          totalCauses > 0 ? Math.round((c.count / totalCauses) * 100) + ' %' : '-'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // --- Pied de page ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${entreprise.nom || 'ChantierPro'} - Bilan LPS Semaine ${numSem} - Page ${i}/${pageCount}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`Bilan_LPS_S${numSem}_${key.split('-')[0]}.pdf`);
    Toast.success('Bilan LPS exporte en PDF');
  }
})();
