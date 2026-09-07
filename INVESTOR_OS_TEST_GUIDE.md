# InvestorOS — Test de bout en bout

## Comptes de test

### Staff Future Studio

| Rôle | Nom | Email | Password |
|------|-----|-------|----------|
| **Super Admin** | Super Admin | `superadmin@impactos.staging` | `ImpactOS2026!` |
| **Relationship Manager** | Daniel Mensah | `daniel.mensah@futurestudio.test` | `ImpactOS2026!` |
| **Investment Manager** | Michael Lawson | `michael.lawson@futurestudio.test` | `ImpactOS2026!` |
| **Venture Manager** | Grace Mensah | `grace.mensah@futurestudio.test` | `ImpactOS2026!` |
| **Lead Coach** | David Adebayo | `david.adebayo@futurestudio.test` | `ImpactOS2026!` |
| **Strategic Advisor** | Jean-Claude Kouassi | `jeanclaude.kouassi@futurestudio.test` | `ImpactOS2026!` |

### Investisseurs

| # | Organisation | Représentant | Email | Password | Type | Focus | Géographie | Ticket |
|---|-------------|-------------|-------|----------|------|-------|------------|--------|
| **I1** | Growth Capital Africa | Sarah Thompson | `sarah@growthcapital.africa` | `test123` | VC Firm | EdTech, AI/ML, FinTech | CD, KE, GH | $50K–$250K |
| **I2** | AfriGreen Capital | Koffi Mensah | À créer via wizard | `ImpactOS2026!` | Impact Fund | AgriTech, CleanTech, Renewable Energy | SN, CI, GH | $25K–$150K |
| **I3** | Lagos Tech Angels | Amara Okafor | À créer via wizard | `ImpactOS2026!` | Angel Network | FinTech, SaaS, E-Commerce | NG, KE, ZA | $10K–$100K |
| **I4** | Santé Plus Invest | Dr. Marie Koné | À créer via wizard | `ImpactOS2026!` | Health Fund | HealthTech, AI/ML | CI, SN, ML | $50K–$500K |

### Fondateurs (Ventures)

| # | Fondateur | Email | Venture | Password |
|---|-----------|-------|---------|----------|
| **F1** | Alice Johnson | `alice.johnson@futurestudio.test` | NovaSpark Ventures (EdTech) | `ImpactOS2026!` |

### Ventures dans le système

| Venture | Industrie | Pays | Stage | Readiness | Funding Goal |
|---------|-----------|------|-------|-----------|-------------|
| **NovaSpark Ventures** | EdTech | CD | Pre-Seed | 96% | $250,000 |
| **Auto KPI Test 1786** | EdTech | CD | Seed | 16% | — |
| **Live Test Program** | EdTech | CD | — | 33% | — |

### Campagnes actives

| Campagne | Venture | Target | Raised | Progress |
|----------|---------|--------|--------|----------|
| Nova Sparck pre-seed round | NovaSpark Ventures | $25,000 | $7,000 | 28% |

---

## Phase 1 — Onboarding Investors (UAT-001 à 003)

> **Note** : Créer les 3 nouveaux investisseurs (I2, I3, I4) via le wizard pour tester le matching engine avec différents profils.
> Sarah (I1) existe déjà.

### 1.1 Admin envoie le lien d'inscription

| # | Qui | Action |
|---|-----|--------|
| 1 | Super Admin | `/admin/investors` → bouton **"Copy Registration Link"** → lien copié |
| 2 | Super Admin | Envoie le lien `/investor/wizard` aux 3 nouveaux investisseurs (I2, I3, I4) |

### 1.2 Création de I2 — AfriGreen Capital (Koffi Mensah)

| # | Qui | Action |
|---|-----|--------|
| 3 | Koffi | Ouvre le lien → `/investor/wizard` |
| 4 | Koffi | **Step 1** : Name `Koffi Mensah`, Email `koffi@afrigreen.test`, Password `ImpactOS2026!` |
| 5 | Koffi | **Step 2** : Organization `AfriGreen Capital`, Bio `Impact fund investing in sustainable agriculture and clean energy across Francophone West Africa` |
| 6 | Koffi | **Step 3** : Industries → AgriTech, CleanTech, Renewable Energy ; Countries → SN, CI, GH ; Stages → Seed, Series A ; Ticket → $25K–$150K |
| 7 | Koffi | **Step 4** : Experience → `5 years in impact investing, 8 portfolio companies in agri-tech` |
| 8 | Koffi | **Step 5** → Submit |

### 1.3 Création de I3 — Lagos Tech Angels (Amara Okafor)

| # | Qui | Action |
|---|-----|--------|
| 9 | Amara | Ouvre le lien → `/investor/wizard` |
| 10 | Amara | **Step 1** : Name `Amara Okafor`, Email `amara@lagostechangels.test`, Password `ImpactOS2026!` |
| 11 | Amara | **Step 2** : Organization `Lagos Tech Angels`, Bio `Angel network backing early-stage fintech and SaaS startups in Nigeria and East Africa` |
| 12 | Amara | **Step 3** : Industries → FinTech, SaaS, E-Commerce ; Countries → NG, KE, ZA ; Stages → Pre-Seed, Seed ; Ticket → $10K–$100K |
| 13 | Amara | **Step 4** : Experience → `Angel investor since 2020, 15+ deals, focus on fintech infrastructure` |
| 14 | Amara | **Step 5** → Submit |

### 1.4 Création de I4 — Santé Plus Invest (Dr. Marie Koné)

| # | Qui | Action |
|---|-----|--------|
| 15 | Marie | Ouvre le lien → `/investor/wizard` |
| 16 | Marie | **Step 1** : Name `Dr. Marie Koné`, Email `marie@santeplus.test`, Password `ImpactOS2026!` |
| 17 | Marie | **Step 2** : Organization `Santé Plus Invest`, Bio `Healthcare-focused investment fund supporting digital health innovations across West Africa` |
| 18 | Marie | **Step 3** : Industries → HealthTech, AI/ML ; Countries → CI, SN, ML ; Stages → Pre-Seed, Seed, Series A ; Ticket → $50K–$500K |
| 19 | Marie | **Step 4** : Experience → `15 years in healthcare, MD + MBA, 3 health-tech exits` |
| 20 | Marie | **Step 5** → Submit |

### 1.5 Admin approuve tous les investisseurs

| # | Qui | Action |
|---|-----|--------|
| 21 | Super Admin | `/admin/investors/review` → voit AfriGreen Capital, Lagos Tech Angels, Santé Plus Invest en PENDING REVIEW |
| 22 | Super Admin | Pour chaque : ajoute des Review Notes → **"Recommend Approval"** |
| | | ✅ Attendu : Les 3 disparaissent de la liste pending |

### 1.6 Résultats de matching attendus par investisseur

| Investisseur | Focus | NovaSpark (EdTech, CD) visible ? | Raison |
|-------------|-------|----------------------------------|--------|
| **I1 — Sarah** | EdTech, AI/ML, FinTech · CD, KE, GH | ✅ 85% match | Industry + Country + Stage match |
| **I2 — Koffi** | AgriTech, CleanTech, RE · SN, CI, GH | ❌ 0% match | Aucune correspondance |
| **I3 — Amara** | FinTech, SaaS, E-Com · NG, KE, ZA | ❌ 0% match | Industrie ≠ EdTech |
| **I4 — Marie** | HealthTech, AI/ML · CI, SN, ML | ✅ Partial match | AI/ML match (30%) |

> **Test matching** : Connecte-toi avec chaque investisseur et vérifie que NovaSpark apparaît (ou pas) selon le tableau ci-dessus.

---

## Phase 2 — Venture Discovery & Watchlist (UAT-004, 005, 007)

### 2.1 Découverte

| # | Qui | Action |
|---|-----|--------|
| 13 | Investor | Dashboard → Discover tab → NovaSpark Ventures visible avec **85% match** |
| 14 | Investor | Clic sur NovaSpark → détails : description, industry, country, readiness 96% |
| | | ✅ Attendu : Campaign badge "CAMPAIGN ACTIVE" visible |

### 2.2 Watchlist

| # | Qui | Action |
|---|-----|--------|
| 15 | Investor | Sur NovaSpark → clic bookmark → **"Added to watchlist"** |
| 16 | Investor | Onglet **Watchlist** → NovaSpark apparaît avec : Readiness 96%, Funding 28%, campaign $7K/$25K, 1 investor interested |
| | | ✅ Attendu : Actions View, Request Intro, Add to Pipeline, Remove visibles |

### 2.3 Filtres

| # | Qui | Action |
|---|-----|--------|
| 17 | Investor | Discover → **Filters** → Industry: EdTech → **Search** |
| | | ✅ Attendu : Seuls les ventures EdTech apparaissent |

---

## Phase 3 — Introduction Request (UAT-006)

| # | Qui | Action |
|---|-----|--------|
| 18 | Investor | Discover → NovaSpark → **"Request Introduction"** |
| 19 | Investor | Message : `Interested in NovaSpark's EdTech solution for Francophone Africa. Our fund focuses on early-stage EdTech across West Africa.` → **Submit** |
| | | ✅ Attendu : Toast "Venture Meeting Requested" |

---

## Phase 4 — Admin approuve & crée le workspace (UAT-008, 009)

### 4.1 Approbation

| # | Qui | Action |
|---|-----|--------|
| 20 | Super Admin | `/admin/investors/relationships` → **Pending Introductions** → NovaSpark / Sarah Thompson visible |
| 21 | Super Admin | **"Approve & Create Workspace"** |

### 4.2 Assignation RM & IM

| # | Qui | Action |
|---|-----|--------|
| 22 | Super Admin | Workspace ouvert → **"+ Assign"** sur Relationship Manager → cherche "Daniel Mensah" → sélectionne |
| 23 | Super Admin | **"+ Assign"** sur Investment Manager → cherche "Michael Lawson" → sélectionne |
| | | ✅ Attendu : RM = "Daniel Mensah", IM = "Michael Lawson" |

### 4.3 Fundraising Campaign (Admin)

| # | Qui | Action |
|---|-----|--------|
| 24 | Super Admin | `/admin/investors/campaigns` → **"New Campaign"** |
| 25 | Super Admin | Venture: NovaSpark, Name: `NovaSpark Pre-Seed Round`, Target: `250000`, Min: `25000` → **Create Draft** → **Publish** |
| | | ✅ Attendu : Notifications envoyées aux investisseurs matchés |

### 4.4 Meeting

| # | Qui | Action |
|---|-----|--------|
| 26 | Super Admin | Retourne sur le workspace NovaSpark → Onglet Meetings → **"Schedule Meeting"** |
| 27 | Super Admin | Type: Introductory, Date: demain, Time: 10:00, Location: Google Meet → **Schedule** |
| 28 | Super Admin | Le meeting apparaît → **"Complete"** |
| 29 | Super Admin | Outcome: Positive, Notes: `Investor interested in pilot results`, Action Items: `Founder to upload financial model` → **Complete Meeting** |
| | | ✅ Attendu : Timeline mise à jour avec "Meeting completed" |

---

## Phase 5 — Due Diligence (UAT-010) — MULTI-UTILISATEURS

### 5.1 Admin crée le DD workspace

| # | Qui | Action |
|---|-----|--------|
| 30 | Super Admin | Workspace → Onglet **Due Diligence** → **"Create DD Workspace"** |
| | | ✅ Pipeline NovaSpark passe à `due_diligence` |

### 5.2 Investor fait les demandes

| # | Qui | Action |
|---|-----|--------|
| 31 | **Investor (Sarah)** | Dashboard → Pipeline → NovaSpark = Due Diligence → **"Open Workspace"** |
| 32 | Sarah | Onglet Requests → **"New Request"** |
| 33 | Sarah | Title: `Financial Statements 2024`, Category: **Financial**, Priority: **High**, Due: 15/08/2026, Desc: `Need audited P&L, balance sheet, cash flow` → Submit |
| 34 | Sarah | **"New Request"** → Title: `Customer Contracts`, Category: **Commercial**, Priority: **Medium** → Submit |
| 35 | Sarah | **"New Request"** → Title: `Certificate of Incorporation`, Category: **Corporate**, Priority: **High** → Submit |
| | | ✅ Attendu : 3 requests en statut `pending` |

### 5.3 RM (Daniel Mensah) fait le review

| # | Qui | Action |
|---|-----|--------|
| 36 | **Daniel Mensah** | `/login` → `daniel.mensah@futurestudio.test` / `ImpactOS2026!` |
| 37 | Daniel | `/admin/investors/relationships` → clic workspace NovaSpark → Due Diligence |
| 38 | Daniel | Sur chaque request → **"RM Review"** |
| | | ✅ Attendu : Seuls "RM Review" et "Founder Uploaded" visibles. "IM Verify" caché. |
| | | ✅ Statuts passent à `under_review` |

### 5.4 Founder (Alice) upload les documents

| # | Qui | Action |
|---|-----|--------|
| 39 | **Alice Johnson** | `/login` → `alice.johnson@futurestudio.test` / `ImpactOS2026!` |
| 40 | Alice | `/admin/investors/relationships` → clic workspace NovaSpark → Due Diligence |
| 41 | Alice | Sur "Financial Statements" → **"Upload Document"** → choisis un fichier (PDF, Excel...) |
| 42 | Alice | Vérifie que le fichier apparaît (nom, taille, Download) + statut → `documents_uploaded` |
| 43 | Alice | Même chose pour "Customer Contracts" et "Certificate of Incorporation" |
| | | ✅ Attendu : Boutons RM Review et IM Verify **cachés** pour Alice (ni RM ni IM) |
| | | ✅ Download fonctionne, loggé dans la timeline |

### 5.5 IM (Michael Lawson) vérifie

| # | Qui | Action |
|---|-----|--------|
| 44 | **Michael Lawson** | `/login` → `michael.lawson@futurestudio.test` / `ImpactOS2026!` |
| 45 | Michael | `/admin/investors/relationships` → clic workspace NovaSpark → Due Diligence |
| 46 | Michael | Sur chaque request → **"IM Verify"** → statut `verified` |
| 47 | Michael | Sur chaque request → **"Complete"** → statut `completed` |
| | | ✅ Attendu : "RM Review" **caché** pour Michael. Seul "IM Verify" et "Complete" visibles. |

### 5.6 Investor review + follow-up

| # | Qui | Action |
|---|-----|--------|
| 48 | **Investor (Sarah)** | Retourne sur DD Workspace → 3 requests en `completed` |
| 49 | Sarah | Sur "Financial Statements" → **"+ Ask follow-up question"** → `When will the 2025 statements be available?` → Send |
| 50 | Sarah | Ouvre **Version History** (dropdown) → trace tous les changements de statut |

---

## Phase 6 — Investment Commitment (UAT-011)

| # | Qui | Action |
|---|-----|--------|
| 51 | Super Admin | `/admin/investors/relationships` → workspace NovaSpark → vérifie la Timeline (DD events visibles) |
| 52 | Investor (Sarah) | Dashboard → Pipeline → NovaSpark → dropdown → **"Invested"** |
| 53 | Super Admin | Vérifie `/admin/investors/campaigns` → NovaSpark current_raised a augmenté |
| | | ✅ Attendu : Notifications envoyées à investor + admin + RM + IM |

---

## Phase 7 — Portfolio & Analytics (UAT-012, 014)

| # | Qui | Action |
|---|-----|--------|
| 54 | Investor (Sarah) | Sidebar → **PORTFOLIO** → NovaSpark "Invested · ↑ Active" |
| 55 | Super Admin | `/admin/investors/dashboard` → Executive Dashboard |
| | | ✅ KPI : Verified Investors, Active Campaigns, Invested Deals |
| | | ✅ Fundraising : Capital Sought/Raised/Committed |
| | | ✅ Pipeline Funnel par stage |
| | | ✅ Campaign Performance, Sector Demand, Top Investors |

---

## Phase 8 — Vérifications finales

### Permissions par rôle (Due Diligence)

| Action | Investor | RM (Daniel) | IM (Michael) | Founder (Alice) | Super Admin |
|--------|----------|-------------|-------------|-----------------|-------------|
| Créer une request | ✅ | ❌ | ❌ | ❌ | ✅ |
| RM Review | ❌ | ✅ | ❌ | ❌ | ✅ |
| Upload Document | ✅ | ✅ | ❌ | ✅ | ✅ |
| Founder Uploaded | ❌ | ✅ | ❌ | ❌ | ✅ |
| IM Verify | ❌ | ❌ | ✅ | ❌ | ✅ |
| Complete | ❌ | ❌ | ✅ | ❌ | ✅ |
| Follow-up question | ✅ | ❌ | ❌ | ❌ | ✅ |

### Notifications vérifiées

| Événement | Destinataires |
|-----------|--------------|
| Investor soumet le profil | Admin (review notification) |
| Admin approuve l'investor | Investor (welcome) |
| Investor demande introduction | Admin (introduction request) |
| Admin approuve l'introduction | Investor (introduction approved) |
| Campagne publiée | Tous les investors matchés |
| Campagne milestone (25/50/75/100%) | Watchers |
| Meeting scheduled/completed | Timeline only |
| DD status changed | Timeline only |
| Document uploaded/downloaded | Timeline only |
| Investment confirmé | Investor + Admin + RM + IM |

### Navigation Admin Finale

| Onglet | URL | Fonction |
|--------|-----|----------|
| INVESTOR MANAGEMENT | `/admin/investors` | Approuver/rejeter/suspendre + Copy Registration Link |
| DASHBOARD | `/admin/investors/dashboard` | Executive analytics |
| REVIEW | `/admin/investors/review` | Qualification review |
| OVERVIEW | `/admin/investors/overview` | Activité & DD monitoring |
| CAMPAIGNS | `/admin/investors/campaigns` | Gestion fundraising |
| RELATIONSHIPS | `/admin/investors/relationships` | Workspaces, meetings, DD |
