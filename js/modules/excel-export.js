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

  function mouvements(filter = null) {
    const XLSX = getXLSX();
    if (!XLSX) { Toast.error('Bibliothèque Excel non chargée'); return; }

    let mvts = (Store.state.mouvements || []).slice();

    // Filtre par mois/année
    if (filter && (filter.month != null || filter.year != null)) {
      mvts = mvts.filter(m => {
        const d = new Date(m.date);
        if (filter.year != null && d.getFullYear() !== filter.year) return false;
        if (filter.month != null && d.getMonth() !== filter.month) return false;
        return true;
      });
    }

    const rows = mvts
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

    if (rows.length === 0) { Toast.warning('Aucun mouvement pour cette période'); return; }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');
    const suffix = filterSuffix(filter);
    XLSX.writeFile(wb, `mouvements${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    Toast.success('Excel téléchargé');
  }

  function filterSuffix(filter) {
    if (!filter) return '';
    const parts = [];
    if (filter.month != null) parts.push(String(filter.month + 1).padStart(2, '0'));
    if (filter.year != null) parts.push(filter.year);
    return parts.length ? '_' + parts.join('-') : '';
  }

  function reservationsEngins(filter = null) {
    const XLSX = getXLSX();
    if (!XLSX) { Toast.error('Bibliothèque Excel non chargée'); return; }

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

    if (resas.length === 0) { Toast.warning('Aucune réservation pour cette période'); return; }

    const rows = resas.map(r => {
      const engin = Store.state.engins.find(e => e.id === r.enginId);
      const chantier = Store.state.chantiers.find(c => c.id === r.chantierId);
      const jours = Math.max(1, Math.round((new Date(r.dateFin) - new Date(r.dateDebut)) / 86400000) + 1);
      const cout = (engin?.coutJournalier || 0) * jours;
      return {
        'Date début': r.dateDebut,
        'Date fin': r.dateFin,
        'Durée (jours)': jours,
        'Engin': engin?.nom || '',
        'Disponibilité': engin?.disponibilite === 'location' ? 'Location' : 'Atelier',
        'Loueur': engin?.proprietaire || '',
        'Chantier': chantier?.numero || '',
        'Coût/jour': engin?.coutJournalier || 0,
        'Coût total': cout,
        'Notes': r.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Réservations');
    const suffix = filterSuffix(filter);
    XLSX.writeFile(wb, `reservations_engins${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    Toast.success('Excel téléchargé');
  }

  return { chantiers, clients, stocks, mouvements, reservationsEngins };
})();
