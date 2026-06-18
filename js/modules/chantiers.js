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

    // État du picker d'équipe (snapshot pour ce chantier)
    const pickerState = {
      equipeId: null,
      nom: '',
      couleur: '#3b82f6',
      chefId: null,
      membresIds: []
    };

    // Hydrate depuis le chantier existant
    if (data.equipeSnapshot) {
      pickerState.equipeId = data.equipeId;
      pickerState.nom = data.equipeSnapshot.nom;
      pickerState.couleur = data.equipeSnapshot.couleur;
      pickerState.chefId = data.equipeSnapshot.chefId;
      pickerState.membresIds = (data.equipeSnapshot.membresIds || []).slice();
    } else if (data.equipeId) {
      // Migration : pas de snapshot, on prend la composition actuelle du modèle
      const eq = s.equipes.find(e => e.id === data.equipeId);
      if (eq) {
        pickerState.equipeId = eq.id;
        pickerState.nom = eq.nom;
        pickerState.couleur = eq.couleur;
        pickerState.chefId = eq.chefId || null;
        pickerState.membresIds = (eq.membresIds || []).slice();
      }
    }

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
      </div>

      <!-- Sélection d'équipe par drag & drop -->
      <div class="form-group">
        <label class="form-label">Équipe assignée</label>
        <div class="equipe-picker" data-equipe-picker>
          <div class="equipe-picker__cards" id="equipePickerCards"></div>
          <div class="equipe-picker__hint">Glissez une équipe ci-dessous (ou cliquez puis "Assigner" sur mobile)</div>
          <div class="equipe-picker__drop" id="equipeDropZone">
            <div class="equipe-picker__drop-empty">
              <span class="equipe-picker__drop-icon">⬇</span>
              <span>Déposez une équipe ici</span>
            </div>
            <div class="equipe-picker__drop-filled" hidden>
              <div class="equipe-picker__selected-head">
                <span id="equipeSelectedColor" class="color-swatch-lg"></span>
                <div>
                  <strong id="equipeSelectedNom"></strong>
                  <span id="equipeSelectedSpec" class="hint"></span>
                </div>
                <button type="button" class="btn-icon btn-icon--danger" id="equipeRemoveBtn" title="Retirer l'équipe">✕</button>
              </div>
              <div class="equipe-picker__composition">
                <div class="equipe-picker__composition-head">
                  <strong>Composition pour ce chantier</strong>
                  <button type="button" class="btn btn--ghost btn--sm" id="equipeMembersAddBtn">+ Ajouter un membre</button>
                </div>
                <div id="equipeSelectedMembers" class="equipe-picker__members"></div>
                <p class="hint">Modifications applicables uniquement à ce chantier (ne touche pas le modèle d'équipe).</p>
              </div>
            </div>
          </div>
          <input type="hidden" id="f-equipe" value="${data.equipeId || ''}">
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
        // Snapshot de l'équipe (figée au moment de la création/modif)
        equipeSnapshot: pickerState.equipeId ? {
          nom: pickerState.nom,
          couleur: pickerState.couleur,
          chefId: pickerState.chefId,
          membresIds: pickerState.membresIds.slice()
        } : null,
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

      // Vérification conflits sur les membres de l'équipe (strict)
      if (formData.equipeSnapshot && formData.dateDebut && formData.dateFin) {
        const allMemberIds = [
          formData.equipeSnapshot.chefId,
          ...formData.equipeSnapshot.membresIds
        ].filter(Boolean);
        const conflits = [];
        allMemberIds.forEach(personId => {
          const check = Store.isPersonAvailable(personId, formData.dateDebut, formData.dateFin, isEdit ? chantier.id : null);
          if (!check.ok) {
            const p = Store.state.personnel.find(x => x.id === personId);
            const fullName = p ? ([p.prenom, p.nom].filter(Boolean).join(' ') || p.nom) : '?';
            if (check.reason === 'absence') {
              conflits.push(`${fullName} (${check.type.icon} ${check.type.label})`);
            } else if (check.reason === 'chantier') {
              conflits.push(`${fullName} (déjà sur le chantier ${check.chantier.numero})`);
            }
          }
        });
        if (conflits.length > 0) {
          Toast.error(`❌ Impossible : conflit avec ${conflits.join(', ')}`);
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

    // Initialiser le picker équipe drag & drop
    this._initEquipePicker(pickerState, chantier ? chantier.id : null);
  },

  /** Initialise le picker drag & drop d'équipe dans le formulaire chantier */
  _initEquipePicker(pickerState, currentChantierId) {
    const cardsEl = document.getElementById('equipePickerCards');
    const dropZone = document.getElementById('equipeDropZone');
    const dropEmpty = dropZone?.querySelector('.equipe-picker__drop-empty');
    const dropFilled = dropZone?.querySelector('.equipe-picker__drop-filled');
    const hiddenInput = document.getElementById('f-equipe');
    if (!cardsEl || !dropZone) return;

    const equipes = Store.state.equipes || [];

    // Détecter mobile
    const isMobile = window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window);

    // === Rendu des cards d'équipes disponibles ===
    const renderCards = () => {
      cardsEl.innerHTML = equipes.length === 0
        ? `<p class="hint" style="text-align:center;padding:var(--s-3)">Aucune équipe définie. <a href="#/equipes">Créez-en d'abord</a>.</p>`
        : equipes.map(eq => {
            const isSelected = pickerState.equipeId === eq.id;
            const chefName = eq.chefId ? (Store.state.personnel.find(p => p.id === eq.chefId)?.nom || '?') : null;
            const membresCount = (eq.membresIds || []).length;
            return `
              <div class="equipe-picker-card ${isSelected ? 'is-selected' : ''}"
                   data-equipe-id="${eq.id}"
                   ${isMobile ? '' : 'draggable="true"'}
                   style="border-color:${eq.couleur}">
                <span class="equipe-picker-card__color" style="background:${eq.couleur}"></span>
                <div class="equipe-picker-card__info">
                  <strong>${Helpers.esc(eq.nom)}</strong>
                  ${eq.specialite ? `<span class="hint">${Helpers.esc(eq.specialite)}</span>` : ''}
                  <span class="hint">
                    ${chefName ? `🛠️ ${Helpers.esc(chefName)} · ` : ''}
                    👥 ${membresCount} membre${membresCount > 1 ? 's' : ''}
                  </span>
                </div>
                ${isMobile ? `<button type="button" class="btn btn--ghost btn--sm" data-assign-equipe="${eq.id}">Assigner</button>` : ''}
              </div>
            `;
          }).join('');

      // Bind drag (desktop) / click (mobile)
      cardsEl.querySelectorAll('[data-equipe-id]').forEach(card => {
        if (!isMobile) {
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('equipe-id', card.dataset.equipeId);
            e.dataTransfer.effectAllowed = 'copy';
            card.classList.add('is-dragging');
          });
          card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
        }
      });
      cardsEl.querySelectorAll('[data-assign-equipe]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._assignEquipeToPicker(pickerState, btn.dataset.assignEquipe, currentChantierId);
        });
      });
    };

    // === Zone de drop ===
    if (!isMobile) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('is-drag-over');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('is-drag-over');
        const eqId = e.dataTransfer.getData('equipe-id');
        if (eqId) this._assignEquipeToPicker(pickerState, eqId, currentChantierId);
      });
    }

    // === Bouton retirer ===
    const removeBtn = document.getElementById('equipeRemoveBtn');
    removeBtn?.addEventListener('click', () => {
      pickerState.equipeId = null;
      pickerState.nom = '';
      pickerState.chefId = null;
      pickerState.membresIds = [];
      hiddenInput.value = '';
      this._renderEquipePicker(pickerState);
      renderCards();
    });

    // === Bouton ajouter membre ===
    document.getElementById('equipeMembersAddBtn')?.addEventListener('click', () => {
      this._openAddMemberPicker(pickerState, currentChantierId);
    });

    // Initial render
    renderCards();
    this._renderEquipePicker(pickerState);
  },

  /** Assigne une équipe au picker (copie sa composition actuelle dans pickerState) */
  _assignEquipeToPicker(pickerState, equipeId, currentChantierId) {
    const eq = Store.state.equipes.find(e => e.id === equipeId);
    if (!eq) return;

    // Récupérer les dates du formulaire
    const dateDebut = document.getElementById('f-debut')?.value;
    const dateFin = document.getElementById('f-fin')?.value;

    // Vérifier conflits sur les membres de l'équipe
    if (dateDebut && dateFin && Store.isPersonAvailable) {
      const memberIds = [eq.chefId, ...(eq.membresIds || [])].filter(Boolean);
      const conflits = [];
      memberIds.forEach(pid => {
        const check = Store.isPersonAvailable(pid, dateDebut, dateFin, currentChantierId);
        if (!check.ok) {
          const p = Store.state.personnel.find(x => x.id === pid);
          const fullName = p ? ([p.prenom, p.nom].filter(Boolean).join(' ') || p.nom) : '?';
          if (check.reason === 'absence') conflits.push(`${fullName} (${check.type.icon} ${check.type.label})`);
          else if (check.reason === 'chantier') conflits.push(`${fullName} (sur ${check.chantier.numero})`);
        }
      });
      if (conflits.length > 0) {
        Toast.error(`❌ Impossible d'assigner "${eq.nom}" : ${conflits.join(', ')}`);
        return;
      }
    }

    pickerState.equipeId = eq.id;
    pickerState.nom = eq.nom;
    pickerState.couleur = eq.couleur;
    pickerState.chefId = eq.chefId || null;
    pickerState.membresIds = (eq.membresIds || []).slice();
    document.getElementById('f-equipe').value = eq.id;
    this._renderEquipePicker(pickerState);
    // Mettre à jour les cards (state selected)
    document.getElementById('equipePickerCards')?.querySelectorAll('[data-equipe-id]').forEach(c => {
      c.classList.toggle('is-selected', c.dataset.equipeId === eq.id);
    });
    Toast.success(`Équipe ${eq.nom} assignée`);
  },

  /** Affiche la zone "équipe sélectionnée" avec sa composition */
  _renderEquipePicker(pickerState) {
    const dropEmpty = document.querySelector('.equipe-picker__drop-empty');
    const dropFilled = document.querySelector('.equipe-picker__drop-filled');
    if (!dropEmpty || !dropFilled) return;

    if (!pickerState.equipeId) {
      dropEmpty.hidden = false;
      dropFilled.hidden = true;
      return;
    }
    dropEmpty.hidden = true;
    dropFilled.hidden = false;

    document.getElementById('equipeSelectedColor').style.background = pickerState.couleur;
    document.getElementById('equipeSelectedNom').textContent = pickerState.nom;

    const chef = pickerState.chefId ? Store.state.personnel.find(p => p.id === pickerState.chefId) : null;
    const membres = pickerState.membresIds
      .map(id => Store.state.personnel.find(p => p.id === id))
      .filter(Boolean);

    const renderMember = (p, isChef) => {
      const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;
      const roleIcon = isChef ? '🛠️' : (p.role === 'alternant' ? '🎓' : '👷');
      return `
        <div class="equipe-picker__member" data-member-id="${p.id}" data-is-chef="${isChef ? '1' : '0'}">
          ${UI.avatar(fullName, 'sm', p.couleur)}
          <span class="equipe-picker__member-name">${roleIcon} ${Helpers.esc(fullName)}</span>
          ${isChef ? '<span class="badge badge--info">Chef</span>' : ''}
          <button type="button" class="btn-icon btn-icon--danger equipe-picker__member-remove" title="Retirer de ce chantier">✕</button>
        </div>
      `;
    };

    const html = (chef ? renderMember(chef, true) : '') +
                 membres.map(m => renderMember(m, false)).join('');

    const container = document.getElementById('equipeSelectedMembers');
    container.innerHTML = html || '<p class="hint">Aucun membre. Cliquez sur "+ Ajouter un membre".</p>';

    // Bind retrait
    container.querySelectorAll('.equipe-picker__member-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const member = btn.closest('.equipe-picker__member');
        const memberId = member.dataset.memberId;
        const isChef = member.dataset.isChef === '1';
        if (isChef) pickerState.chefId = null;
        else pickerState.membresIds = pickerState.membresIds.filter(id => id !== memberId);
        this._renderEquipePicker(pickerState);
      });
    });
  },

  /** Ouvre un mini-picker pour ajouter un membre ponctuel au snapshot */
  _openAddMemberPicker(pickerState, currentChantierId) {
    // Si un popover existe déjà, on le ferme et on sort
    const existing = document.getElementById('addMemberPopover');
    if (existing) { existing.remove(); return; }

    const dateDebut = document.getElementById('f-debut')?.value;
    const dateFin = document.getElementById('f-fin')?.value;
    const alreadyIn = new Set([pickerState.chefId, ...pickerState.membresIds].filter(Boolean));

    // Personnel disponible : pas déjà dans l'équipe + actif
    const personnel = (Store.state.personnel || []).filter(p =>
      p.actif !== false && !alreadyIn.has(p.id)
    );

    // Marquer les indisponibles
    const personnelWithStatus = personnel.map(p => {
      let disponible = true;
      let reason = '';
      if (dateDebut && dateFin && Store.isPersonAvailable) {
        const check = Store.isPersonAvailable(p.id, dateDebut, dateFin, currentChantierId);
        if (!check.ok) {
          disponible = false;
          if (check.reason === 'absence') reason = `${check.type.icon} ${check.type.label}`;
          else if (check.reason === 'chantier') reason = `Sur ${check.chantier.numero}`;
        }
      }
      return { p, disponible, reason };
    });

    // Création du popover inline
    const popover = document.createElement('div');
    popover.id = 'addMemberPopover';
    popover.className = 'add-member-popover';
    popover.innerHTML = `
      <div class="add-member-popover__header">
        <strong>Ajouter un membre à ce chantier</strong>
        <button type="button" class="btn-icon" id="closeAddMemberPopover" title="Fermer">✕</button>
      </div>
      ${dateDebut && dateFin ? `<p class="hint" style="margin:0 0 var(--s-2)">Période : ${Format.dateShort(dateDebut)} → ${Format.dateShort(dateFin)}</p>` : ''}
      <div class="picker-personnel-list">
        ${personnelWithStatus.length === 0 ? '<p class="hint">Aucune personne disponible à ajouter.</p>' :
          personnelWithStatus.map(({ p, disponible, reason }) => {
            const fullName = [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;
            const role = { conducteur: '👤', chef: '🛠️', ouvrier: '👷', alternant: '🎓' }[p.role] || '👥';
            return `
              <div class="picker-personnel-row ${disponible ? '' : 'is-unavailable'}" data-add-person="${p.id}">
                ${UI.avatar(fullName, 'sm', p.couleur)}
                <div class="picker-personnel-info">
                  <strong>${role} ${Helpers.esc(fullName)}</strong>
                  ${!disponible ? `<span class="hint" style="color:#ef4444">❌ ${Helpers.esc(reason)}</span>` : `<span class="hint">${(p.role === 'alternant' ? 'Alternant' : (p.role === 'chef' ? 'Chef' : 'Ouvrier'))}</span>`}
                </div>
                ${disponible ? '<button type="button" class="btn btn--primary btn--sm">+ Ajouter</button>' : '<button type="button" class="btn btn--ghost btn--sm" disabled>Indisponible</button>'}
              </div>
            `;
          }).join('')
        }
      </div>
    `;

    // Insérer le popover juste après la zone de composition
    const composition = document.querySelector('.equipe-picker__composition');
    if (composition) {
      composition.appendChild(popover);
    } else {
      document.body.appendChild(popover);
    }

    // Fermer en cliquant sur le X
    popover.querySelector('#closeAddMemberPopover')?.addEventListener('click', () => {
      popover.remove();
    });

    // Cliquer en dehors ferme aussi
    setTimeout(() => {
      const onClickOutside = (e) => {
        if (!popover.contains(e.target) && !e.target.closest('#equipeMembersAddBtn')) {
          popover.remove();
          document.removeEventListener('click', onClickOutside);
        }
      };
      document.addEventListener('click', onClickOutside);
    }, 0);

    // Clic sur "+ Ajouter" pour chaque ligne
    popover.querySelectorAll('[data-add-person]').forEach(row => {
      if (row.classList.contains('is-unavailable')) return;
      row.querySelector('button')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = row.dataset.addPerson;
        if (!pickerState.membresIds.includes(pid)) pickerState.membresIds.push(pid);
        Toast.success('Membre ajouté');
        popover.remove();
        this._renderEquipePicker(pickerState);
      });
    });
  },

  // ===================================================
  // FICHE DÉTAIL
  // ===================================================
  // ===================================================
  // BILAN DÉPENSES
  // ===================================================
  _renderBilanDepenses(chantierId) {
    const bilan = Store.getBilanChantier(chantierId);
    if (!bilan) return '';

    const chantier = Store.state.chantiers.find(c => c.id === chantierId);
    const manques = (chantier && chantier.fournituresManquantes) || [];

    const CATS = {
      'location': { label: 'Location', icon: '🏗️' },
      'carburant': { label: 'Carburant', icon: '⛽' },
      'main-oeuvre': { label: "Main d'œuvre", icon: '👷' },
      'sous-traitance': { label: 'Sous-traitance', icon: '🤝' },
      'autre': { label: 'Autre', icon: '📋' }
    };

    // Vérifie s'il y a du stock dispo pour compléter
    const peutCompleter = manques.some(m => (Store.state.stockAtelier[m.fournitureId] || 0) > 0);

    const manquesHtml = manques.length === 0 ? '' : `
      <div class="manques-block">
        <div class="manques-block__head">
          <strong>⚠️ Fournitures manquantes (stock insuffisant au démarrage)</strong>
        </div>
        <div class="manques-list">
          ${manques.map(m => {
            const dispo = Store.state.stockAtelier[m.fournitureId] || 0;
            return `
              <div class="manque-row">
                <span class="manque-row__name">${Helpers.esc(m.designation)}</span>
                <span class="manque-row__qte mono">manque ${Format.num(m.quantite)} ${Helpers.esc(m.unite || '')}</span>
                <span class="manque-row__stock hint">${dispo > 0 ? `${Format.num(dispo)} dispo en stock` : 'stock vide'}</span>
              </div>
            `;
          }).join('')}
        </div>
        <p class="hint" style="margin:var(--s-2) 0 0">Ces fournitures n'ont pas pu être déduites faute de stock. Réapprovisionnez puis cliquez ci-dessous pour les déduire.</p>
        <button class="btn ${peutCompleter ? 'btn--primary' : 'btn--ghost'} btn--sm" id="completManquesBtn" ${peutCompleter ? '' : 'disabled'} style="margin-top:var(--s-2)">
          ${peutCompleter ? '📦 Compléter les fournitures manquantes' : 'Aucun stock disponible pour compléter'}
        </button>
      </div>
    `;

    return `
      <div class="detail-section__title">💰 Dépenses du chantier</div>

      ${manquesHtml}

      <div class="bilan-cards">
        <div class="bilan-card">
          <span class="bilan-card__label">📐 Fournitures estimées</span>
          <span class="bilan-card__value">${Format.euro(bilan.totalFournitures)}</span>
        </div>
        <div class="bilan-card">
          <span class="bilan-card__label">📦 Commandes chantier</span>
          <span class="bilan-card__value">${Format.euro(bilan.totalCommandes)}</span>
        </div>
        <div class="bilan-card">
          <span class="bilan-card__label">✍️ Dépenses manuelles</span>
          <span class="bilan-card__value">${Format.euro(bilan.totalManuelles)}</span>
        </div>
        <div class="bilan-card bilan-card--total">
          <span class="bilan-card__label">TOTAL HT</span>
          <span class="bilan-card__value">${Format.euro(bilan.totalGeneral)}</span>
        </div>
      </div>

      <div class="depenses-manuelles">
        <div class="depenses-manuelles__head">
          <strong>Dépenses manuelles</strong>
          <button class="btn btn--ghost btn--sm" id="addDepenseBtn">+ Ajouter une dépense</button>
        </div>
        ${bilan.manuelles.length === 0 ? `
          <p class="hint">Aucune dépense manuelle. Ajoutez vos frais : location, carburant, main d'œuvre, sous-traitance...</p>
        ` : `
          <div class="depenses-list">
            ${bilan.manuelles.map(d => {
              const cat = CATS[d.categorie] || CATS.autre;
              return `
                <div class="depense-row" data-depense-id="${d.id}">
                  <span class="depense-icon">${cat.icon}</span>
                  <div class="depense-info">
                    <strong>${Helpers.esc(d.libelle || cat.label)}</strong>
                    <span class="hint">${cat.label}${d.date ? ' · ' + Format.dateShort(d.date) : ''}</span>
                  </div>
                  <span class="depense-montant mono">${Format.euro(d.montant)}</span>
                  <button class="btn-icon" data-edit-depense="${d.id}" title="Modifier">✎</button>
                  <button class="btn-icon btn-icon--danger" data-delete-depense="${d.id}" title="Supprimer">🗑</button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  _bindDepensesEvents(chantierId) {
    const $ = (sel) => document.querySelector(sel);
    $('#addDepenseBtn')?.addEventListener('click', () => this._openDepenseForm(chantierId));

    // Bouton compléter les fournitures manquantes
    $('#completManquesBtn')?.addEventListener('click', () => {
      const result = Store.completerFournituresManquantes(chantierId);
      if (result.completes.length > 0) {
        Toast.success(`📦 ${result.completes.length} fourniture(s) déduite(s) du stock`);
      }
      if (result.restants.length > 0) {
        Toast.warning(`Il reste ${result.restants.length} fourniture(s) en manque (stock encore insuffisant)`);
      }
      if (result.completes.length === 0 && result.restants.length > 0) {
        Toast.warning('Aucun stock disponible pour compléter');
      }
      this._refreshDepenses(chantierId);
    });

    document.querySelectorAll('[data-edit-depense]').forEach(btn => {
      btn.addEventListener('click', () => this._openDepenseForm(chantierId, btn.dataset.editDepense));
    });
    document.querySelectorAll('[data-delete-depense]').forEach(btn => {
      btn.addEventListener('click', () => {
        const depId = btn.dataset.deleteDepense;
        Modal.confirm({
          title: 'Supprimer cette dépense ?',
          message: 'Cette action est irréversible.',
          danger: true,
          onConfirm: () => {
            Store.deleteDepenseChantier(chantierId, depId);
            Toast.success('Dépense supprimée');
            this._refreshDepenses(chantierId);
          }
        });
      });
    });
  },

  _refreshDepenses(chantierId) {
    const section = document.getElementById('depensesSection');
    if (section) {
      section.innerHTML = this._renderBilanDepenses(chantierId);
      this._bindDepensesEvents(chantierId);
    }
  },

  _openDepenseForm(chantierId, depenseId = null) {
    const chantier = Store.state.chantiers.find(c => c.id === chantierId);
    const existing = depenseId ? (chantier.depensesManuelles || []).find(d => d.id === depenseId) : null;
    const d = existing || { libelle: '', montant: '', categorie: 'autre', date: new Date().toISOString().split('T')[0] };

    const CATS = [
      ['location', '🏗️ Location'],
      ['carburant', '⛽ Carburant'],
      ['main-oeuvre', "👷 Main d'œuvre"],
      ['sous-traitance', '🤝 Sous-traitance'],
      ['autre', '📋 Autre']
    ];

    Modal.open({
      title: existing ? 'Modifier la dépense' : 'Nouvelle dépense',
      size: 'small',
      body: `
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Libellé *</label>
            <input id="dep_libelle" class="form-input" value="${Helpers.esc(d.libelle)}" placeholder="Ex: Location nacelle 3 jours" autofocus>
          </div>
          <div class="form-field">
            <label>Montant (€ HT) *</label>
            <input id="dep_montant" class="form-input mono" type="number" min="0" step="0.01" value="${d.montant}" placeholder="200">
          </div>
          <div class="form-field">
            <label>Date</label>
            <input id="dep_date" class="form-input" type="date" value="${d.date}">
          </div>
          <div class="form-field form-field--full">
            <label>Catégorie</label>
            <select id="dep_categorie" class="form-select">
              ${CATS.map(([val, lab]) => `<option value="${val}" ${d.categorie === val ? 'selected' : ''}>${lab}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.close()">Annuler</button>
        <button class="btn btn--primary" id="depSave">${existing ? 'Mettre à jour' : 'Ajouter'}</button>
      `,
      onOpen: () => {
        document.getElementById('depSave').addEventListener('click', () => {
          const data = {
            libelle: document.getElementById('dep_libelle').value.trim(),
            montant: parseFloat(document.getElementById('dep_montant').value) || 0,
            date: document.getElementById('dep_date').value,
            categorie: document.getElementById('dep_categorie').value
          };
          if (!data.libelle) { Toast.warning('Le libellé est requis'); return; }
          if (data.montant <= 0) { Toast.warning('Le montant doit être supérieur à 0'); return; }

          if (existing) {
            Store.updateDepenseChantier(chantierId, existing.id, data);
            Toast.success('Dépense mise à jour');
          } else {
            Store.addDepenseChantier(chantierId, data);
            Toast.success('Dépense ajoutée');
          }
          Modal.close();
          this._refreshDepenses(chantierId);
        });
      }
    });
  },

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

      <div class="detail-section" id="depensesSection">
        ${this._renderBilanDepenses(id)}
      </div>
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
    this._bindDepensesEvents(id);
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
