# InvestorOS — Guide de test & référence

> Document unique, issu de la fusion de l'ancien *guide de test de bout en bout* et du
> *rapport de sprint d'implémentation*. Les deux décrivaient le même parcours avec des
> recoupements et des divergences ; ce fichier les remplace.
>
> Il sert à deux choses : **vérifier** le module de gestion des relations investisseurs
> de bout en bout, et **comprendre** ce que le module fait.
>
> Pour le parcours **vu par l'investisseur** (écrans et actions), voir
> [`INVESTOR_OS_USER_WORKFLOW.md`](INVESTOR_OS_USER_WORKFLOW.md).

---

## 1. Comptes et données de test

> Staging uniquement. Sauf indication contraire, mot de passe **`ImpactOS2026!`**.

### 1.1 Équipe Future Studio (staff)

| Rôle | Nom | Email |
|------|-----|-------|
| Super Admin | Super Admin | `superadmin@impactos.staging` |
| Relationship Manager | Daniel Mensah | `daniel.mensah@futurestudio.test` |
| Investment Manager | Michael Lawson | `michael.lawson@futurestudio.test` |
| Venture Manager | Grace Mensah | `grace.mensah@futurestudio.test` |
| Lead Coach | David Adebayo | `david.adebayo@futurestudio.test` |
| Strategic Advisor | Jean-Claude Kouassi | `jeanclaude.kouassi@futurestudio.test` |

### 1.2 Investisseurs

| # | Organisation | Représentant | Email | Type | Focus | Géographie | Ticket |
|---|---|---|---|---|---|---|---|
| **I1** | Growth Capital Africa | Sarah Thompson | `sarah@growthcapital.africa` | VC Firm | EdTech, AI/ML, FinTech | CD, KE, GH | $50K–$250K |
| **I2** | AfriGreen Capital | Koffi Mensah | *à créer via le wizard* | Impact Fund | AgriTech, CleanTech, Renewable Energy | SN, CI, GH | $25K–$150K |
| **I3** | Lagos Tech Angels | Amara Okafor | *à créer via le wizard* | Angel Network | FinTech, SaaS, E-Commerce | NG, KE, ZA | $10K–$100K |
| **I4** | Santé Plus Invest | Dr. Marie Koné | *à créer via le wizard* | Health Fund | HealthTech, AI/ML | CI, SN, ML | $50K–$500K |

### 1.3 Fondateurs et ventures

| Fondateur | Email | Venture | Industrie | Pays | Stage | Readiness | Objectif |
|---|---|---|---|---|---|---|---|
| Alice Johnson | `alice.johnson@futurestudio.test` | NovaSpark Ventures | EdTech | CD | Pre-Seed | 96 % | $250,000 |
| — | — | Auto KPI Test | EdTech | CD | Seed | 16 % | — |
| — | — | Live Test Program | EdTech | CD | — | 33 % | — |

### 1.4 Campagne déjà présente

| Campagne | Venture | Objectif | Levé | Progression |
|---|---|---|---|---|
| Nova Sparck pre-seed round | NovaSpark Ventures | $25,000 | $7,000 | 28 % |

---

## 2. Ce que fait le module (référence)

### 2.1 Données utilisées

| Objet | Rôle |
|---|---|
| Profil investisseur | Qualification (statut, notes de revue, taux de complétion) et préférences (industries, pays, stages, ticket) |
| Pipeline d'investissement | 7 étapes : `interested` → `watching` → `meeting_requested` → `due_diligence` → `negotiation` → `invested` → `declined` |
| Décision d'investissement | Montant investi lorsqu'un dossier passe à `invested` |
| Watchlist | Ventures suivies, avec note personnelle |
| Campagnes de levée | Cycle `draft` / `active` / `paused` / `closed`, objectif, montant levé, minimum, visibilité |
| Espace de relation | Un par introduction approuvée : rattaché au pipeline, avec RM et IM assignés, étape, prochaine action |
| Réunions | 7 types (introductive, suivi, démo produit, revue financière, session DD, comité, closing), statut, notes, résultat, actions |
| Journal de relation | Historique immuable des événements |
| Demandes de due diligence | Catégorie, priorité, échéance, propriétaire, historique de version, questions de suivi |

### 2.2 Onboarding et qualification

Parcours de profil en 5 étapes (compte → organisation → préférences → expérience → récapitulatif), avec barre de progression. À la soumission, le statut passe en *en revue* et le tableau de bord investisseur reste verrouillé jusqu'à l'approbation.

Côté admin : un écran de revue détaillé (biographie, expérience, site, LinkedIn, notes internes, « recommander l'approbation » / rejeter) et un écran de gestion (approuver, rejeter, suspendre, réactiver). Chaque changement de statut est tracé.

### 2.3 Matching

Le moteur note chaque venture de 0 à 100 selon les préférences de l'investisseur :
**industrie 30 %**, **pays 25 %**, **stage 20 %**, **taille du ticket 15 %**, **readiness 10 %**.
Les recommandations sont triées par score décroissant, les raisons de correspondance sont affichées, et les ventures à 0 % sont masquées dès que des préférences sont définies. Le calcul est refait à chaque ouverture du tableau de bord.

### 2.4 Demande d'introduction et relation

« Demander une introduction » ouvre une fenêtre de saisie ; la soumission place le dossier en `meeting_requested` et notifie l'admin. Après approbation, un **espace de relation** est créé et les **RM et IM** y sont assignés via un sélecteur de personne. L'espace regroupe les réunions et la due diligence, avec un journal chronologique des événements.

### 2.5 Campagnes de levée

Création (venture, nom, objectif, minimum, dates, visibilité), puis publication, pause, clôture, mise à jour du montant levé. La publication notifie les investisseurs dont les préférences correspondent, et chaque franchissement de palier (25 / 50 / 75 / 100 %) notifie les personnes qui suivent le venture.

### 2.6 Watchlist

Les cartes de la watchlist affichent le score de readiness, la progression du financement, le nombre de marques d'intérêt, l'état de campagne et les actions disponibles (voir, demander une introduction, ajouter au pipeline, retirer).

### 2.7 Réunions

Planification (type, date, heure, lieu), puis clôture avec résultat, notes et actions. Tout est reporté dans le journal de la relation.

### 2.8 Due diligence

Déroulé d'une demande :
`pending` → `under_review` (revue RM) → `documents_uploaded` (dépôt fondateur) → `verified` (vérification IM) → `completed`.
Chaque étape est réservée au bon rôle. Les pièces déposées sont stockées avec leur nom, taille, type, auteur et date, et leur consultation est tracée. L'investisseur peut poser des questions de suivi à partir du dépôt des documents. Chaque changement de statut alimente l'historique de version.

### 2.9 Engagement et portefeuille

Le passage à `invested` met à jour la campagne (montant levé), clôture automatique si l'objectif est atteint, crée une décision avec montant, ajoute une entrée au journal, fait passer l'espace en `active_investment`, et notifie investisseur, admin, RM et IM. Le portefeuille de l'investisseur liste ses ventures investies.

### 2.10 Notifications

| Événement | Destinataires |
|---|---|
| Profil investisseur soumis | Admin |
| Investisseur approuvé / rejeté | Investisseur |
| Introduction demandée | Admin |
| Introduction approuvée | Investisseur |
| Campagne publiée | Investisseurs correspondants |
| Palier de campagne (25 / 50 / 75 / 100 %) | Personnes suivant le venture |
| Réunion planifiée | RM, IM |
| Changement de statut DD | Journal de la relation |
| Document déposé / consulté | Journal de la relation |
| Investissement confirmé | Investisseur + Admin + RM + IM |

La cloche se rafraîchit par interrogation périodique (30 s), affiche le nombre non lu et navigue vers la page concernée.

### 2.11 Tableau de bord exécutif (admin)

Indicateurs (investisseurs vérifiés, campagnes actives, capital engagé, dossiers investis), financement (recherché / levé / engagé / taux de conversion), relations (actives, réunions tenues, investis, pipeline total), entonnoir par étape, performance des campagnes, demande sectorielle et meilleurs investisseurs.

### 2.12 Intégration

L'investisseur ne duplique pas les données des ventures : il lit directement les programmes/ventures existants. L'ensemble des événements critiques alimente les notifications et le journal de relation.

---

## 3. Parcours de test (UAT)

### Phase 1 — Onboarding des investisseurs

Créer I2, I3 et I4 via le **lien de candidature** (formulaire de la plateforme), pour éprouver le matching avec des profils variés (I1 existe déjà).

1. Super Admin → `INVESTOR MANAGEMENT` (`/admin/investors`) → **Ajouter un investisseur**.
2. Copier le **lien de candidature** et l'envoyer à Koffi, Amara et Marie.

**Création de I2 — AfriGreen Capital (Koffi Mensah)**

| # | Qui | Action |
|---|---|---|
| 1 | Koffi | Ouvre le lien de candidature |
| 2 | Koffi | Nom `Koffi Mensah`, email `koffi@afrigreen.test` |
| 3 | Koffi | Organisation `AfriGreen Capital`, bio « Impact fund investing in sustainable agriculture and clean energy across Francophone West Africa » |
| 4 | Koffi | Industries → AgriTech, CleanTech, Renewable Energy ; pays → SN, CI, GH ; stages → Seed, Series A ; ticket → $25K–$150K |
| 5 | Koffi | Expérience `5 years in impact investing, 8 portfolio companies in agri-tech` |
| 6 | Koffi | Soumet le formulaire |

**Création de I3 — Lagos Tech Angels (Amara Okafor)**

| # | Qui | Action |
|---|---|---|
| 7 | Amara | Ouvre le lien de candidature |
| 8 | Amara | Nom `Amara Okafor`, email `amara@lagostechangels.test` |
| 9 | Amara | Organisation `Lagos Tech Angels`, bio « Angel network backing early-stage fintech and SaaS startups in Nigeria and East Africa » |
| 10 | Amara | Industries → FinTech, SaaS, E-Commerce ; pays → NG, KE, ZA ; stages → Pre-Seed, Seed ; ticket → $10K–$100K |
| 11 | Amara | Expérience `Angel investor since 2020, 15+ deals, focus on fintech infrastructure` |
| 12 | Amara | Soumet le formulaire |

**Création de I4 — Santé Plus Invest (Dr. Marie Koné)**

| # | Qui | Action |
|---|---|---|
| 13 | Marie | Ouvre le lien de candidature |
| 14 | Marie | Nom `Dr. Marie Koné`, email `marie@santeplus.test` |
| 15 | Marie | Organisation `Santé Plus Invest`, bio « Healthcare-focused investment fund supporting digital health innovations across West Africa » |
| 16 | Marie | Industries → HealthTech, AI/ML ; pays → CI, SN, ML ; stages → Pre-Seed, Seed, Series A ; ticket → $50K–$500K |
| 17 | Marie | Expérience `15 years in healthcare, MD + MBA, 3 health-tech exits` |
| 18 | Marie | Soumet le formulaire |

**Approbation**

| # | Qui | Action |
|---|---|---|
| 19 | Super Admin | Examiner les 3 candidatures (soumissions) → **Approuver** |
| 20 | Système | Crée le compte investisseur (profil + préférences) et envoie l'email d'activation |
| 21 | Koffi / Amara / Marie | Ouvrent l'email → créent leur mot de passe |

> ✅ Attendu : les 3 apparaissent **Approuvé** dans `/admin/investors` après approbation de leur candidature.

**Matching attendu sur NovaSpark (EdTech, CD)**

| Investisseur | Focus | Visible ? | Raison |
|---|---|---|---|
| I1 — Sarah | EdTech, AI/ML, FinTech · CD, KE, GH | ✅ ~85 % | Industrie + pays + stage |
| I2 — Koffi | AgriTech, CleanTech, RE · SN, CI, GH | ❌ 0 % | Aucune correspondance |
| I3 — Amara | FinTech, SaaS, E-Com · NG, KE, ZA | ❌ 0 % | Industrie différente |
| I4 — Marie | HealthTech, AI/ML · CI, SN, ML | ✅ partiel | AI/ML (~30 %) |

### Phase 2 — Découverte et watchlist

1. Investisseur → onglet **Discover** → NovaSpark visible avec son score.
2. Ouvrir NovaSpark → description, industrie, pays, readiness ; badge de campagne actif visible.
3. Clic sur le marque-page → **Added to watchlist**.
4. Onglet **Watchlist** → readiness, financement, campagne, nombre d'intérêts, actions visibles.
5. Discover → **Filters** → Industrie : EdTech → seules les ventures EdTech restent.

### Phase 3 — Demande d'introduction

1. Discover → NovaSpark → **Request Introduction**.
2. Message : « Interested in NovaSpark's EdTech solution for Francophone Africa… » → soumettre.

> ✅ Attendu : confirmation « Venture Meeting Requested ».

### Phase 4 — Approbation admin, espace et campagne

1. `/admin/investors/relationships` → **Pending Introductions** → NovaSpark / Sarah Thompson.
2. **Approve & Create Workspace**.
3. Espace ouvert → **+ Assign** sur Relationship Manager → Daniel Mensah.
4. **+ Assign** sur Investment Manager → Michael Lawson.
5. `/admin/investors/campaigns` → **New Campaign** → venture NovaSpark, nom `NovaSpark Pre-Seed Round`, objectif `250000`, minimum `25000` → **Create Draft** → **Publish**.
6. Espace → onglet Meetings → **Schedule Meeting** (introductive, demain 10:00, Google Meet).
7. La réunion apparaît → **Complete** → résultat « Positive », notes, actions → **Complete Meeting**.

> ✅ Attendu : notifications envoyées aux investisseurs correspondants ; journal mis à jour avec « Meeting completed ».

### Phase 5 — Due diligence (multi-utilisateurs)

1. Super Admin → onglet **Due Diligence** → **Create DD Workspace** → le pipeline passe à `due_diligence`.
2. **Sarah** → Pipeline → **Open Workspace** → onglet Requests → **New Request** :
   - `Financial Statements 2024`, catégorie *Financial*, priorité *High*, échéance, description.
   - `Customer Contracts`, catégorie *Commercial*, priorité *Medium*.
   - `Certificate of Incorporation`, catégorie *Corporate*, priorité *High*.
   
   ✅ Attendu : 3 demandes en `pending`.
3. **Daniel (RM)** → ouvre l'espace → onglet Due Diligence → **RM Review** sur chaque demande.
   
   ✅ Attendu : seuls « RM Review » et « Founder Uploaded » visibles ; les statuts passent à `under_review`.
4. **Alice (fondateur)** → ouvre l'espace → **Upload Document** sur chaque demande (PDF, Excel…).
   
   ✅ Attendu : fichiers visibles (nom, taille, téléchargement) ; statut `documents_uploaded` ; boutons RM/IM masqués.
5. **Michael (IM)** → **IM Verify** → statut `verified`, puis **Complete** → statut `completed`.
   
   ✅ Attendu : « RM Review » masqué pour lui.
6. **Sarah** → 3 demandes en `completed` → **+ Ask follow-up question** → envoyer.
7. Ouvrir **Version History** → tous les changements de statut sont tracés.

### Phase 6 — Engagement d'investissement

1. Super Admin → espace NovaSpark → vérifier que les événements DD sont dans le journal.
2. Sarah → Pipeline → NovaSpark → menu → **Invested**.
3. Super Admin → `/admin/investors/campaigns` → le montant levé a augmenté.

> ✅ Attendu : notifications à investisseur, admin, RM et IM.

### Phase 7 — Portefeuille et analyse

1. Sarah → **PORTFOLIO** → NovaSpark « Invested · ↑ Active ».
2. Super Admin → `/admin/investors/dashboard` : indicateurs, financement, entonnoir par étape, performance des campagnes, demande sectorielle, meilleurs investisseurs.

### Phase 8 — Vérifications finales

**Permissions en due diligence**

| Action | Investisseur | RM | IM | Fondateur | Super Admin |
|---|---|---|---|---|---|
| Créer une demande | ✅ | ❌ | ❌ | ❌ | ✅ |
| Revue RM | ❌ | ✅ | ❌ | ❌ | ✅ |
| Déposer un document | ✅ | ✅ | ❌ | ✅ | ✅ |
| Dépôt fondateur | ❌ | ✅ | ❌ | ❌ | ✅ |
| Vérification IM | ❌ | ❌ | ✅ | ❌ | ✅ |
| Clôturer | ❌ | ❌ | ✅ | ❌ | ✅ |
| Question de suivi | ✅ | ❌ | ❌ | ❌ | ✅ |

**Navigation admin « Investors »**

| Onglet | Route | Fonction |
|---|---|---|
| INVESTOR MANAGEMENT | `/admin/investors` | Approuver / rejeter / suspendre, copier le lien d'inscription |
| DASHBOARD | `/admin/investors/dashboard` | Analyse exécutive |
| REVIEW | `/admin/investors/review` | Revue de qualification |
| OVERVIEW | `/admin/investors/overview` | Activité et suivi due diligence |
| CAMPAIGNS | `/admin/investors/campaigns` | Gestion des campagnes de levée |
| RELATIONSHIPS | `/admin/investors/relationships` | Espaces, réunions, due diligence |

---

## 4. Résultats UAT attendus

| # | Test | Statut |
|---|---|---|
| UAT-001 | Onboarding investisseur complet | ✅ |
| UAT-002 | Revue par l'Investment Manager | ✅ |
| UAT-003 | Approbation Super Admin | ✅ |
| UAT-004 | Publication de venture | ✅ |
| UAT-005 | Matching intelligent | ✅ |
| UAT-006 | Parcours d'introduction | ✅ |
| UAT-007 | Suivi watchlist | ✅ |
| UAT-008 | Cycle de vie d'une campagne | ✅ |
| UAT-009 | Coordination des réunions | ✅ |
| UAT-010 | Parcours de due diligence | ✅ |
| UAT-011 | Engagement d'investissement | ✅ |
| UAT-012 | Gestion de portefeuille | ✅ |
| UAT-013 | Notifications déclenchées par événement | ✅ |
| UAT-014 | Tableau de bord exécutif | ✅ |
| UAT-015 | Synchronisation inter-modules | ✅ |

---

## 5. Corrections apportées pendant la mise en place

| Problème | Correction |
|---|---|
| Montant investi utilisé avant d'être déclaré (transition `invested`) | Déclaration déplacée avant la création de la décision |
| Tableau de bord exécutif en erreur | Requêtes parallèles simplifiées |
| Compteur de notifications toujours à zéro | Comptage manuel des non-lues |
| Publication de campagne sans notification | Jointure corrigée (jointure externe) et logique de correspondance revue |
| Watchlist sans données enrichies | Agrégat JSON avec tri corrigé |
| API admin du pipeline vide pour `meeting_requested` | Ajout d'un filtre par étape |
