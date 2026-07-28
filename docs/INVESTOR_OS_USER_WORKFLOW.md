# Investor OS — Workflow Utilisateur

## Table des matières
1. [Onboarding](#1-onboarding)
2. [Dashboard](#2-dashboard)
3. [Découverte de Ventures](#3-découverte-de-ventures)
4. [Watchlist](#4-watchlist)
5. [Pipeline d'Investissement](#5-pipeline-dinvestissement)
6. [Due Diligence](#6-due-diligence)
7. [Portfolio](#7-portfolio)
8. [Historique & Rapports](#8-historique--rapports)
9. [Profil & Préférences](#9-profil--préférences)
10. [Organisations](#10-organisations)

---

## 1. Onboarding

### 1.1 Comment un investisseur rejoint la plateforme ?

> **L'Admin envoie un lien d'invitation** à l'investisseur par email. L'investisseur clique sur le lien, crée son compte, et son profil est mis en **Pending Review**.

1. L'Admin va dans **Admin → Investors → Manage**
2. L'Admin envoie une invitation à l'email de l'investisseur
3. L'investisseur reçoit l'email avec un lien vers `/investor/register`
4. L'investisseur remplit le formulaire :
   - Nom complet
   - Email
   - Mot de passe
   - Organisation (optionnel)
   - Biographie (optionnel)
   - Site web / LinkedIn (optionnel)
5. L'investisseur clique **Register as Investor**
6. Message : *"Registration submitted for review. You'll be notified once approved."*

### 1.2 Approbation par l'Admin

1. L'Admin va dans **Admin → Investors → Manage**
2. L'investisseur apparaît avec le statut **Pending Review**
3. L'Admin clique **Approve** (ou **Reject** / **Suspend**)
4. L'investisseur reçoit une notification + email

### 1.3 Première connexion

1. L'investisseur va sur `/login`
2. Saisit email + mot de passe → **Authenticate**
3. Redirigé vers son **Investor Dashboard**

---

## 2. Dashboard

Le dashboard est la page d'accueil de l'investisseur (`/investor/dashboard`).

### Ce qu'il voit :

| Section | Contenu |
|---------|---------|
| **Stats** | Pipeline (total), Invested, Evaluating, Watchlist |
| **Onglet Discover** | Liste des ventures avec recherche et filtres |
| **Onglet Pipeline** | Toutes les ventures suivies avec leur stage |
| **Onglet Watchlist** | Ventures sauvegardées pour plus tard |

### Sidebar :
- **DISCOVER** → Dashboard
- **PIPELINE** → Dashboard (onglet Pipeline)
- **PORTFOLIO** → `/investor/portfolio`
- **ORGANIZATIONS** → `/investor/organizations`
- **HISTORY** → `/investor/history`
- **PROFILE** → `/investor/profile`

---

## 3. Découverte de Ventures

### Comment découvrir des ventures ?

1. Dans l'onglet **Discover** du dashboard
2. L'investisseur voit une barre de recherche
3. Il peut :
   - **Rechercher** par nom, industrie, ou description
   - **Filtrer** en cliquant sur **Filters** :
     - **Industry** → cliquer sur des badges (FinTech, HealthTech, AgriTech...)
     - **Country** → cliquer sur des badges (CD, KE, NG, ZA...)
     - **Stage** → cliquer sur des badges (Pre-Seed, Seed, Series A...)
     - **Funding (USD)** → saisir Min / Max
   - Cliquer **Search** pour lancer la recherche
4. Les résultats s'affichent sous forme de cartes

### Ce que montre chaque carte de venture :

| Info | Description |
|------|-------------|
| Nom | Cliquable → ouvre la modale de détail |
| Industrie | Ex: FinTech, HealthTech |
| Description | Résumé (2 lignes max) |
| Pays + % complétion | Ex: CD · 45% |
| 🔄 Comparer | Ajoute/retire de la comparaison |
| ⭐ Watchlist | Ajoute/retire de la watchlist |
| **Express Interest** | Ajoute au pipeline avec stage "Interested" |

### Modale de détail d'une venture :

En cliquant sur le **nom** de la venture :
- Description complète
- Industry, Country, Status, Investor Interest
- Statut dans le pipeline de l'investisseur
- Dropdown pour changer le stage
- Bouton Watchlist
- Bouton Compare

### Comparaison de ventures :

1. Cliquer 🔄 sur 2+ cartes de venture
2. Une barre flottante apparaît en bas : *"X selected — Compare Now"*
3. Cliquer **Compare Now** → tableau comparatif :
   - Industry, Country, Status, Progress, Interest, Description
4. Fermer pour revenir

---

## 4. Watchlist

### Ajouter une venture à la watchlist :

1. Sur une carte venture → cliquer ⭐
2. La venture apparaît dans l'onglet **Watchlist**

### Retirer de la watchlist :

1. Cliquer ⭐ à nouveau → la venture est retirée

### Dans l'onglet Watchlist :

- Liste de toutes les ventures sauvegardées
- Pour chaque venture : bouton **Add to Pipeline**

---

## 5. Pipeline d'Investissement

Le pipeline suit chaque venture à travers les étapes du cycle d'investissement.

### Stages (dans l'ordre) :

| Stage | Signification |
|-------|---------------|
| **Interested** | L'investisseur a exprimé son intérêt |
| **Watching** | L'investisseur surveille la venture |
| **Meeting Requested** | Une réunion est demandée |
| **Due Diligence** | Évaluation approfondie en cours |
| **Negotiation** | Négociation des termes |
| **Invested** | Investissement confirmé |
| **Declined** | Opportunité déclinée |

### Ajouter au pipeline :

1. Sur une carte venture → cliquer **Express Interest** → stage = "Interested"
2. Dans la modale de détail → dropdown pour choisir le stage → **Add to Pipeline**

### Gérer le pipeline :

1. Onglet **Pipeline** → toutes les ventures avec leur stage actuel
2. Filtres par stage : All, Due Diligence, Invested...
3. Pour chaque venture :
   - **Dropdown de stage** → changer le stage (ex: Interested → Due Diligence)
   - **Open Workspace** (si stage = Due Diligence)

---

## 6. Due Diligence

Quand un investisseur met une venture en **Due Diligence**, un workspace dédié est créé.

### Accéder au Due Diligence :

1. Onglet **Pipeline** → trouver la venture en Due Diligence
2. Cliquer **Open Workspace**
3. Redirigé vers `/investor/diligence?pipeline_id=...`

### Le workspace contient :

| Onglet | Ce qu'on peut faire |
|--------|---------------------|
| **Overview** | Voir le résumé de la venture, progression |
| **Requests** | Créer des demandes d'information, voir les réponses |
| **Founders** | Évaluer les fondateurs (scores 0-10) |
| **Risks** | Évaluer les risques (Market, Product, Financial...) |
| **Notes** | Notes privées, partagées, advisor, decision |

### Créer une demande d'information :

1. Onglet **Requests** → **New Request**
2. Remplir : Titre, Description, Catégorie (General, Financial, Legal, Product, Team, Market)
3. Cliquer **Submit**
4. L'Admin reçoit la demande et organise une mise en contact

### Évaluer un fondateur :

1. Onglet **Founders** → **Evaluate Founder**
2. Remplir : Nom, Rôle, Scores (Experience 0-10, Leadership 0-10, Domain 0-10, Overall 0-10)
3. Ajouter des notes
4. Cliquer **Save**

### Évaluer les risques :

1. Onglet **Risks** → **Add Risk**
2. Choisir la catégorie (market, product, financial, operational, legal)
3. Décrire le risque
4. Choisir la sévérité (Low, Medium, High, Critical)
5. Ajouter une stratégie de mitigation
6. Cliquer **Save**

### Notes d'investissement :

1. Onglet **Notes** → écrire dans le textarea
2. Choisir le type : **Private**, **Shared**, **Advisor**, **Decision**
3. Cliquer **Save**

### Compléter le Due Diligence :

1. Cliquer **Complete** en haut à droite
2. Le workspace passe en statut "completed"

---

## 7. Portfolio

Le portfolio montre uniquement les ventures où l'investisseur a un statut **Invested**.

### Accéder au portfolio :

- Sidebar → **PORTFOLIO** ou `/investor/portfolio`

### Ce qu'on voit :

- **Stats** : Nombre de ventures investies, Capital total, Décisions
- **Liste des ventures investies** avec statut "↑ Active"

### Détail d'une venture du portfolio :

En cliquant sur une venture :

| Onglet | Contenu |
|--------|---------|
| **Overview** | Updates récentes + réunions à venir |
| **Updates** | Liste des mises à jour — créer, voir |
| **KPIs** | Métriques de performance (depuis Venture OS) |
| **Meetings** | Réunions planifiées — créer, voir |
| **Notes** | Notes privées sur la venture |

### Créer une mise à jour :

1. Onglet **Updates** → **New Update**
2. Titre, Contenu, Type (general, monthly, quarterly, product, business)
3. Cliquer **Publish**

### Planifier une réunion :

1. Onglet **Meetings** → **Schedule**
2. Titre, Description, Start/End, Location (Video, In Person, Phone)
3. Cliquer **Schedule**

### Voir les KPIs :

1. Onglet **KPIs** → métriques automatiques depuis Venture OS :
   - Program Completion
   - Participants
   - Active Investors
   - Venture Status

---

## 8. Historique & Rapports

### Accéder à l'historique :

- Sidebar → **HISTORY** ou `/investor/history`

### Ce qu'on voit :

- **Stats** : Total Decisions, Invested, Total Capital, Declined
- **Decisions** : Liste de toutes les décisions d'investissement avec montants
- **Activity Timeline** : Chronologie de toutes les activités

### Exporter les rapports :

Trois boutons en haut :
- **CSV** → Télécharge un fichier .csv
- **JSON** → Télécharge un fichier .json
- **Printable** → Ouvre une page imprimable

---

## 9. Profil & Préférences

### Accéder au profil :

- Sidebar → **PROFILE** ou `/investor/profile`

### Onglet Profile :

- **Organization Name** — éditable
- **Biography** — éditable
- **Website** — éditable
- **LinkedIn** — éditable
- **Save Profile** — enregistre

### Onglet Preferences :

- **Industries** — badges à sélectionner (FinTech, HealthTech...)
- **Countries** — badges à sélectionner (CD, KE, NG...)
- **Startup Stages** — badges (Pre-Seed, Seed, Series A...)
- **Ticket Size** — Min / Max (USD)
- **Investment Philosophy** — texte libre
- **Save Preferences** — enregistre

Ces préférences influencent les recommandations de ventures dans le Discover.

---

## 10. Organisations

Pour les investisseurs institutionnels (VC firms, Family Offices).

### Accéder :

- Sidebar → **ORGANIZATIONS** ou `/investor/organizations`

### Créer une organisation :

1. Cliquer **New Organization**
2. Remplir : Nom, Description, Website
3. Cliquer **Create**

### Gérer une organisation :

1. Cliquer sur l'organisation dans la liste
2. Voir les détails et les membres
3. L'investisseur créateur est automatiquement **Admin**

---

## Résumé du Workflow Complet

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ Admin send  │───▶│ Investor     │───▶│ Admin       │───▶│ Investor     │
│ invite link │    │ registers    │    │ approves    │    │ logs in      │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                                                  │
                          ┌───────────────────────────────────────┤
                          ▼                                       ▼
                   ┌─────────────┐                         ┌─────────────┐
                   │ DISCOVER    │                         │ PROFILE     │
                   │ Search      │                         │ Preferences │
                   │ Filter      │                         │ Orgs        │
                   │ Compare     │                         └─────────────┘
                   └──────┬──────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │Watchlist │  │Pipeline  │  │Detail    │
     │⭐ save   │  │Stages    │  │Modal     │
     └──────────┘  └────┬─────┘  └──────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ DUE DILIGENCE│
                 │ Requests     │
                 │ Founders     │
                 │ Risks        │
                 │ Notes        │
                 └──────┬───────┘
                        │
                  ┌─────┴─────┐
                  ▼           ▼
           ┌──────────┐ ┌──────────┐
           │Invested  │ │Declined  │
           └────┬─────┘ └──────────┘
                │
                ▼
         ┌──────────────┐
         │ PORTFOLIO    │
         │ Updates      │
         │ KPIs         │
         │ Meetings     │
         │ Notes        │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │ HISTORY      │
         │ Timeline     │
         │ Export CSV   │
         │ Export JSON  │
         │ Printable    │
         └──────────────┘
```

---

*Document généré automatiquement — Investor OS Sprint 4*
