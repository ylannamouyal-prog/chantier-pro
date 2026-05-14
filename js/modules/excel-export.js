// ExcelExport - via SheetJS
window.ExcelExport = (function () {
  function getXLSX() { return window.XLSX; }

  function chantiers() {
    const XLSX = getXLSX();
    if (!XLSX) { Toast.error('Bibliothèque Excel non chargée'); return; }

    const rows = Store.state.chantiers.map(c => {
      const client = Store.state.clients.find(cl => cl.id === c.clientId);
      const cond = Store.state.conducteurs.find(co => co.id === c.conducteurId);
      const eq = Store.state.equipes.find(e => e.id === c.equipeId);
      return {
        'N°': c.numero,
        'Titre': c.titre,
        'Client': client?.nom || '',
        'Adresse': c.adresse || '',
        'Ville': c.ville || '',
        'Conducteur': cond?.nom || '',
        'Équipe': eq?.nom || '',
        'Date début': c.dateDebut,
        'Date fin': c.dateFin,
        'Statut': Helpers.statusLabel(Helpers.computeStatus(c)),
        'Priorité': c.priorite || '',
        'Notes': c.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chantiers');
    XLSX.writeFile(wb, `chantiers_${new Date().toISOString().split('T')[0]}.xlsx`);
    Toast.success('Excel téléchargé');
  }

  function clients() {
    const XLSX = getXLSX();
    if (!XLSX) { Toast.error('Bibliothèque Excel non chargée'); return; }

    const rows = Store.state.clients.map(c => ({
      'Nom': c.nom,
      'Entreprise': c.entreprise || '',
      'Téléphone': c.telephone || '',
      'Email': c.email || '',
      'Adresse': c.adresse || '',
      'CP': c.codePostal || '',
      'Ville': c.ville || '',
      'Chantiers': Store.state.chantiers.filter(ch => ch.clientId === c.id).length,
      'Notes': c.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 16 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `clients_${new Date().toISOString().split('T')[0]}.xlsx`);
    Toast.success('Excel téléchargé');
  }

  function stocks() {
    const XLSX = getXLSX();
    if (!XLSX) { Toast.error('Bibliothèque Excel non chargée'); return; }

    const wb = XLSX.utils.book_new();

    // Sheet 1 : récapitulatif total
    const recap = Store.state.fournitures.map(f => {
      const atelier = Store.state.stockAtelier[f.id] || 0;
      const camions = Store.state.equipes.reduce((s, e) =>
        s + (Store.state.stockCamions[e.id]?.[f.id] || 0), 0);
      const total = atelier + camions;
      return {
        'Référence': f.reference || '',
        'Nom': f.nom,
        'Catégorie': f.categorie || '',
        'Unité': f.unite || 'pcs',
        'Atelier': atelier,
        'Camions': camions,
        'Total': total,
        'Seuil': f.seuilAlerte || 0,
        'Alerte': total <= (f.seuilAlerte || 0) ? '⚠️' : '',
        'Prix unitaire': f.prixUnitaire || 0,
        'Valeur totale': total * (f.prixUnitaire || 0)
      };
    });
    const wsRecap = XLSX.utils.json_to_sheet(recap);
    wsRecap['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');

    // Sheet par équipe
    Store.state.equipes.forEach(eq => {
      const rows = Store.state.fournitures.map(f => ({
        'Référence': f.reference || '',
        'Nom': f.nom,
        'Quantité': Store.state.stockCamions[eq.id]?.[f.id] || 0,
        'Unité': f.unite || 'pcs'
      })).filter(r => r['Quantité'] > 0);
      if (rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, ws, `Camion ${eq.nom}`.substring(0, 31));
      }
    });

    XLSX.writeFile(wb, `stocks_${new Date().toISOString().split('T')[0]}.xlsx`);
    Toast.success('Excel téléchargé');
  }

  function mouvements() {
    const XLSX = getXLSX();
    if (!XLSX) { Toast.error('Bibliothèque Excel non chargée'); return; }

    const rows = (Store.state.mouvements || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(m => {
        const f = Store.state.fournitures.find(x => x.id === m.fournitureId);
        const empLabel = m.emplacement === 'atelier' ? 'Atelier'
          : Store.state.equipes.find(e => e.id === m.emplacement)?.nom || m.emplacement;
        return {
          'Date': m.date,
          'Type': m.type,
          'Fourniture': f?.nom || '',
          'Quantité': m.quantite,
          'Emplacement': empLabel,
          'Motif': m.motif || ''
        };
      });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');
    XLSX.writeFile(wb, `mouvements_${new Date().toISOString().split('T')[0]}.xlsx`);
    Toast.success('Excel téléchargé');
  }

  return { chantiers, clients, stocks, mouvements };
})();
