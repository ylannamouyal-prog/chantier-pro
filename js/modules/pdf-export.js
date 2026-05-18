// PdfExport - génération PDF pro avec jsPDF
window.PdfExport = (function () {
  function getJsPDF() {
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  // ============================================================
  // CALCUL FOURNITURES ESTIMÉES D'UN CHANTIER
  // Retourne un tableau de lignes { designation, quantite, unite, prixUnitaire, total }
  // ============================================================
  function computeFournituresChantier(cotes) {
    const totalSurface = cotes.reduce((s, c) => s + (c.largeur * c.hauteur * (c.quantite || 1)) / 1000000, 0);
    const totalUnits = cotes.reduce((s, c) => s + (c.quantite || 1), 0);

    // Estimations standard (issues du module Cotes)
    const jointsMetres = totalSurface * 4;       // 4m de joint / m²
    const parcloseMetres = totalSurface * 4;     // 4m de parclose / m²
    const visUnits = Math.ceil(totalUnits * 8);  // 8 vis / unité

    // Cherche une fourniture correspondante dans le stock
    function findFourniture(keywords) {
      if (!Store.state.fournitures) return null;
      return Store.state.fournitures.find(f => {
        const haystack = `${(f.designation || f.nom || '').toLowerCase()} ${(f.reference || '').toLowerCase()} ${(f.categorie || '').toLowerCase()}`;
        return keywords.some(kw => haystack.includes(kw.toLowerCase()));
      });
    }

    const jointFourn = findFourniture(['joint epdm', 'joint étanch', 'joint mousse', 'joint']);
    const parcloseFourn = findFourniture(['parclose', 'baguette']);
    const visFourn = findFourniture(['vis fixation', 'vis inox', 'vis']);

    // Prix par défaut si aucune fourniture correspondante n'a un prix
    const PRIX_DEFAUT = {
      joint: 1.20,       // €/m
      parclose: 3.50,    // €/m
      vis: 0.10          // €/u
    };

    return [
      {
        designation: jointFourn?.designation || jointFourn?.nom || "Joint d'étanchéité",
        quantite: jointsMetres,
        unite: jointFourn?.unite || 'm',
        prixUnitaire: jointFourn?.prixUnitaire || PRIX_DEFAUT.joint,
        prixSource: jointFourn?.prixUnitaire ? 'stock' : 'défaut',
        total: jointsMetres * (jointFourn?.prixUnitaire || PRIX_DEFAUT.joint)
      },
      {
        designation: parcloseFourn?.designation || parcloseFourn?.nom || "Parclose",
        quantite: parcloseMetres,
        unite: parcloseFourn?.unite || 'm',
        prixUnitaire: parcloseFourn?.prixUnitaire || PRIX_DEFAUT.parclose,
        prixSource: parcloseFourn?.prixUnitaire ? 'stock' : 'défaut',
        total: parcloseMetres * (parcloseFourn?.prixUnitaire || PRIX_DEFAUT.parclose)
      },
      {
        designation: visFourn?.designation || visFourn?.nom || "Vis de fixation",
        quantite: visUnits,
        unite: visFourn?.unite || 'pcs',
        prixUnitaire: visFourn?.prixUnitaire || PRIX_DEFAUT.vis,
        prixSource: visFourn?.prixUnitaire ? 'stock' : 'défaut',
        total: visUnits * (visFourn?.prixUnitaire || PRIX_DEFAUT.vis)
      }
    ];
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
      if (client.adresse) { doc.text(client.adresse, margin + 3, yc); yc += 4; }
      const cityLine = [client.codePostal, client.ville].filter(Boolean).join(' ');
      if (cityLine) { doc.text(cityLine, margin + 3, yc); yc += 4; }
      if (client.telephone) { doc.text('Tél : ' + client.telephone, margin + 3, yc); yc += 4; }
    }

    let yr = y + 12;
    if (ch.adresse) { doc.text(ch.adresse, pageWidth / 2 + 3, yr); yr += 4; }
    if (ch.ville) { doc.text(ch.ville, pageWidth / 2 + 3, yr); yr += 4; }
    doc.text(`Période : ${Format.dateShort(ch.dateDebut)} → ${Format.dateShort(ch.dateFin)}`, pageWidth / 2 + 3, yr); yr += 4;
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
          return [e?.nom || '?', `${Format.dateShort(r.dateDebut)} → ${Format.dateShort(r.dateFin)}`];
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

  return { chantier, planning };
})();
