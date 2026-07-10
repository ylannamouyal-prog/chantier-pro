/* =================================================================
   PLANNING — Calendrier FullCalendar (année/mois/semaine/jour)
   Filtres multi-sélection : conducteurs / équipes / commandes
   ================================================================= */

const Planning = {
  _calendar: null,
  _currentView: 'dayGridMonth',  // mémorise la dernière vue choisie
  _filters: null,

  // Initialisation des filtres : tout coché par défaut
  _initFilters() {
    if (this._filters) return;
    this._filters = {
      conducteurs: new Set(Store.state.conducteurs.map(c => c.id)),
      equipes: new Set(Store.state.equipes.map(e => e.id)),
      // Nouveau : types d'événements (chantiers et RDV activés par défaut)
      chantiers: true,
      rdvs: true,
      commandes: false,
      absences: true,
      alternants: false
    };
    this._filters.conducteurs.add('__none__');
  },

  // Fenêtre de choix pour l'export PDF du planning
  openExportDialog() {
    const today = new Date();
    const iso = (d) => d.toISOString().split('T')[0];

    Modal.open({
      title: '⤓ Exporter le planning en PDF',
      size: 'small',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Période</label>
            <select id="exp_periode" class="form-select" data-no-search>
              <option value="semaine">Cette semaine</option>
              <option value="mois" selected>Ce mois</option>
              <option value="trimestre">3 prochains mois</option>
              <option value="perso">Période personnalisée</option>
            </select>
          </div>
          <div class="form-field" id="exp_dates_wrap" style="display:none">
            <label>Du</label>
            <input id="exp_start" class="form-input" type="date" value="${iso(today)}">
          </div>
          <div class="form-field" id="exp_dates_wrap2" style="display:none">
            <label>Au</label>
            <input id="exp_end" class="form-input" type="date" value="${iso(today)}">
          </div>
          <div class="form-field form-field--full">
            <label>Contenu à inclure</label>
            <label class="check-row"><input type="checkbox" id="exp_chantiers" checked> 🏗️ Chantiers</label>
            <label class="check-row"><input type="checkbox" id="exp_rdvs" checked> 📅 Rendez-vous</label>
            <label class="check-row"><input type="checkbox" id="exp_absences" checked> 🌴 Absences & congés</label>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="exp_go">⤓ Générer le PDF</button>
      `,
      onOpen: () => {
        const sel = document.getElementById('exp_periode');
        const wrap1 = document.getElementById('exp_dates_wrap');
        const wrap2 = document.getElementById('exp_dates_wrap2');
        sel.addEventListener('change', () => {
          const perso = sel.value === 'perso';
          wrap1.style.display = perso ? '' : 'none';
          wrap2.style.display = perso ? '' : 'none';
        });

        document.getElementById('exp_go').addEventListener('click', () => {
          const now = new Date();
          let start, end, periodeLabel;
          switch (sel.value) {
            case 'semaine': {
              const day = now.getDay() || 7; // lundi=1..dimanche=7
              start = new Date(now); start.setDate(now.getDate() - day + 1);
              end = new Date(start); end.setDate(start.getDate() + 6);
              periodeLabel = 'Semaine du ' + Format.dateShort(start.toISOString());
              break;
            }
            case 'mois': {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              periodeLabel = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
              break;
            }
            case 'trimestre': {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
              periodeLabel = '3 mois à partir de ' + start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
              break;
            }
            case 'perso': {
              const s = document.getElementById('exp_start').value;
              const e = document.getElementById('exp_end').value;
              if (!s || !e) { Toast.warning('Choisissez les deux dates'); return; }
              if (s > e) { Toast.warning('La date de fin doit être après le début'); return; }
              start = new Date(s); end = new Date(e);
              periodeLabel = Format.dateShort(start.toISOString()) + ' au ' + Format.dateShort(end.toISOString());
              break;
            }
          }

          const include = {
            chantiers: document.getElementById('exp_chantiers').checked,
            rdvs: document.getElementById('exp_rdvs').checked,
            absences: document.getElementById('exp_absences').checked
          };
          if (!include.chantiers && !include.rdvs && !include.absences) {
            Toast.warning('Cochez au moins un élément à inclure');
            return;
          }

          Modal.close();
          PdfExport.planning({ start, end, periodeLabel, include });
        });
      }
    });
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
              <input type="checkbox" data-filter-type="rdvs" ${this._filters.rdvs ? 'checked' : ''}>
              <span class="filter-row__icon">📅</span>
              <span class="filter-row__label">Rendez-vous</span>
            </label>
            <label class="filter-row">
              <input type="checkbox" data-filter-type="absences" ${this._filters.absences ? 'checked' : ''}>
              <span class="filter-row__icon">🌴</span>
              <span class="filter-row__label">Absences</span>
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
    $('#planningExportPdf').addEventListener('click', () => this.openExportDialog());
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
      initialView: this._currentView,
      height: 'auto',
      contentHeight: 700,
      firstDay: 1,
      nowIndicator: true,      // trait rouge à l'heure actuelle (vues Semaine/Jour)
      scrollTime: '07:00:00',  // démarre l'affichage vers 7h du matin
      slotMinTime: '06:00:00',
      slotMaxTime: '20:00:00',
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
      // Mémorise la vue à chaque changement (mois/semaine/jour/année)
      datesSet: (info) => {
        Planning._currentView = info.view.type;
      },
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
        } else if (type === 'reappro-livraison') {
          const fournitureId = info.event.extendedProps.fournitureId;
          this._openCreateCommandeForAlerte(fournitureId);
        } else if (type === 'rdv') {
          const rdvId = info.event.extendedProps.rdvId;
          if (rdvId && window.RendezVous) {
            window.RendezVous.openDetail(rdvId);
          }
        } else if (type === 'absence') {
          const absenceId = info.event.extendedProps.absenceId;
          if (absenceId && window.Absences) {
            window.Absences.openDetail(absenceId);
          }
        } else {
          const chantierId = info.event.extendedProps.chantierId;
          if (chantierId) Chantiers.openDetail(chantierId);
        }
      },
      dateClick: (info) => {
        // Au clic sur un jour vide, on propose un menu : chantier / RDV / absence
        this._openDateActionMenu(info.dateStr);
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
          const r = Store.state.rdvs.find(x => x.id === info.event.extendedProps.rdvId);
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
    if (this._filters.rdvs) {
      (Store.state.rdvs || [])
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

      // 4) ALERTES STOCK + JOUR LIMITE DE COMMANDE
      const today = new Date().toISOString().split('T')[0];
      const alertes = this._getAlertesStock();
      alertes.forEach(f => {
        const total = Store.getStockTotal(f.id).total;
        const isRupture = total === 0;

        // Alerte "à commander maintenant" affichée aujourd'hui
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

        // Indication "commander avant le X" selon le délai fournisseur
        const info = Store.getReapproInfo ? Store.getReapproInfo(f.id) : null;
        if (info && info.fournisseur && info.delai) {
          // Date limite = aujourd'hui (urgent car déjà sous le seuil)
          // On affiche aussi la date de livraison estimée pour info
          const livraison = new Date();
          livraison.setDate(livraison.getDate() + info.delai);
          const livraisonStr = livraison.toISOString().split('T')[0];

          events.push({
            id: 'reappro_livr_' + f.id,
            title: `📦 Livraison ${f.nom} si commandé auj. (délai ${info.delai}j)`,
            start: livraisonStr,
            allDay: true,
            backgroundColor: '#0ea5e9',
            borderColor: '#0284c7',
            textColor: '#ffffff',
            extendedProps: { fournitureId: f.id, type: 'reappro-livraison' },
            editable: false,
            classNames: ['planning-reappro-livr']
          });
        }
      });
    }

    // 5) ABSENCES (si filtre activé)
    if (this._filters.absences) {
      (Store.state.absences || []).forEach(a => {
        const p = (Store.state.personnel || []).find(x => x.id === a.personnelId);
        if (!p) return;

        // Filtre conducteur : si la personne est conducteur, vérifier le filtre
        if (p.role === 'conducteur') {
          const legacyId = p._legacyConducteurId;
          // Vérifie si cette personne (par son id ou son legacy id) est dans les filtres
          if (!this._filters.conducteurs.has(p.id) && !this._filters.conducteurs.has(legacyId) && !this._filters.conducteurs.has('__none__')) {
            return;
          }
        }

        const type = Store.getTypeAbsence(a.typeId);
        const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;
        const endDate = new Date(a.dateFin);
        endDate.setDate(endDate.getDate() + 1);

        events.push({
          id: 'abs_' + a.id,
          title: `${type.icon} ${fullName} — ${type.label}`,
          start: a.dateDebut,
          end: endDate.toISOString().split('T')[0],
          allDay: true,
          backgroundColor: type.couleur,
          borderColor: type.couleur,
          textColor: '#ffffff',
          extendedProps: { absenceId: a.id, type: 'absence', personnelId: p.id },
          editable: false,
          classNames: ['planning-absence', `planning-absence--${a.typeId}`]
        });
      });
    }

    return events;
  },

  /** Menu d'action au clic sur un jour vide du calendrier */
  _openDateActionMenu(dateStr) {
    Modal.open({
      title: `Créer pour le ${Format.dateShort(dateStr)}`,
      size: 'small',
      body: `
        <p class="hint" style="margin:0 0 var(--s-3)">Que voulez-vous créer ?</p>
        <div class="date-action-grid">
          <button class="date-action-btn" data-action="chantier">
            <span class="date-action-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6">🏗️</span>
            <strong>Nouveau chantier</strong>
            <span class="hint">Avec dates, conducteur, équipe...</span>
          </button>
          <button class="date-action-btn" data-action="rdv">
            <span class="date-action-icon" style="background:rgba(99,102,241,0.15);color:#6366f1">📅</span>
            <strong>Nouveau rendez-vous</strong>
            <span class="hint">Métré, visite client, livraison...</span>
          </button>
          <button class="date-action-btn" data-action="absence">
            <span class="date-action-icon" style="background:rgba(16,185,129,0.15);color:#10b981">🌴</span>
            <strong>Nouvelle absence</strong>
            <span class="hint">Congés, maladie, formation...</span>
          </button>
        </div>
      `,
      footer: `<button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>`,
      onOpen: () => {
        document.querySelectorAll('.date-action-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            Modal.close();
            setTimeout(() => {
              if (action === 'chantier' && window.Chantiers) {
                window.Chantiers.openCreate({ dateDebut: dateStr, dateFin: dateStr });
              } else if (action === 'rdv' && window.RendezVous) {
                window.RendezVous.openForm(null, { date: dateStr });
              } else if (action === 'absence' && window.Absences) {
                window.Absences.openForm(null, { dateDebut: dateStr, dateFin: dateStr });
              }
            }, 100);
          });
        });
      }
    });
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
