// Module Paramètres
window.Parametres = (function () {
  function render(container) {
    const p = Store.state.parametres || {};
    const entr = p.entreprise || {};

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">⚙️ Paramètres</h1>
          <p class="view-subtitle">Configuration de l'application</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-section">
          <h2>🏢 Informations entreprise</h2>
          <p class="hint">Apparaissent sur les PDF générés.</p>
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label>Nom de l'entreprise</label>
              <input id="e_nom" class="form-input" value="${Helpers.esc(entr.nom || '')}" placeholder="ChantierPro SARL">
            </div>
            <div class="form-field form-field--full">
              <label>Adresse</label>
              <input id="e_adresse" class="form-input" value="${Helpers.esc(entr.adresse || '')}">
            </div>
            <div class="form-field">
              <label>Téléphone</label>
              <input id="e_tel" class="form-input" value="${Helpers.esc(entr.telephone || '')}">
            </div>
            <div class="form-field">
              <label>Email</label>
              <input id="e_email" class="form-input" type="email" value="${Helpers.esc(entr.email || '')}">
            </div>
            <div class="form-field">
              <label>SIRET</label>
              <input id="e_siret" class="form-input mono" value="${Helpers.esc(entr.siret || '')}">
            </div>
            <div class="form-field">
              <label>TVA Intra.</label>
              <input id="e_tva" class="form-input mono" value="${Helpers.esc(entr.tva || '')}">
            </div>
          </div>
          <button class="btn btn--primary" id="saveEntreprise" style="margin-top:var(--sp-4)">💾 Enregistrer</button>
        </div>

        <div class="settings-section">
          <h2>🎨 Apparence</h2>
          <div class="settings-row">
            <div>
              <strong>Thème</strong>
              <p class="hint">Clair, sombre ou automatique</p>
            </div>
            <select id="themeSelect" class="form-select" style="max-width:200px">
              <option value="auto" ${p.theme === 'auto' ? 'selected' : ''}>🔄 Auto (système)</option>
              <option value="light" ${p.theme === 'light' ? 'selected' : ''}>☀️ Clair</option>
              <option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>🌙 Sombre</option>
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h2>💾 Sauvegarde & Données</h2>
          <p class="hint">Toutes les données sont stockées localement dans votre navigateur (localStorage).</p>
          <div class="settings-actions">
            <button class="btn btn--primary" id="btnExport">📥 Exporter (JSON)</button>
            <button class="btn btn--ghost" id="btnImport">📤 Importer</button>
            <input type="file" id="fileImport" accept=".json" style="display:none">
            <button class="btn btn--ghost" id="btnDemo">🎲 Charger données démo</button>
            <button class="btn btn--danger" id="btnReset">🗑 Réinitialiser tout</button>
          </div>
          <div class="settings-info">
            <div>📊 ${Store.state.chantiers.length} chantiers • ${Store.state.clients.length} clients • ${Store.state.fournitures.length} fournitures</div>
            <div>👷 ${Store.state.equipes.length} équipes • ${Store.state.conducteurs.length} conducteurs</div>
            <div>🚜 ${Store.state.engins.length} engins • 🏭 ${Store.state.fournisseurs.length} fournisseurs</div>
          </div>
        </div>

        <div class="settings-section">
          <h2>ℹ️ À propos</h2>
          <p><strong>ChantierPro</strong> — Logiciel de gestion pour entreprises BTP menuiserie / vitrage / stores</p>
          <p class="hint">Version 1.0 • Application 100% locale, aucune donnée transmise.</p>
        </div>
      </div>
    `;

    document.getElementById('saveEntreprise')?.addEventListener('click', () => {
      const data = {
        nom: document.getElementById('e_nom').value.trim(),
        adresse: document.getElementById('e_adresse').value.trim(),
        telephone: document.getElementById('e_tel').value.trim(),
        email: document.getElementById('e_email').value.trim(),
        siret: document.getElementById('e_siret').value.trim(),
        tva: document.getElementById('e_tva').value.trim()
      };
      Store.commit('settings:entreprise', state => {
        if (!state.parametres) state.parametres = {};
        state.parametres.entreprise = data;
      });
      Toast.success('Informations entreprise enregistrées');
    });

    document.getElementById('themeSelect')?.addEventListener('change', (e) => {
      const theme = e.target.value;
      Store.commit('settings:theme', state => {
        if (!state.parametres) state.parametres = {};
        state.parametres.theme = theme;
      });
      window.applyTheme?.(theme);
      Toast.success('Thème appliqué');
    });

    document.getElementById('btnExport')?.addEventListener('click', () => {
      const json = Store.exportJSON();
      const date = new Date().toISOString().split('T')[0];
      Helpers.downloadBlob(json, `chantierpro-backup-${date}.json`, 'application/json');
      Toast.success('Sauvegarde téléchargée');
    });

    document.getElementById('btnImport')?.addEventListener('click', () => {
      document.getElementById('fileImport').click();
    });

    document.getElementById('fileImport')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        Modal.confirm({
          title: 'Importer ces données ?',
          message: 'Vos données actuelles seront remplacées.',
          danger: true,
          onConfirm: () => {
            try {
              Store.importJSON(ev.target.result);
              Toast.success('Données importées');
              if (window.Router) Router.refresh();
            } catch (err) {
              Toast.error('Fichier invalide');
            }
          }
        });
      };
      reader.readAsText(file);
    });

    document.getElementById('btnDemo')?.addEventListener('click', () => {
      Modal.confirm({
        title: 'Charger les données de démonstration ?',
        message: 'Cela remplacera toutes vos données actuelles.',
        danger: true,
        onConfirm: () => {
          Store.reset();
          Store.loadDemoData();
          Toast.success('Données démo chargées');
          if (window.Router) Router.refresh();
        }
      });
    });

    document.getElementById('btnReset')?.addEventListener('click', () => {
      Modal.confirm({
        title: '⚠️ Réinitialiser TOUTES les données ?',
        message: 'Cette action est irréversible. Pensez à exporter une sauvegarde avant.',
        danger: true,
        onConfirm: () => {
          Store.reset();
          Toast.success('Données réinitialisées');
          if (window.Router) Router.refresh();
        }
      });
    });
  }

  return { render };
})();
