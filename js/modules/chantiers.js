/* =================================================================
   CHANTIERS — Liste, filtres, création, détail
   ================================================================= */

const Chantiers = {
  _filters: {
    statut: 'all',
    conducteurId: 'all',
    equipeId: 'all',
    search: ''
  },

  // ===================================================
  // VUE LISTE
  // ===================================================
  render(container) {
    const s = Store.state;

    container.innerHTML = `
      ${UI.viewHeader({
        title: 'Chantiers',
        subtitle: `${s.chantiers.length} chantier${s.chantiers.length > 1 ? 's' : ''} au total`,
        actions: `
          <button class="btn btn--secondary" id="exportChantiersBtn"><span class="btn-icon">⤓</span> Excel</button>
          <button class="btn btn--primary" id="newChantierBtn"><span class="btn-icon">+</span> Nouveau chantier</button>
        `
      })}

      <div class="filters">
        <input type="text" class="form-input" id="filterSearch" placeholder="Rechercher…" style="height:36px;flex:1;min-width:200px;max-width:300px"/>

        <span class="filter-chip ${this._filters.statut === 'all' ? 'active' : ''}" data-status="all">Tous</span>
        ${['en-cours','prevu','termine','en-attente-cotes','en-attente-devis','commande','reporte'].map(st => `
          <span class="filter-chip ${this._filters.statut === st ? 'active' : ''}" data-status="${st}">${Helpers.statusLabel(st)}</span>
        `).join('')}

        <select class="form-select" id="filterCond" style="height:36px;max-width:200px">
          <option value="all">Tous conducteurs</option>
          ${s.conducteurs.map(c => `<option value="${c.id}" ${this._filters.conducteurId === c.id ? 'selected' : ''}>${Helpers.esc(c.nom)}</option>`).join('')}
        </select>

        <select class="form-select" id="filterEq" style="height:36px;max-width:200px">
          <option value="all">Toutes équipes</option>
          ${s.equipes.map(e => `<option value="${e.id}" ${this._filters.equipeId === e.id ? 'selected' : ''}>${Helpers.esc(e.nom)}</option>`).join('')}
        </select>
      </div>

      <div id="chantiersList"></div>
    `;

    this._renderList();

    // Events
    $('#newChantierBtn').addEventListener('click', () => this.openCreate());
    $('#exportChantiersBtn').addEventListener('click', () => ExcelExport.chantiers());

    $('#filterSearch').addEventListener('input', Helpers.debounce(e => {
      this._filters.search = e.target.value.toLowerCase();
      this._renderList();
    }, 200));

    $$('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._filters.statut = chip.dataset.status;
        $$('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.status === this._filters.statut));
        this._renderList();
      });
    });

    $('#filterCond').addEventListener('change', e => { this._filters.conducteurId = e.target.value; this._renderList(); });
    $('#filterEq').addEventListener('change',   e => { this._filters.equipeId     = e.target.value; this._renderList(); });
  },

  _renderList() {
    const wrap = $('#chantiersList');
    if (!wrap) return;

    const filtered = Store.state.chantiers.filter(c => {
      const statut = Helpers.computeStatus(c);
      if (this._filters.statut !== 'all' && statut !== this._filters.statut) return false;
      if (this._filters.conducteurId !== 'all' && c.conducteurId !== this._filters.conducteurId) return false;
      if (this._filters.equipeId !== 'all' && c.equipeId !== this._filters.equipeId) return false;
      if (this._filters.search) {
        const q = this._filters.search;
        const client = Store.getClient(c.clientId);
        const hay = `${c.numero} ${c.titre} ${c.ville} ${c.adresse} ${client?.nom || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      wrap.innerHTML = UI.emptyState({
        icon: '⏍',
        title: 'Aucun chantier trouvé',
        message: 'Ajustez vos filtres ou créez un nouveau chantier.',
        action: `<button class="btn btn--primary" onclick="Chantiers.openCreate()"><span class="btn-icon">+</span> Nouveau chantier</button>`
      });
      return;
    }

    wrap.innerHTML = `<div class="grid grid-cols-auto">${filtered.map(c => this._renderCard(c)).join('')}</div>`;

    $$('.chantier-card').forEach(card => {
      card.addEventListener('click', () => this.openDetail(card.dataset.id));
    });
  },

  _renderCard(c) {
    const statut = Helpers.computeStatus(c);
    const client = Store.getClient(c.clientId);
    const cond = Store.state.conducteurs.find(x => x.id === c.conducteurId);
    const eq = Store.state.equipes.find(x => x.id === c.equipeId);
    const accent = cond?.couleur || Helpers.statusColor(statut);

    return `
      <div class="chantier-card" data-id="${c.id}" style="--accent:${accent}">
        <div class="chantier-card__head">
          <div>
            <div class="chantier-card__num">${c.numero}</div>
            <div class="chantier-card__title">${Helpers.esc(c.titre || 'Sans titre')}</div>
          </div>
          ${UI.statusBadge(statut)}
        </div>
        <div class="chantier-card__client">
          ◉ ${Helpers.esc(client?.nom || 'Client non défini')}
          ${c.ville ? ` · ${Helpers.esc(c.ville)}` : ''}
        </div>
        <div class="chantier-card__meta">
          <div class="chantier-card__meta-item">
            <span class="chantier-card__meta-label">Conducteur</span>
            <span class="chantier-card__meta-value">${cond ? `${UI.colorDot(cond.couleur)} ${Helpers.esc(cond.nom)}` : '—'}</span>
          </div>
          <div class="chantier-card__meta-item">
            <span class="chantier-card__meta-label">Équipe</span>
            <span class="chantier-card__meta-value">${eq ? `${UI.colorDot(eq.couleur)} ${Helpers.esc(eq.nom)}` : '—'}</span>
          </div>
          <div class="chantier-card__meta-item" style="grid-column:1/-1">
            <span class="chantier-card__meta-label">Dates</span>
            <span class="chantier-card__meta-value">${Format.dateRange(c.dateDebut, c.dateFin)}</span>
          </div>
        </div>
      </div>
    `;
  },

  // ===================================================
  // CRÉATION / ÉDITION
  // ===================================================
  openCreate(prefill = {}) {
    this._openForm(null, prefill);
  },

  openEdit(id) {
    const c = Store.getChantier(id);
    if (!c) return;
    this._openForm(c);
  },

  _openForm(chantier, prefill = {}) {
    const isEdit = !!chantier;
    const data = chantier || { ...prefill };
    const s = Store.state;

    const body = el('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label form-required">Titre du chantier</label>
        <input class="form-input" id="f-titre" value="${Helpers.esc(data.titre || '')}" placeholder="Ex: Remplacement vitrages bureaux" />
      </div>

      <div class="form-group--row">
        <div class="form-group">
          <label class="form-label">Client</label>
          <select class="form-select" id="f-client">
            <option value="">— Sélectionner —</option>
            ${s.clients.map(cl => `<option value="${cl.id}" ${data.clientId === cl.id ? 'selected' : ''}>${Helpers.esc(cl.nom)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priorité</label>
          <select class="form-select" id="f-priorite">
            ${['basse','normale','haute'].map(p => `<option value="${p}" ${data.priorite === p ? 'selected' : ''}>${Helpers.capitalize(p)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group--row">
        <div class="form-group">
          <label class="form-label">Ville</label>
          <input class="form-input" id="f-ville" value="${Helpers.esc(data.ville || '')}" placeholder="Paris" />
        </div>
        <div class="form-group">
          <label class="form-label">Adresse</label>
          <input class="form-input" id="f-adresse" value="${Helpers.esc(data.adresse || '')}" placeholder="12 rue de Rivoli" />
        </div>
      </div>

      <div class="form-group--row">
        <div class="form-group">
          <label class="form-label">Conducteur</label>
          <select class="form-select" id="f-conducteur">
            <option value="">— Aucun —</option>
            ${s.conducteurs.map(cd => `<option value="${cd.id}" ${data.conducteurId === cd.id ? 'selected' : ''}>${Helpers.esc(cd.nom)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Équipe</label>
          <select class="form-select" id="f-equipe">
            <option value="">— Aucune —</option>
            ${s.equipes.map(eq => `<option value="${eq.id}" ${data.equipeId === eq.id ? 'selected' : ''}>${Helpers.esc(eq.nom)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group--row">
        <div class="form-group">
          <label class="form-label">Date de début</label>
          <input class="form-input" id="f-debut" type="date" value="${Format.dateISO(data.dateDebut)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Date de fin</label>
          <input class="form-input" id="f-fin" type="date" value="${Format.dateISO(data.dateFin)}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Statut</label>
        <select class="form-select" id="f-statut">
          ${['en-attente-cotes','en-attente-devis','commande','prevu','en-cours','termine','reporte'].map(st => `
            <option value="${st}" ${data.statut === st ? 'selected' : ''}>${Helpers.statusLabel(st)}</option>
          `).join('')}
        </select>
        <span class="form-hint">Le statut peut être recalculé automatiquement selon les dates (sauf si vous le forcez ici).</span>
      </div>

      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="f-notes" placeholder="Détails, contraintes, contacts spécifiques…">${Helpers.esc(data.notes || '')}</textarea>
      </div>
    `;

    const cancelBtn = el('button', { class: 'btn btn--secondary' }, 'Annuler');
    const saveBtn   = el('button', { class: 'btn btn--primary' }, isEdit ? 'Mettre à jour' : 'Créer le chantier');

    cancelBtn.addEventListener('click', () => Modal.close());
    saveBtn.addEventListener('click', () => {
      const formData = {
        titre:        $('#f-titre').value.trim(),
        clientId:     $('#f-client').value || null,
        ville:        $('#f-ville').value.trim(),
        adresse:      $('#f-adresse').value.trim(),
        conducteurId: $('#f-conducteur').value || null,
        equipeId:     $('#f-equipe').value || null,
        dateDebut:    $('#f-debut').value || null,
        dateFin:      $('#f-fin').value || null,
        statut:       $('#f-statut').value,
        priorite:     $('#f-priorite').value,
        notes:        $('#f-notes').value.trim()
      };

      if (!formData.titre) {
        Toast.error('Le titre est obligatoire');
        return;
      }
      if (formData.dateDebut && formData.dateFin && formData.dateDebut > formData.dateFin) {
        Toast.error('La date de fin doit être après la date de début');
        return;
      }

      // Vérification absence (strict)
      if (formData.conducteurId && formData.dateDebut && formData.dateFin && Store.canAssignToChantier) {
        const check = Store.canAssignToChantier(formData.conducteurId, formData.dateDebut, formData.dateFin);
        if (!check.ok) {
          const fullName = [check.personnel.prenom, check.personnel.nom].filter(Boolean).join(' ') || check.personnel.nom;
          const conflitsTexte = check.conflicts.map(a => {
            const t = Store.getTypeAbsence(a.typeId);
            return `${t.icon} ${t.label} (${Format.dateShort(a.dateDebut)} → ${Format.dateShort(a.dateFin)})`;
          }).join(', ');
          Toast.error(`❌ Impossible : ${fullName} est en absence (${conflitsTexte}). Choisissez une autre personne ou modifiez les dates.`);
          return;
        }
      }

      if (isEdit) {
        Store.updateChantier(chantier.id, formData);
        Toast.success('Chantier mis à jour');
      } else {
        const c = Store.addChantier(formData);
        Toast.success(`${c.numero} créé`);
      }
      Modal.close();
      // Re-render
      Router.refresh();
    });

    Modal.open({
      title: isEdit ? `Modifier ${chantier.numero}` : 'Nouveau chantier',
      body,
      footer: [cancelBtn, saveBtn],
      size: 'lg'
    });
  },

  // ===================================================
  // FICHE DÉTAIL
  // ===================================================
  openDetail(id) {
    const c = Store.getChantier(id);
    if (!c) return;

    const client = Store.getClient(c.clientId);
    const cond = Store.state.conducteurs.find(x => x.id === c.conducteurId);
    const eq = Store.state.equipes.find(x => x.id === c.equipeId);
    const cotes = Store.getCotesByChantier(id);
    const reservations = Store.state.reservationsEngins.filter(r => r.chantierId === id);
    const statut = Helpers.computeStatus(c);

    const body = el('div');
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--s-4)">
        <div>
          <div class="chantier-card__num">${c.numero}</div>
          <h2 style="margin-top:4px">${Helpers.esc(c.titre)}</h2>
          <div style="margin-top:var(--s-2)">${UI.statusBadge(statut)}</div>
        </div>
        <div style="display:flex;gap:var(--s-2)">
          <button class="btn btn--secondary btn--sm" id="detPdf"><span class="btn-icon">⤓</span> PDF</button>
          <button class="btn btn--secondary btn--sm" id="detEdit"><span class="btn-icon">✎</span> Modifier</button>
          <button class="btn btn--ghost btn--sm" id="detDelete" style="color:var(--c-danger)">Supprimer</button>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section__title">Informations</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Client</span><span class="detail-value">${Helpers.esc(client?.nom || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Ville · Adresse</span><span class="detail-value">${Helpers.esc(c.ville || '—')}${c.adresse ? ' · ' + Helpers.esc(c.adresse) : ''}</span></div>
          <div class="detail-item"><span class="detail-label">Conducteur</span><span class="detail-value">${cond ? `${UI.colorDot(cond.couleur)} ${Helpers.esc(cond.nom)}` : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Équipe</span><span class="detail-value">${eq ? `${UI.colorDot(eq.couleur)} ${Helpers.esc(eq.nom)}` : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Dates</span><span class="detail-value">${Format.dateRange(c.dateDebut, c.dateFin)}</span></div>
          <div class="detail-item"><span class="detail-label">Priorité</span><span class="detail-value">${Helpers.capitalize(c.priorite || 'normale')}</span></div>
        </div>
      </div>

      ${cotes.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">Prises de cotes (${cotes.length})</div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>#</th><th>Emplacement</th><th>Dimensions</th><th>Surface</th><th>Qté</th></tr>
              </thead>
              <tbody>
                ${cotes.map((co, i) => `
                  <tr>
                    <td>${String(i+1).padStart(2,'0')}</td>
                    <td>${Helpers.esc(co.emplacement)}</td>
                    <td class="mono">${Format.dim(co.largeur, co.hauteur)}</td>
                    <td>${Format.num(Format.surface(co.largeur, co.hauteur), 2)} m²</td>
                    <td>${co.quantite}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${reservations.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">Engins réservés (${reservations.length})</div>
          ${reservations.map(r => {
            const en = Store.state.engins.find(x => x.id === r.enginId);
            return `<div style="padding:var(--s-2) 0;display:flex;justify-content:space-between"><span>⚙ ${Helpers.esc(en?.nom || 'Engin supprimé')}</span><span class="muted">${Format.dateRange(r.dateDebut, r.dateFin)}</span></div>`;
          }).join('')}
        </div>
      ` : ''}

      ${c.notes ? `
        <div class="detail-section">
          <div class="detail-section__title">Notes</div>
          <div style="background:var(--bg-sunken);padding:var(--s-3);border-radius:var(--r-md);white-space:pre-wrap;color:var(--txt-secondary)">${Helpers.esc(c.notes)}</div>
        </div>
      ` : ''}
    `;

    Modal.open({
      title: 'Fiche chantier',
      body,
      size: 'lg',
      footer: el('button', { class: 'btn btn--secondary' }, 'Fermer')
    });

    // Footer button → close
    Modal._closeBtn = null;
    $('#modalFooter .btn--secondary').addEventListener('click', () => Modal.close());

    $('#detEdit').addEventListener('click', () => { Modal.close(); setTimeout(() => this.openEdit(id), 100); });
    $('#detPdf').addEventListener('click', () => PdfExport.chantier(id));
    $('#detDelete').addEventListener('click', async () => {
      const ok = await Modal.confirm({
        title: 'Supprimer ce chantier ?',
        message: `Vous êtes sur le point de supprimer <strong>${c.numero} · ${Helpers.esc(c.titre)}</strong>. Cette action est <strong>irréversible</strong> et supprimera également les prises de cotes associées.`,
        confirmLabel: 'Supprimer définitivement',
        danger: true
      });
      if (ok) {
        Store.deleteChantier(id);
        Toast.success('Chantier supprimé');
        Router.refresh();
      }
    });
  }
};

window.Chantiers = Chantiers;
