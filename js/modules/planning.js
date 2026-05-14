/* =================================================================
   PLANNING — Calendrier FullCalendar (année/mois/semaine/jour)
   Filtres multi-sélection : conducteurs / équipes / commandes
   ================================================================= */

const Planning = {
  _calendar: null,
  _filters: null,

  // Initialisation des filtres : tout coché par défaut
  _initFilters() {
    if (this._filters) return;
    this._filters = {
      conducteurs: new Set(Store.state.conducteurs.map(c => c.id)),
      equipes: new Set(Store.state.equipes.map(e => e.id)),
      // Nouveau : types d'événements (chantiers et RDV activés par défaut)
      chantiers: true,
      rendezVous: true,
      commandes: false
    };
    this._filters.conducteurs.add('__none__');
  },

  render(container) {
    this._initFilters();
    const conducteurs = Store.state.conducteurs;
    const equipes = Store.state.equipes;
    const commandes = Store.state.commandes || [];
    const alertes = this._getAlertesStock();

    // Compteur pour l'onglet commandes (ce mois-ci + alertes)
    const now = new Date();
    const moisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const moisEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const commandesMois = commandes.filter(c => {
      if (!c.dateCommande) return false;
      const d = new Date(c.dateCommande);
      return d >= moisStart && d <= moisEnd && c.statut !== 'annulee';
    }).length;
    const totalIndicateurs = commandesMois + alertes.length;

    container.innerHTML = `
      ${UI.viewHeader({
        title: 'Planning',
        subtitle: 'Vue d\'ensemble de l\'activité — drag & drop pour replanifier',
        actions: `
          <button class="btn btn--secondary" id="planningExportPdf"><span class="btn-icon">⤓</span> PDF planning</button>
          <button class="btn btn--ghost" id="planningNewRdvBtn"><span class="btn-icon">📅</span> Nouveau RDV</button>
          <button class="btn btn--primary" id="planningNewBtn"><span class="btn-icon">+</span> Nouveau chantier</button>
        `
      })}

      <div class="planning-layout">
        <div class="planning-main">
          <div class="calendar-wrap">
            <div id="calendar"></div>
          </div>
        </div>

        <aside class="planning-sidebar">
          <div class="planning-sidebar__header">
            <h3>Filtres</h3>
            <button class="btn-icon btn-icon--ghost" id="planningResetFilters" title="Tout réinitialiser">↻</button>
          </div>

          <div class="planning-filter-section">
            <div class="planning-filter-section__title">
              <span>👤 Conducteurs</span>
              <span class="planning-filter-count">${this._filters.conducteurs.size}/${conducteurs.length + 1}</span>
            </div>
            <label class="filter-row filter-row--master">
              <input type="checkbox" data-toggle-group="conducteurs" ${this._allChecked('conducteurs', conducteurs.map(c => c.id).concat('__none__')) ? 'checked' : ''}>
              <span class="filter-row__label">Tout sélectionner</span>
            </label>
            <div class="filter-row__divider"></div>
            ${conducteurs.map(c => `
              <label class="filter-row">
                <input type="checkbox" data-filter-cond="${c.id}" ${this._filters.conducteurs.has(c.id) ? 'checked' : ''}>
                <span class="filter-row__color" style="background:${c.couleur}"></span>
                <span class="filter-row__label">${Helpers.esc(c.nom)}</span>
              </label>
            `).join('')}
            <label class="filter-row filter-row--muted">
              <input type="checkbox" data-filter-cond="__none__" ${this._filters.conducteurs.has('__none__') ? 'checked' : ''}>
              <span class="filter-row__color filter-row__color--empty"></span>
              <span class="filter-row__label">Sans conducteur</span>
            </label>
          </div>

          <div class="planning-filter-section">
            <div class="planning-filter-section__title">
              <span>📌 Type d'événement</span>
            </div>
            <label class="filter-row">
              <input type="checkbox" data-filter-type="chantiers" ${this._filters.chantiers ? 'checked' : ''}>
              <span class="filter-row__icon">🏗️</span>
              <span class="filter-row__label">Chantiers</span>
            </label>
            <label class="filter-row">
              <input type="checkbox" data-filter-type="rendezVous" ${this._filters.rendezVous ? 'checked' : ''}>
              <span class="filter-row__icon">📅</span>
              <span class="filter-row__label">Rendez-vous</span>
            </label>
          </div>

          ${equipes.length > 0 ? `
            <div class="planning-filter-section">
              <div class="planning-filter-section__title">
                <span>👷 Équipes</span>
                <span class="planning-filter-count">${this._filters.equipes.size}/${equipes.length}</span>
              </div>
              <label class="filter-row filter-row--master">
                <input type="checkbox" data-toggle-group="equipes" ${this._allChecked('equipes', equipes.map(e => e.id)) ? 'checked' : ''}>
                <span class="filter-row__label">Tout sélectionner</span>
              </label>
              <div class="filter-row__divider"></div>
              ${equipes.map(e => `
                <label class="filter-row">
                  <input type="checkbox" data-filter-eq="${e.id}" ${this._filters.equipes.has(e.id) ? 'checked' : ''}>
                  <span class="filter-row__color" style="background:${e.couleur}"></span>
                  <span class="filter-row__label">${Helpers.esc(e.nom)}</span>
                </label>
              `).join('')}
            </div>
          ` : ''}

          <div class="planning-filter-section">
            <div class="planning-filter-section__title">
              <span>📦 Logistique</span>
            </div>
            <label class="filter-row filter-row--commandes ${this._filters.commandes ? 'is-active' : ''}">
              <input type="checkbox" data-filter-commandes ${this._filters.commandes ? 'checked' : ''}>
              <span class="filter-row__icon">📦</span>
              <span class="filter-row__label">Commandes & alertes</span>
              ${totalIndicateurs > 0 ? `<span class="filter-row__badge">${totalIndicateurs}</span>` : ''}
            </label>
            ${this._filters.commandes && totalIndicateurs > 0 ? `
              <div class="filter-row__hint">
                ${commandesMois > 0 ? `<div>📦 ${commandesMois} commande${commandesMois > 1 ? 's' : ''} ce mois</div>` : ''}
                ${alertes.length > 0 ? `<div>⚠️ ${alertes.length} fourniture${alertes.length > 1 ? 's' : ''} à commander</div>` : ''}
              </div>
            ` : ''}
          </div>
        </aside>
      </div>
    `;

    this._initCalendar();
    this._bindFilters();

    $('#planningNewBtn').addEventListener('click', () => Chantiers.openCreate());
    $('#planningNewRdvBtn')?.addEventListener('click', () => window.RendezVous?.openForm?.());
    $('#planningExportPdf').addEventListener('click', () => PdfExport.planning());
  },

  _allChecked(group, ids) {
    return ids.length > 0 && ids.every(id => this._filters[group].has(id));
  },

  _getAlertesStock() {
    return Store.state.fournitures.filter(f => {
      const total = Store.getStockTotal(f.id).total;
      return total <= (f.seuilAlerte || 0);
    });
  },

  _initCalendar() {
    const calEl = $('#calendar');
    if (!calEl) return;

    const events = this._buildEvents();

    if (this._calendar) {
      this._calendar.destroy();
    }

    this._calendar = new FullCalendar.Calendar(calEl, {
      locale: 'fr',
      initialView: 'dayGridMonth',
      height: 'auto',
      contentHeight: 700,
      firstDay: 1,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay'
      },
      buttonText: {
        today: "Aujourd'hui",
        month: 'Mois',
        week:  'Semaine',
        day:   'Jour',
        year:  'Année'
      },
      multiMonthMaxColumns: 3,
      events: events,
      editable: true,
      dayMaxEvents: 4,
      moreLinkText: n => `+${n}`,
      eventClick: (info) => {
        const type = info.event.extendedProps.type;
        if (type === 'commande') {
          const id = info.event.extendedProps.commandeId;
          if (id && window.Commandes) {
            window.Commandes.openForm(id);
          }
        } else if (type === 'alerte-stock') {
          const fournitureId = info.event.extendedProps.fournitureId;
          this._openCreateCommandeForAlerte(fournitureId);
        } else if (type === 'rdv') {
          const rdvId = info.event.extendedProps.rdvId;
          if (rdvId && window.RendezVous) {
            window.RendezVous.openDetail(rdvId);
          }
        } else {
          const chantierId = info.event.extendedProps.chantierId;
          if (chantierId) Chantiers.openDetail(chantierId);
        }
      },
      eventDrop: (info) => {
        const type = info.event.extendedProps.type;
        if (type === 'rdv') {
          const rdvId = info.event.extendedProps.rdvId;
          const newDate = info.event.start;
          Store.updateRdv(rdvId, {
            date: Format.dateISO(newDate)
          });
          Toast.success('Rendez-vous déplacé');
          return;
        }
        if (type !== 'chantier' && !info.event.extendedProps.chantierId) {
          info.revert();
          return;
        }
        const chantierId = info.event.extendedProps.chantierId;
        const newStart = info.event.start;
        const newEnd = info.event.end || newStart;
        Store.updateChantier(chantierId, {
          dateDebut: Format.dateISO(newStart),
          dateFin: Format.dateISO(new Date(newEnd.getTime() - 24 * 60 * 60 * 1000))
        });
        Toast.success('Chantier replanifié');
      },
      eventResize: (info) => {
        const type = info.event.extendedProps.type;
        if (type !== 'chantier' && !info.event.extendedProps.chantierId) {
          info.revert();
          return;
        }
        const chantierId = info.event.extendedProps.chantierId;
        Store.updateChantier(chantierId, {
          dateDebut: Format.dateISO(info.event.start),
          dateFin: Format.dateISO(new Date(info.event.end.getTime() - 24 * 60 * 60 * 1000))
        });
        Toast.success('Durée mise à jour');
      },
      eventDidMount: (info) => {
        const type = info.event.extendedProps.type;
        if (type === 'commande') {
          const c = Store.state.commandes.find(x => x.id === info.event.extendedProps.commandeId);
          if (c) {
            const f = Store.state.fournisseurs.find(x => x.id === c.fournisseurId);
            const montant = (c.lignes || []).reduce((s, l) => s + (l.quantite || 0) * (l.prixUnitaire || 0), 0);
            const ch = c.chantierId ? Store.state.chantiers.find(x => x.id === c.chantierId) : null;
            const lines = [
              `📦 Commande ${c.numero}`,
              `Fournisseur : ${f?.nom || '—'}`,
              ch ? `Chantier : ${ch.titre}` : 'Réapprovisionnement stock',
              `Montant : ${Format.euro(montant)}`,
              `Statut : ${this._statutLabel(c.statut)}`
            ];
            info.el.title = lines.join('\n');
          }
        } else if (type === 'alerte-stock') {
          const fId = info.event.extendedProps.fournitureId;
          const f = Store.state.fournitures.find(x => x.id === fId);
          if (f) {
            const total = Store.getStockTotal(f.id).total;
            info.el.title = `⚠️ ALERTE STOCK\n${f.nom}\nStock actuel : ${total} ${f.unite}\nSeuil : ${f.seuilAlerte}\n\nCliquer pour créer une commande`;
          }
        } else if (type === 'rdv') {
          const r = Store.state.rendezVous.find(x => x.id === info.event.extendedProps.rdvId);
          if (r) {
            const cond = Store.state.conducteurs.find(c => c.id === r.conducteurId);
            const tInfo = window.RendezVous?.typeInfo?.(r.type) || { label: r.type, icon: '📅' };
            const lines = [
              `${tInfo.icon} ${r.titre}`,
              `Type : ${tInfo.label}`,
              `Horaires : ${r.heureDebut} → ${r.heureFin}`,
              cond ? `Conducteur : ${cond.nom}` : '',
              r.adresse ? `Adresse : ${r.adresse}` : '',
              r.telephone ? `Tél : ${r.telephone}` : ''
            ].filter(Boolean);
            info.el.title = lines.join('\n');
          }
        } else {
          const c = Store.getChantier(info.event.extendedProps.chantierId);
          if (c) {
            const client = Store.getClient(c.clientId);
            info.el.title = `${c.numero} · ${c.titre}\n${client?.nom || ''}\n${Helpers.statusLabel(Helpers.computeStatus(c))}`;
          }
        }
      }
    });
    this._calendar.render();
  },

  _statutLabel(s) {
    return ({ 'a-passer': 'À passer', 'passee': 'Passée', 'livree': 'Livrée', 'annulee': 'Annulée' })[s] || s;
  },

  _buildEvents() {
    const events = [];

    // 1) CHANTIERS (si filtre activé)
    if (this._filters.chantiers) {
      Store.state.chantiers
        .filter(c => c.dateDebut && c.dateFin)
        .filter(c => {
          const condId = c.conducteurId || '__none__';
          if (!this._filters.conducteurs.has(condId)) return false;
          if (c.equipeId && !this._filters.equipes.has(c.equipeId)) return false;
          return true;
        })
        .forEach(c => {
          const cond = Store.state.conducteurs.find(x => x.id === c.conducteurId);
          const color = cond?.couleur || Helpers.statusColor(Helpers.computeStatus(c));
          const endDate = new Date(c.dateFin);
          endDate.setDate(endDate.getDate() + 1);
          events.push({
            id: c.id,
            title: `${c.numero} · ${c.titre}`,
            start: c.dateDebut,
            end: endDate.toISOString().split('T')[0],
            backgroundColor: color,
            borderColor: color,
            extendedProps: { chantierId: c.id, type: 'chantier' }
          });
        });
    }

    // 2) RENDEZ-VOUS (si filtre activé)
    if (this._filters.rendezVous) {
      (Store.state.rendezVous || [])
        .filter(r => {
          const condId = r.conducteurId || '__none__';
          return this._filters.conducteurs.has(condId);
        })
        .forEach(r => {
          const cond = Store.state.conducteurs.find(c => c.id === r.conducteurId);
          const color = cond?.couleur || '#6366f1';
          const tInfo = window.RendezVous?.typeInfo?.(r.type) || { icon: '📅' };
          const start = `${r.date}T${r.heureDebut || '09:00'}:00`;
          const end = `${r.date}T${r.heureFin || '10:00'}:00`;
          events.push({
            id: 'rdv_' + r.id,
            title: `${tInfo.icon} ${r.titre}`,
            start: start,
            end: end,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { rdvId: r.id, type: 'rdv' },
            classNames: ['planning-rdv']
          });
        });
    }

    // 3) COMMANDES (si filtre activé)
    if (this._filters.commandes) {
      (Store.state.commandes || []).forEach(c => {
        if (!c.dateCommande || c.statut === 'annulee') return;
        const f = Store.state.fournisseurs.find(x => x.id === c.fournisseurId);
        const ch = c.chantierId ? Store.state.chantiers.find(x => x.id === c.chantierId) : null;
        const motif = ch ? `🏗️ ${ch.titre}` : `🔄 Stock`;
        const statutIcon = ({ 'a-passer': '⏳', 'passee': '📤', 'livree': '✅' })[c.statut] || '📦';
        events.push({
          id: 'cmd_' + c.id,
          title: `${statutIcon} 📦 ${f?.nom || 'Commande'} — ${motif}`,
          start: c.dateCommande,
          allDay: true,
          backgroundColor: '#f59e0b',
          borderColor: '#f59e0b',
          textColor: '#1f2937',
          extendedProps: { commandeId: c.id, type: 'commande' },
          editable: false,
          classNames: ['planning-commande']
        });
      });

      // 4) ALERTES STOCK
      const today = new Date().toISOString().split('T')[0];
      const alertes = this._getAlertesStock();
      alertes.forEach(f => {
        const total = Store.getStockTotal(f.id).total;
        const isRupture = total === 0;
        events.push({
          id: 'alerte_' + f.id,
          title: `${isRupture ? '🔴 RUPTURE' : '⚠️ À commander'} : ${f.nom} (${total} ${f.unite})`,
          start: today,
          allDay: true,
          backgroundColor: isRupture ? '#ef4444' : '#f59e0b',
          borderColor: isRupture ? '#dc2626' : '#d97706',
          textColor: '#ffffff',
          extendedProps: { fournitureId: f.id, type: 'alerte-stock' },
          editable: false,
          classNames: ['planning-alerte', isRupture ? 'planning-alerte--rupture' : 'planning-alerte--low']
        });
      });
    }

    return events;
  },

  _openCreateCommandeForAlerte(fournitureId) {
    const f = Store.state.fournitures.find(x => x.id === fournitureId);
    if (!f) return;
    const candidats = Store.state.fournisseurs.filter(fr =>
      !fr.categorie || !f.categorie || fr.categorie === f.categorie
    );
    const fournisseur = candidats[0] || Store.state.fournisseurs[0];
    const total = Store.getStockTotal(f.id).total;
    const aCommander = Math.max((f.seuilAlerte || 5) * 3 - total, (f.seuilAlerte || 5));

    const today = new Date();
    const delai = fournisseur?.delaiLivraison || 5;
    const livraison = new Date(today);
    livraison.setDate(livraison.getDate() + delai);

    const prefill = {
      dateCommande: today.toISOString().split('T')[0],
      dateLivraisonPrevue: livraison.toISOString().split('T')[0],
      fournisseurId: fournisseur?.id || '',
      chantierId: null,
      conducteurId: null,
      lignes: [{
        fournitureId: f.id,
        designation: f.nom,
        quantite: aCommander,
        prixUnitaire: f.prixUnitaire || 0,
        unite: f.unite || 'pcs'
      }],
      statut: 'a-passer',
      motif: 'reappro',
      notes: `Créée depuis alerte stock — ${f.nom} (stock actuel : ${total}, seuil : ${f.seuilAlerte})`
    };
    if (window.Commandes?.openForm) {
      window.Commandes.openForm(null, prefill);
    } else {
      Toast.error('Module Commandes non chargé');
    }
  },

  _bindFilters() {
    const view = $('#view');
    if (!view) return;

    view.querySelectorAll('[data-filter-cond]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.filterCond;
        if (e.target.checked) this._filters.conducteurs.add(id);
        else this._filters.conducteurs.delete(id);
        this._refreshEvents();
        this._updateSidebar();
      });
    });

    view.querySelectorAll('[data-filter-eq]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.filterEq;
        if (e.target.checked) this._filters.equipes.add(id);
        else this._filters.equipes.delete(id);
        this._refreshEvents();
        this._updateSidebar();
      });
    });

    view.querySelectorAll('[data-toggle-group]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const group = e.target.dataset.toggleGroup;
        if (group === 'conducteurs') {
          const ids = Store.state.conducteurs.map(c => c.id).concat('__none__');
          this._filters.conducteurs = new Set(e.target.checked ? ids : []);
          view.querySelectorAll('[data-filter-cond]').forEach(c => { c.checked = e.target.checked; });
        } else if (group === 'equipes') {
          const ids = Store.state.equipes.map(eq => eq.id);
          this._filters.equipes = new Set(e.target.checked ? ids : []);
          view.querySelectorAll('[data-filter-eq]').forEach(c => { c.checked = e.target.checked; });
        }
        this._refreshEvents();
        this._updateSidebar();
      });
    });

    const cmdCheck = view.querySelector('[data-filter-commandes]');
    cmdCheck?.addEventListener('change', (e) => {
      this._filters.commandes = e.target.checked;
      const row = e.target.closest('.filter-row--commandes');
      if (row) row.classList.toggle('is-active', e.target.checked);
      this._refreshEvents();
      // Re-render pour mettre à jour les compteurs/hints
      this.refresh();
    });

    // Cases Type d'événement (chantiers / rendez-vous)
    view.querySelectorAll('[data-filter-type]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const t = e.target.dataset.filterType;
        this._filters[t] = e.target.checked;
        this._refreshEvents();
      });
    });

    // Bouton reset filtres
    view.querySelector('#planningResetFilters')?.addEventListener('click', () => {
      this._filters = null;
      this._initFilters();
      this.refresh();
      Toast.success('Filtres réinitialisés');
    });
  },

  /** Met à jour les compteurs et les "Tout sélectionner" sans re-render complet */
  _updateSidebar() {
    const view = $('#view');
    if (!view) return;

    // Mise à jour master checkboxes
    const condIds = Store.state.conducteurs.map(c => c.id).concat('__none__');
    const eqIds = Store.state.equipes.map(e => e.id);
    const condMaster = view.querySelector('[data-toggle-group="conducteurs"]');
    if (condMaster) condMaster.checked = this._allChecked('conducteurs', condIds);
    const eqMaster = view.querySelector('[data-toggle-group="equipes"]');
    if (eqMaster) eqMaster.checked = this._allChecked('equipes', eqIds);

    // Mise à jour des compteurs
    const counts = view.querySelectorAll('.planning-filter-count');
    if (counts[0]) counts[0].textContent = `${this._filters.conducteurs.size}/${condIds.length}`;
    if (counts[1]) counts[1].textContent = `${this._filters.equipes.size}/${eqIds.length}`;
  },

  _refreshEvents() {
    if (!this._calendar) return;
    this._calendar.removeAllEvents();
    this._buildEvents().forEach(e => this._calendar.addEvent(e));
  },

  refresh() {
    const view = $('#view');
    if (view && view.querySelector('#calendar')) {
      this.render(view);
    }
  }
};

window.Planning = Planning;
