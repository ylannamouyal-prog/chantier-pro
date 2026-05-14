# ChantierPro

**Logiciel SaaS de gestion d'entreprise BTP — menuiserie / vitrage / stores**

Application web complète, 100% locale (aucune donnée transmise), construite en HTML/CSS/JS vanilla avec quelques bibliothèques CDN. Toutes les données sont stockées dans le `localStorage` du navigateur.

---

## 🚀 Lancement

### Méthode 1 — ouverture directe
Double-cliquez sur `index.html`. L'app se lance dans le navigateur.

### Méthode 2 — serveur local (recommandé)
```bash
cd chantierpro
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```
Un serveur local évite tout problème de cache et permet le bon fonctionnement des fonts/CDN.

> Au premier lancement, l'application charge automatiquement un **jeu de données de démo** (chantiers, clients, équipes, stocks, engins). Vous pouvez le supprimer dans **Paramètres → Réinitialiser**.

---

## 📂 Structure

```
chantierpro/
├── index.html              ← shell SPA + libs CDN + scripts
├── css/
│   ├── variables.css       ← design tokens (couleurs, spacing, radius…)
│   ├── base.css            ← reset + typo + animations
│   ├── layout.css          ← grille app-shell sidebar + main
│   ├── components.css      ← boutons, modals, tables, toasts, badges
│   ├── modules.css         ← styles dashboard/planning/chantiers
│   ├── responsive.css      ← breakpoints mobile/tablette
│   └── extra.css           ← styles nouveaux modules (clients, stocks, engins…)
├── js/
│   ├── utils/              ← helpers, dom, format, toast, modal
│   ├── data/
│   │   ├── store.js        ← state global + persist localStorage + commit/subscribe
│   │   └── demo-data.js    ← jeu de données de démo
│   ├── components/ui.js    ← composants partagés (badge, avatar, emptyState…)
│   ├── modules/            ← 13 modules métier (un fichier = une vue)
│   └── app.js              ← router hash, theme, quick-menu, boot
```

---

## ✨ Fonctionnalités

### 📊 Tableau de bord
KPIs en temps réel, graphiques Chart.js, chantiers récents, alertes stocks, prochaines échéances.

### 📅 Planning annuel
Vue calendrier FullCalendar (mois / semaine / jour), code couleur par conducteur ou équipe, drag-drop pour replanifier, gestion des conflits.

### 🏗️ Chantiers
Statut **calculé automatiquement** selon les dates (en-attente-cotes → en-attente-devis → commande → prévu → en-cours → terminé). Statuts manuels possibles : **reporté**. Filtres, recherche, export.

### 📐 Prises de cotes
Saisie en **mm** → calcul automatique en **m²**. Drag-drop pour réordonner. Bibliothèque d'ouvrages standards. **Calcul automatique des fournitures** (joints, parclose, vis) selon la surface.

### 👥 Clients
Fiches complètes, détection automatique des **doublons** (nom/téléphone/email), historique des chantiers, export Excel.

### 📦 Stocks
Double tiroir : **atelier** + **un camion par équipe**. Entrées / sorties / **transferts** entre emplacements. Alertes seuil. Historique des mouvements horodaté. Export Excel multi-feuilles.

### 🚜 Engins
Réservations par chantier avec **détection automatique des conflits** (algorithme de chevauchement de dates). Coût journalier, historique.

### 🏭 Fournisseurs
Fiches contacts, délais de livraison, **suggestions automatiques de commandes** pour les fournitures sous seuil.

### 👷 Équipes & Conducteurs
Équipes avec couleur (planning) et membres. Conducteurs avec couleur personnelle. Blocage de suppression si chantiers liés.

### 🔍 Recherche globale
Multi-entités (chantiers / clients / fournitures / engins / cotes / fournisseurs) avec dropdown groupé.

### 📄 Export PDF
Fiche chantier A4 complète : entête entreprise, bloc client, équipe, table des cotes avec totaux, engins, signatures. Planning trimestriel paysage.

### 📊 Export Excel
Chantiers, clients, stocks (multi-feuilles : récap + une feuille par camion), mouvements.

### 🎨 Thème clair / sombre / auto
Bascule manuelle ou détection système (`prefers-color-scheme`).

### 💾 Sauvegarde / Restauration
Export JSON complet (sauvegarde locale), import depuis fichier JSON, réinitialisation, chargement données démo.

---

## 🎨 Design

- **Police d'affichage** : Bricolage Grotesque (titres) — distinctive et moderne
- **Police texte** : Inter Tight (UI) — très lisible
- **Police mono** : JetBrains Mono (chiffres, références, dimensions)
- **Palette** : bleu nuit (`#0F172A`) + accents bleu (`#3B82F6`) / cyan (`#0EA5E9`) / ambre (`#F59E0B`)
- **Inspirations** : Notion, Linear, Monday — sidebar fixe, cartes aérées, micro-interactions

---

## 🛠️ Stack technique

- **HTML5 / CSS3 / JavaScript vanilla** — aucun build, aucune dépendance npm
- **FullCalendar 6** — planning
- **Chart.js 4** — graphiques dashboard
- **Flatpickr** — sélecteurs de date FR
- **SortableJS** — drag-drop des cotes
- **jsPDF + autoTable** — génération PDF
- **SheetJS (xlsx)** — export Excel

Toutes les libs sont chargées via CDN. Aucun backend.

---

## 🔐 Données

**Tout est stocké localement** dans le `localStorage` de votre navigateur (clé `chantierpro:state`). Aucune requête réseau hormis le chargement initial des libs CDN.

> **Pensez à exporter régulièrement** (Paramètres → Exporter) pour ne rien perdre. Le localStorage peut être vidé par le navigateur en cas de nettoyage.

---

## 🗺️ Roadmap v2

- Mode dessin sur plan (Fabric.js) avec annotations
- Photos de chantier (IndexedDB pour la taille)
- Application mobile native (Capacitor)
- Mode multi-utilisateurs (backend Node + websockets)
- Signatures électroniques tactiles
- Import devis depuis logiciels tiers
- Géolocalisation des camions

---

## 📝 Licence

Code source fourni pour usage interne. Adaptable selon les besoins de votre entreprise.
