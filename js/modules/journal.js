// Module Journal - historique automatique des actions + versions de l'app
window.Journal = (function () {

  // Historique des versions de l'app (les fonctionnalités ajoutées)
  // La plus récente en premier
  const VERSIONS = [
    { version: '1.6', date: '2026-06', titre: 'Améliorations diverses', items: [
      'Catégories de fournisseurs gérables (multi-catégories)',
      'Journal des modifications (cet écran)',
      'Recherche dans les menus déroulants'
    ]},
    { version: '1.5', date: '2026-06', titre: 'Engins atelier / location', items: [
      'Séparation engins à l\'atelier et engins à louer',
      'Coordonnées du loueur (téléphone, email, prix)',
      'Export des réservations en PDF et Excel'
    ]},
    { version: '1.4', date: '2026-06', titre: 'Finances chantier', items: [
      'Bilan des dépenses par chantier',
      'Dépenses manuelles (location, carburant, main d\'œuvre...)',
      'Détail complet des coûts dans le PDF du chantier'
    ]},
    { version: '1.3', date: '2026-06', titre: 'Stock avancé', items: [
      'Export des mouvements de stock (PDF / Excel par période)',
      'Export de l\'état du stock en PDF',
      'Onglet commandes chantier séparé du stock atelier'
    ]},
    { version: '1.2', date: '2026-06', titre: 'Notifications & planning', items: [
      'Cloche de notifications (7 jours à venir)',
      'Alertes de réapprovisionnement sur le planning',
      'Commande directe depuis une alerte stock'
    ]},
    { version: '1.1', date: '2026-05', titre: 'Équipes & personnel', items: [
      'Gestion du personnel et des absences',
      'Drag & drop d\'équipe sur les chantiers',
      'Plusieurs contacts par client'
    ]},
    { version: '1.0', date: '2026-05', titre: 'Version initiale', items: [
      'Chantiers, planning, prises de cotes',
      'Clients, stocks, fournisseurs, commandes',
      'Engins, équipes, exports PDF'
    ]}
  ];

  let activeTab = 'activite';

  function open() {
    activeTab = 'activite';
    renderModal();
  }

  function renderModal() {
    Modal.open({
      title: '📋 Journal',
      size: 'large',
      body: `
        <div class="tabs" id="journalTabs">
          <button class="tab ${activeTab === 'activite' ? 'tab--active' : ''}" data-jtab="activite">🕒 Activité récente</button>
          <button class="tab ${activeTab === 'versions' ? 'tab--active' : ''}" data-jtab="versions">🚀 Nouveautés de l'app</button>
        </div>
        <div id="journalContent">${activeTab === 'activite' ? renderActivite() : renderVersions()}</div>
      `,
      footer: activeTab === 'activite'
        ? `<button class="btn btn--ghost btn--sm" id="clearJournalBtn">🗑 Vider l'historique</button>
           <button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`
        : `<button class="btn btn--primary" onclick="Modal.close()">Fermer</button>`,
      onOpen: bindEvents
    });
  }

  function bindEvents() {
    document.querySelectorAll('[data-jtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.jtab;
        renderModal();
      });
    });
    document.getElementById('clearJournalBtn')?.addEventListener('click', () => {
      Modal.confirm({
        title: 'Vider l\'historique ?',
        message: 'Toutes les entrées d\'activité seront supprimées. Les nouveautés de l\'app ne sont pas affectées.',
        danger: true,
        onConfirm: () => {
          Store.clearJournal();
          Toast.success('Historique vidé');
          renderModal();
        }
      });
    });
  }

  function renderActivite() {
    const journal = Store.getJournal(100);
    if (journal.length === 0) {
      return `<div class="journal-empty"><span>🕒</span><p>Aucune activité enregistrée pour l'instant.<br>Vos actions (créations, modifications...) apparaîtront ici.</p></div>`;
    }

    // Grouper par date (jour)
    const groups = {};
    journal.forEach(entry => {
      const d = new Date(entry.date);
      const key = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    return `
      <div class="journal-list">
        ${Object.entries(groups).map(([day, entries]) => `
          <div class="journal-day">
            <div class="journal-day__title">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
            ${entries.map(e => {
              const time = new Date(e.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              return `
                <div class="journal-entry">
                  <span class="journal-entry__time mono">${time}</span>
                  <span class="journal-entry__msg">${Helpers.esc(e.message)}</span>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderVersions() {
    return `
      <div class="versions-list">
        ${VERSIONS.map((v, i) => `
          <div class="version-item ${i === 0 ? 'version-item--latest' : ''}">
            <div class="version-item__head">
              <span class="version-badge">v${v.version}</span>
              <strong>${Helpers.esc(v.titre)}</strong>
              ${i === 0 ? '<span class="badge badge--success">Actuelle</span>' : ''}
              <span class="version-date">${Helpers.esc(v.date)}</span>
            </div>
            <ul class="version-items">
              ${v.items.map(it => `<li>${Helpers.esc(it)}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  }

  return { open };
})();
