/* =================================================================
   PLANNING — Calendrier FullCalendar (année/mois/semaine/jour)
   ================================================================= */

const Planning = {
  _calendar: null,
  _filters: { conducteurId: null, equipeId: null },

  render(container) {
    const conducteurs = Store.state.conducteurs;
    const equipes     = Store.state.equipes;

    container.innerHTML = `
      ${UI.viewHeader({
        title: 'Planning',
        subtitle: 'Vue d\'ensemble de l\'activité — drag & drop pour replanifier',
        actions: `
          <button class="btn btn--secondary" id="planningExportPdf"><span class="btn-icon">⤓</span> PDF planning</button>
          <button class="btn btn--primary" id="planningNewBtn"><span class="btn-icon">+</span> Nouveau chantier</button>
        `
      })}

      <div class="planning-toolbar">
        <div class="filters" style="margin:0;flex:1">
          <span class="filter-chip ${!this._filters.conducteurId && !this._filters.equipeId ? 'active' : ''}" data-filter="all">Tous</span>
          ${conducteurs.map(c => `
            <span class="filter-chip ${this._filters.conducteurId === c.id ? 'active' : ''}" data-filter-cond="${c.id}" style="border-left:3px solid ${c.couleur}">
              ${Helpers.esc(c.nom)}
            </span>
          `).join('')}
        </div>
        <div class="planning-legend">
          ${equipes.slice(0, 4).map(e => `
            <span class="planning-legend__item">${UI.colorDot(e.couleur)} ${Helpers.esc(e.nom)}</span>
          `).join('')}
        </div>
      </div>

      <div class="calendar-wrap">
        <div id="calendar"></div>
      </div>
    `;

    this._initCalendar();
    this._bindFilters();

    $('#planningNewBtn').addEventListener('click', () => Chantiers.openCreate());
    $('#planningExportPdf').addEventListener('click', () => PdfExport.planning());
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
      dayMaxEvents: 3,
      moreLinkText: n => `+${n}`,
      eventClick: (info) => {
        const chantierId = info.event.extendedProps.chantierId;
        if (chantierId) Chantiers.openDetail(chantierId);
      },
      eventDrop: (info) => {
        const chantierId = info.event.extendedProps.chantierId;
        if (!chantierId) return;
        const newStart = info.event.start;
        const newEnd   = info.event.end || newStart;
        Store.updateChantier(chantierId, {
          dateDebut: Format.dateISO(newStart),
          dateFin:   Format.dateISO(new Date(newEnd.getTime() - 24*60*60*1000))
        });
        Toast.success('Chantier replanifié');
      },
      eventResize: (info) => {
        const chantierId = info.event.extendedProps.chantierId;
        if (!chantierId) return;
        Store.updateChantier(chantierId, {
          dateDebut: Format.dateISO(info.event.start),
          dateFin:   Format.dateISO(new Date(info.event.end.getTime() - 24*60*60*1000))
        });
        Toast.success('Durée mise à jour');
      },
      eventDidMount: (info) => {
        // Tooltip natif simple
        const c = Store.getChantier(info.event.extendedProps.chantierId);
        if (c) {
          const client = Store.getClient(c.clientId);
          info.el.title = `${c.numero} · ${c.titre}\n${client?.nom || ''}\n${Helpers.statusLabel(Helpers.computeStatus(c))}`;
        }
      }
    });
    this._calendar.render();
  },

  _buildEvents() {
    return Store.state.chantiers
      .filter(c => c.dateDebut && c.dateFin)
      .filter(c => {
        if (this._filters.conducteurId && c.conducteurId !== this._filters.conducteurId) return false;
        if (this._filters.equipeId && c.equipeId !== this._filters.equipeId) return false;
        return true;
      })
      .map(c => {
        const cond = Store.state.conducteurs.find(x => x.id === c.conducteurId);
        const color = cond?.couleur || Helpers.statusColor(Helpers.computeStatus(c));
        // FullCalendar : la fin est exclusive → +1 jour
        const endDate = new Date(c.dateFin);
        endDate.setDate(endDate.getDate() + 1);
        return {
          id: c.id,
          title: `${c.numero} · ${c.titre}`,
          start: c.dateDebut,
          end: endDate.toISOString().split('T')[0],
          backgroundColor: color,
          borderColor: color,
          extendedProps: { chantierId: c.id }
        };
      });
  },

  _bindFilters() {
    $$('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.dataset.filter === 'all') {
          this._filters = { conducteurId: null, equipeId: null };
        } else if (chip.dataset.filterCond) {
          this._filters.conducteurId = this._filters.conducteurId === chip.dataset.filterCond ? null : chip.dataset.filterCond;
        }
        this.refresh();
      });
    });
  },

  /** Recharge les événements sans recréer toute la vue */
  refresh() {
    const view = $('#view');
    if (view && view.querySelector('#calendar')) {
      this.render(view);
    }
  }
};

window.Planning = Planning;
