# Répartition du travail — 7 stagiaires (+ la part du lead)

> **Compagnon de :** [`PLAN_DE_TRAVAIL_STAGIAIRES.md`](PLAN_DE_TRAVAIL_STAGIAIRES.md)
> (le catalogue complet des tâches) et
> [`GUIDE_DECOUPAGE_COUCHES.md`](GUIDE_DECOUPAGE_COUCHES.md) (la méthode).
>
> Ce document-ci est la **répartition nominative** : qui possède quoi, pour que
> 7 personnes travaillent en parallèle **sans jamais toucher le même fichier**.
> Chaque stagiaire lit uniquement **sa fiche** (§3) et travaille.

### Les deux documents, et les codes

| Document | À quoi il sert | Quand l'ouvrir |
|---|---|---|
| **Ce document** (`REPARTITION_STAGIAIRES.md`) | **Qui fait quoi** — la fiche de chaque personne | Pour savoir ta mission et tes fichiers |
| [`PLAN_DE_TRAVAIL_STAGIAIRES.md`](PLAN_DE_TRAVAIL_STAGIAIRES.md) | **Ce que chaque tâche contient** — la recette détaillée | Pour le détail d'une tâche (via son code) |

Les codes dans les fiches (ex. « tes tâches : **L1, V2** ») sont des **numéros de
ligne dans les tableaux du catalogue**. Une fiche = un point de départ ; le code
renvoie au catalogue pour le détail.

| Code | Signifie | Où le détail |
|---|---|---|
| **V** + numéro | Une **V**ue : une page à découper | Catalogue, tableau « CH-1 — Découper les vues » (V1…V17) |
| **B** + numéro | Un **B**loc d'interface : un composant à découper | Catalogue, tableau « CH-2 — Découper les composants » (B1…B14) |
| **L** + numéro | Une **L**ane : un couloir = un domaine de décision (routes + service + données) | Catalogue, tableau « CH-3 — Couloirs de domaine » (L1…L12) |
| **A** + numéro | Un **A**udit (lecture seule) | Catalogue, tableau « CH-5 — Audits » (A1…A3) |
| **CH-1…CH-5** | Les cinq grands chantiers | Catalogue, §3 « Vue d'ensemble des chantiers » |

**Exemples :** « **L1** » = le couloir *plateforme*. « **V2** » = la 2ᵉ page du
tableau des vues = la page des exécutions de formulaires. « Tes tâches : L1, V2 »
veut donc dire : *tu prends le domaine plateforme **et** la page des exécutions*.

---

## 1. La règle d'or (à rappeler à chaque stagiaire)

1. **Tu ne modifies que les fichiers de ta fiche.** Rien d'autre.
2. **Tes nouveaux fichiers vont dans un dossier à ton nom** (indiqué dans ta
   fiche). Jamais dans le dossier d'un autre.
3. **Un domaine de décision (couloir) = un seul propriétaire**, car il partage
   un fichier de rassemblement commun. Ton couloir t'appartient entièrement.
4. **On ne change pas la forme des réponses de l'API.** Le rendu non plus.
5. **Un fichier hors de ta fiche = on ne le touche pas.** On écrit une note au
   lead.

> **Le filet de sécurité :** tout dossier de route **non listé** dans ce document
> appartient **par défaut au lead**. Un stagiaire ne prend donc jamais un dossier
> « oublié » : il n'y a pas de trou, et pas de double propriétaire.

---

## 2. Synthèse (vue d'un coup d'œil)

| # | Stagiaire / pôle | Couloir (décision + données) | Grosse vue / composant | Feature |
|---|---|---|---|---|
| chris mael | **Plateforme & formulaires** | `services/platform/**` | Page « runs » plateforme | Formulaires publics, évaluation, réponses |
| scom M | **Ventures** | `services/ventures/**` | Panneau parcours (jalons) ventures | Parcours startup, jalons, modèles |
| Aïchath | **Programmes** | `services/programs/**` | Pages admin « programmes » | Programmes, curriculum, équipe programme |
| Harry | **Permissions & sécurité** | `services/authorization/**` | Centre de permissions | Droits, périmètres, accès |
| Jas | **CRM & contacts** | `services/contacts/**` | Écran d'adhésion + page contacts | Contacts, groupes, familles, adhésions |
| Alexis | **Opérations internes** | `services/tasks/**` + `services/projects/**` | Gestionnaire de tâches + page tâches | Tâches, blocages, projets, standups |
| Christelle | **Tableau de bord & messagerie** | `services/communications/**` | Coquille de l'application + messagerie | Annonces, campagnes, messages |
| — | **Lead (toi)** | Couloirs restants + audit | Vues/composants restants + façades | Coordination, nettoyage, domaines à ouvrir |

Aucune ligne ne partage de fichier avec une autre. Détail et preuve par fiche.

---

## 3. Fiches détaillées

### Fiche 1 — Plateforme & formulaires publics

**Ta mission.** Finir d'amaigrir les contrôleurs de la plateforme de formulaires
(sortir la décision vers le service), découper son gros fichier de service, puis
découper la page « runs » de la plateforme.

**Tu possèdes (exclusif) :**
- Service : `src/services/platform/**` (dont `formRuns.js` 2 133, `import.js` 609,
  `seed.js` 535, `report.js` 426).
- Routes (dossiers entiers) : `src/app/api/platform/**`, `src/app/api/forms/**`,
  `src/app/api/s/**`, `src/app/api/intents/**`, `src/app/api/evaluation/**`,
  `src/app/api/respond/**`, `src/app/api/responses/**`,
  `src/app/api/run-export/**`.
- Vue : `src/app/platform/runs/page.js` (5 353) → nouveaux composants dans
  `src/components/platform/runs/`.
- Tes tâches du catalogue : **L1**, **V2**.

**Tu ne touches pas :**
- `src/app/api/public/**` (dont le paiement) → lead.
- `src/app/platform/forms/page.js` et `src/app/admin/platform/scores/page.js`
  → réservés au lead.
- Toute autre route de l'API.

**Démarrer :**
```sh
ls -d src/app/api/platform/*/ src/app/api/forms/*/ src/app/api/s/*/
grep -rhoE 'from "@/models/[a-zA-Z0-9/_-]+' src/app/api/platform/ src/app/api/forms/ src/app/api/s/ --include=route.js | sort -u
```

**Terminé quand :** les routes de ton périmètre ne font plus qu'authentifier /
valider / mettre en forme ; la décision est dans ton service ; ton gros service
est découpé ; la page « runs » est composée de composants ; tests, lint, build
verts.

---

### Fiche 2 — Ventures

**Ta mission.** Finir le couloir ventures côté décision et découper le grand
panneau de gestion du parcours des startups.

**Tu possèdes (exclusif) :**
- Service : `src/services/ventures/**` (dont `planImport.js` 1 178,
  `milestoneEngine.js` 548, `submissions.js` 526, `journey.js` 520,
  `verification.js` 487, `profile.js` 441, `schema.js` 410).
- Routes (dossiers entiers) : `src/app/api/ventures/**` et tous les
  `src/app/api/venture-*/**`, plus `src/app/api/journey-reports/**`,
  `src/app/api/journey-templates/**`, `src/app/api/knowledge/**`.
- Composants : `src/components/ventures/JourneyManagerPanel.js` (2 617) **et**
  `src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js` (654)
  → nouveaux composants dans `src/components/ventures/journey/`.
- Tes tâches : **L2**, **B7**.

**Tu ne touches pas :**
- `src/components/ventures/VentureDashboard.js` et
  `src/components/ventures/PlanImportPanel.js` → réservés au lead.
- Les routes de programmes (`api/programs`, `api/pm`, `api/v2…`).

**Démarrer :**
```sh
ls -d src/app/api/ventures/*/ src/app/api/venture-*/*/
grep -rhoE 'from "@/models/[a-zA-Z0-9/_-]+' src/app/api/ventures/ --include=route.js | sort -u
```

---

### Fiche 3 — Programmes

**Ta mission.** Finir le couloir programmes côté décision, puis découper les
pages d'administration des programmes.

**Tu possèdes (exclusif) :**
- Service : `src/services/programs/**` (dont `workspace.js` 596,
  `curriculum.js` 539).
- Routes (dossiers entiers) : `src/app/api/programs/**`,
  `src/app/api/program-staff/**`, `src/app/api/program-types/**`,
  `src/app/api/participant-programs/**`, `src/app/api/pm/**`,
  `src/app/api/v2/**`.
- Vues : `src/app/admin/programs/**` (`page.js` 2 402, `new/page.js` 1 346,
  `[id]/page.js` 876) → nouveaux composants dans
  `src/components/admin/programs/`.
- Tes tâches : **L4**, **V16**.

**Tu ne touches pas :**
- `src/app/pm/programs/[id]/page.js` (page PM, 6 699) → réservée au lead.
- `src/app/facilitator/program/[id]/page.js` → lead.
- `src/components/pm/FacilitatorsPanel.js` → lead.
- `src/app/api/participant/**` **sauf** `src/app/api/participant/programs/**`
  (qui est à toi) et sauf `participant-programs/**` (à toi) → le reste est au
  lead.

**Démarrer :**
```sh
ls -d src/app/api/programs/*/ src/app/api/v2/*/ src/app/api/pm/*/
grep -rhoE 'from "@/models/[a-zA-Z0-9/_-]+' src/app/api/programs/ src/app/api/v2/ --include=route.js | sort -u
```

---

### Fiche 4 — Permissions & sécurité

**Ta mission.** Finir le couloir autorisation côté décision, puis découper le
centre de permissions (le plus gros composant du dépôt).

**Tu possèdes (exclusif) :**
- Service : `src/services/authorization/**` (dont `context.js` 560,
  `contextGrants.js` 538).
- Routes (dossiers entiers) : `src/app/api/access-profiles/**`,
  `src/app/api/security/**`, `src/app/api/engineering/**`,
  `src/app/api/org-membership/**`, `src/app/api/responsibilities/**`.
- Composant : `src/components/permissions/PermissionCenter.js` (4 884)
  → nouveaux composants dans `src/components/permissions/permission-center/`.
- Tes tâches : **L5**, **B10**.

**Tu ne touches pas :**
- `src/components/permissions/PeopleView.js` et
  `src/components/permissions/ProgramScopePanel.js` → réservés au lead.
- Le reste de `src/components/permissions/` (dossier partagé : crée uniquement
  dans **ton** sous-dossier `permission-center/`).

**Attention :** `src/services/authorization/**` est le cœur du système de
permissions. C'est un couloir **critique** : toute décision déplacée doit être
précédée d'un test de comportement. En cas de doute, demande au lead.

**Démarrer :**
```sh
ls -d src/app/api/access-profiles/*/ src/app/api/security/*/ src/app/api/engineering/*/
```

---

### Fiche 5 — CRM & contacts

**Ta mission.** Finir le couloir contacts côté décision, découper la page
contacts et l'écran d'adhésion.

**Tu possèdes (exclusif) :**
- Service : `src/services/contacts/**`.
- Routes (dossiers entiers) : `src/app/api/contacts/**`,
  `src/app/api/people/**`, `src/app/api/families/**`,
  `src/app/api/groups/**`, `src/app/api/user-groups/**`,
  `src/app/api/group-members/**`, `src/app/api/segments/**`,
  `src/app/api/contact-emails/**`.
- Vues/composants : `src/app/admin/communications/contacts/page.js` (1 543)
  → `src/components/crm/contacts-page/` ; et
  `src/components/crm/MembershipScreen.js` (703) → `src/components/crm/membership/`.
- Tes tâches : **L7**, **V8**, **B14**.

**Tu ne touches pas :**
- `src/app/api/admin/**` (import en masse) → lead.
- `src/app/api/categories/**` → lead.

**Démarrer :**
```sh
ls -d src/app/api/contacts/*/ src/app/api/groups/*/ src/app/api/user-groups/*/
grep -rhoE 'from "@/models/[a-zA-Z0-9/_-]+' src/app/api/contacts/ src/app/api/groups/ --include=route.js | sort -u
```

---

### Fiche 6 — Opérations internes (tâches, projets)

**Ta mission.** Finir les couloirs tâches **et** projets côté décision, puis
découper le gestionnaire de tâches et la page tâches d'admin.

**Tu possèdes (exclusif) :**
- Services : `src/services/tasks/**` (dont `update.js` 730) **et**
  `src/services/projects/**`.
- Routes (dossiers entiers) : `src/app/api/tasks/**`,
  `src/app/api/blockers/**`, `src/app/api/standups/**`,
  `src/app/api/retros/**`, `src/app/api/projects/**`,
  `src/app/api/team-tasks/**`.
- Vue + composant : `src/app/admin/tasks/page.js` (939)
  → `src/components/tasks/admin-tasks/` ; et
  `src/components/tasks/TaskManager.js` (2 510) → `src/components/tasks/manager/`.
- Tes tâches : **L3**, **B2**, **V13**.

**Tu ne touches pas :**
- `src/app/staff/projects/[id]/page.js` et `src/app/admin/projects/**`
  (pages) → réservées au lead.
- `src/components/layout/DashboardLayout.js` → stagiaire 7.

**Démarrer :**
```sh
ls -d src/app/api/tasks/*/ src/app/api/projects/*/ src/app/api/blockers/*/
grep -rhoE 'from "@/models/[a-zA-Z0-9/_-]+' src/app/api/tasks/ src/app/api/projects/ --include=route.js | sort -u
```

---

### Fiche 7 — Tableau de bord & messagerie

**Ta mission.** Finir le couloir communications côté décision, puis découper la
coquille de l'application (barre latérale + en-tête) et la messagerie.

**Tu possèdes (exclusif) :**
- Service : `src/services/communications/**` (dont `internalComms.js` 412).
- Routes (dossiers entiers) : `src/app/api/campaigns/**`,
  `src/app/api/internal-comms/**`, `src/app/api/announcements/**`,
  `src/app/api/followups/**`, `src/app/api/events/**`,
  `src/app/api/notifications/**`.
- Composants : `src/components/layout/DashboardLayout.js` (2 186)
  → `src/components/layout/shell/` ; et
  `src/components/messaging/MessagingChat.js` (1 549)
  → `src/components/messaging/chat/`.
- Tes tâches : **L8**, **B1**, **B6**.

**Tu ne touches pas :**
- `src/app/**/layout.js` : tu découpes le **composant** de coquille, mais tu ne
  modifies **pas** les fichiers `layout.js` des sections (ils l'importent).
- `src/components/dashboard/**` → lead.

**Attention :** `DashboardLayout.js` est affiché par toutes les sections de
l'application. C'est un composant **très partagé** : le découper doit être
**strictement sans changement de rendu**. Ne modifie jamais son export public.

**Démarrer :**
```sh
ls -d src/app/api/campaigns/*/ src/app/api/internal-comms/*/
grep -rhoE 'from "@/models/[a-zA-Z0-9/_-]+' src/app/api/internal-comms/ --include=route.js | sort -u
```

---

## 4. Ce que le lead garde (toi)

Cette part n'est **attribuée à personne** : c'est la tienne. Elle n'est jamais
touchée par les stagiaires.

### 4.1 Couloirs et domaines réservés

| Domaine | Routes | Service |
|---|---|---|
| Espace de travail & calendrier | `api/calendar/**`, `api/workspaces/**` | `services/workspace/**` |
| LMS & paiement | `api/lms/**`, `api/public/**` | `services/lms/**` |
| Finance | `api/finance/**` | `services/finance/**` |
| E-mail & intégrations | `api/gmail-v1-test/**`, `api/integrations/**`, `api/webhooks/**` | `services/email/**` |
| **Portail participant** *(domaine à ouvrir)* | `api/participant/**`, `api/me/**`, `api/profile/**` | créer `services/participant/**` |
| **Investisseur** *(domaine à ouvrir)* | `api/investor/**`, `api/intelligence/**` | créer `services/investor/**` |
| **Tableau de bord & ops admin** *(à ouvrir)* | `api/dashboard/**`, `api/admin/**`, `api/activity/**`, `api/op-reports/**`, `api/kpis/**`, `api/kpi-progress/**` | créer `services/dashboard/**` |
| **Long tail** (tout dossier non listé) | `api/sessions/**`, `api/teams/**`, `api/superadmin/**`, `api/system/**`, `api/categories/**`, `api/documents/**`, `api/deliverables/**`, `api/feedback/**`, `api/facilitators/**`, `api/invites/**`, `api/attendance/**`, `api/migrate/**`, `api/health/**`, `api/errors/**`, … | au cas par cas |

### 4.2 Vues réservées

`V1` (PM programmes, 6 699), `V3` (op-report staff), `V4` (op-reports admin),
`V5` (admin accueil), `V7` (team), `V9` (page publique s/), `V10` (facilitateur),
`V11` (investisseur), `V12` (relations investisseurs), `V14` (projets staff),
`V15` (scores plateforme), `V17` (admin projets).

### 4.3 Composants réservés

`B3` (UnifiedDashboard), `B4` (ProgramDetail), `B5` (ProfileView),
`B8` (VentureDashboard), `B9` (PlanImportPanel), `B11` (PeopleView +
ProgramScopePanel), `B12` (FacilitatorsPanel), `B13` (LMS SectionResources +
SectionsManager).

### 4.4 Travaux que toi seul peux faire

- **Nettoyage des façades** (`CH-4`) : touche des lignes d'import dispersées
  partout → **sérialisé**, à faire **après** les stagiaires.
- **Audits** (`A1`–`A3`) : lecture seule.
- **Arbitrage** des cas ambigus : une route qui importe deux domaines, un besoin
  hors périmètre, une fiche à ajuster.

### 4.5 Ordre de travail du lead (ta feuille de route)

Du plus rentable / débloquant au plus tard :

1. ✅ **Couloir « espace de travail & calendrier »** — **terminé** : calendrier
   et workspaces migrés (voir le journal ci-dessous).
2. ✅ **Portail participant** — domaine **terminé** (`services/participant/**`) :
   affectations, accueil, progression, relances, état complet, rituels,
   chronologie, soumissions. `certificates` reste tel quel (pure lecture, aucune
   décision). Restent **hors domaine** : `api/me/**` et `api/profile/**`.
3. ✅ **Investisseur** — domaine **terminé** (`services/investor/**`) : due
   diligence, campagnes, pipeline, relations, évaluation, décisions,
   organisations, liste de suivi, préférences, réunions, tableau de bord,
   agrégateurs et mot de passe. `register` est un 410 sans décision.
4. 🟰 **LMS & paiement** et **e-mail / intégrations** — routes à décision
   migrées : le **règlement partagé** (`settleVerifiedPayment`), la
   **réconciliation** (`checkoutReconcile`), l'**inscription publique**
   (`api/public/register`, `api/public/group-info`) →
   `services/lms/publicRegistration.js`, le **webhook Resend** (signature Svix +
   fraîcheur + table événement → statut) → `services/email/resendWebhook.js`, et
   la **machine à états de la notification Kkiapay** (référence inconnue,
   doublon, échec explicite, vérification puis règlement) →
   `services/lms/checkoutWebhook.js`. **Évalués et laissés au contrôleur** (aucune
   décision métier) : le dispatch d'action de `api/lms/registrations`
   (`link-run` vs `reconcile` : un simple aiguillage, le travail est déjà dans les
   services), `api/gmail-v1-test` (diagnostic temporaire « à supprimer »), et
   `api/integrations/**`, `api/public/course-match`, `api/webhooks/route.js`,
   `api/webhooks/[id]` (délèguent déjà).
5. **Vues et composants réservés** (V1, V3, V4, V5, V7, V9–V12, V14, V15, V17 et
   B3, B4, B5, B8, B9, B11, B12, B13) — à intercaler avec les couloirs.
6. **Tableau de bord & ops admin** (agrégateurs : `api/dashboard/**`,
   `api/op-reports/**`, `api/activity/**`, `api/kpis/**`) — **en dernier**, une
   fois les domaines qu'ils agrègent terminés.
7. **Nettoyage des façades** (`CH-4`) — **très en dernier**, sérialisé.

### 4.6 Journal du lead

| Slice | État | Détail |
|---|---|---|
| Couloir espace de travail & calendrier — **calendrier** | ✅ fait | Les 3 décisions de `api/calendar/route.js` (périmètre programmes fail-closed, visibilité des suivis, périmètre ventures) déplacées dans `services/workspace/calendar.js`. Route amaigrie. SQL inchangé. Test de comportement ajouté (`src/__tests__/workspace-calendar.test.js`). Tests 394 ✅, lint 0 erreur, build ✅. |
| Couloir espace de travail & calendrier — **workspaces** | ✅ fait | Les décisions de `api/workspaces/route.js` (assemblage de la liste de navigation, dérivation des inscriptions à partir des adhésions, constitution des contextes, étiquetage d'identité) déplacées dans `services/workspace/navigation.js`. Route amaigrie. Lecture lue via les services autorisation/LMS, pas via les façades `lib`. Test de comportement ajouté (`src/__tests__/workspace-navigation.test.js`). Tests 404 ✅, lint 0 erreur, build ✅. |

> **Couloir « espace de travail & calendrier » : ✅ terminé.** Les deux routes de
> l'API (calendrier, workspaces) ont été migrées vers `services/workspace/**`.

| Portail participant — **domaine ouvert** | ✅ fait | Créé `services/participant/**`. |
| Portail participant — **assignations** | ✅ fait | Les décisions de `api/participant/assignments/route.js` (périmètre des livrables selon la portée tout/équipe/individu, rattachement de la soumission, tri « en retard d'abord », première version vs nouvelle version) déplacées dans `services/participant/assignments.js`. Route amaigrie. Test de comportement ajouté (`src/__tests__/participant-assignments.test.js`). Tests 398 ✅, lint 0 erreur, build ✅. |
| Portail participant — **accueil (home)** | ✅ fait | Les décisions de `api/participant/home/route.js` (règles de déblocage et de semaine, taux d'achèvement / assiduité / affectations / indicateurs, classification retard / échéance proche / à venir, assemblage du calendrier et des annonces) déplacées dans `services/participant/home.js`. Fonctions pures testables + route amaigrie. Test de comportement ajouté (`src/__tests__/participant-home.test.js`). Tests 410 ✅, lint 0 erreur, build ✅. |
| Portail participant — **progression** | ✅ fait | Les décisions de `api/participant/progress/route.js` (métriques par programme, jalons, historique par semaine, agrégation globale) déplacées dans `services/participant/progress.js`. Les règles de déblocage/semaine sont réutilisées depuis `home.js` pour que les deux vues ne divergent jamais. Test de comportement ajouté (`src/__tests__/participant-progress.test.js`). Tests 418 ✅, lint 0 erreur, build ✅. |
| Portail participant — **lot léger** | ✅ fait | Décisions de `followups` (fusion événements + table, mise en forme, tri), `full-state` (accès « soi ou rôle interne », résolution du cid, agrégation des notes), `rituals/*` (assemblage du texte de réflexion, défauts statut/semaine/année), `timeline` (bornage de la taille) déplacées dans `services/participant/{followups,fullState,rituals,timeline}.js`. Test ajouté (`src/__tests__/participant-misc.test.js`). |
| Portail participant — **soumissions** | ✅ fait | Décisions d'accès (lecture / écriture, soi ou rôle interne) et barrière « programme terminé = lecture seule » déplacées dans `services/participant/submissions.js`. Tests 445 ✅, lint 0 erreur, build ✅. |
| Portail participant — **certificats** | ➖ sans objet | `certificates` est une pure lecture : aucune décision à déplacer. |

> **Domaine participant : ✅ terminé.** Les huit routes à décision de
> `api/participant/**` (hors `programs/**`, chez le stagiaire 3) sont migrées
> vers `services/participant/**`. Restent hors domaine : `api/me/**` et
> `api/profile/**`.

| Investisseur — **domaine ouvert** | ✅ fait | Créé `services/investor/**`. |
| Investisseur — **due diligence** | ✅ fait | Décisions de `api/investor/diligence/route.js` (binding « soi », transitions de statut par rôle RM/IM/admin, historique de versions, questions de suivi, dispatch des actions) déplacées dans `services/investor/diligence.js`. Route amaigrie. Test ajouté (`src/__tests__/investor-diligence.test.js`). Tests 422 ✅, lint 0 erreur, build ✅. |
| Investisseur — **campagnes** | ✅ fait | Décisions de `api/investor/campaigns/route.js` (portée de la liste, normalisation des entrées, appariement des préférences investisseur/venture, franchissement des paliers de financement 25/50/75/100, notifications de publication et de palier) déplacées dans `services/investor/campaigns.js`. Route amaigrie. Test ajouté (`src/__tests__/investor-campaigns.test.js`). |
| Investisseur — **pipeline** | ✅ fait | Décisions de `api/investor/pipeline/route.js` (portée de la liste, stades valides, extraction du montant investi, cascades « demande de réunion » et « investi ») déplacées dans `services/investor/pipeline.js`. Route amaigrie. Test ajouté (`src/__tests__/investor-pipeline.test.js`). |
| Investisseur — **relations** | ✅ fait | Décisions de `api/investor/relationships/route.js` et `api/investor/relationships/meetings/route.js` (binding « soi » du workspace, portée de la liste, création/réactivation avec entrée de chronologie et notification d'introduction au mieux, mise à jour avec entrée de changement de statut, création de réunion avec entrée de planification, cascade d'achèvement : entrée + amorçage de `next_action`) déplacées dans `services/investor/relationships.js` et `services/investor/relationshipMeetings.js`. Routes amaigries. Test ajouté (`src/__tests__/investor-relationships.test.js`). |
| Investisseur — **évaluation** | ✅ fait | Décisions de `api/investor/evaluation/route.js` (binding « soi » du pipeline, dispatch d'écriture par type fondateur/risque) déplacées dans `services/investor/evaluation.js`. Route amaigrie. |
| Investisseur — **décisions** | ✅ fait | Décisions de `api/investor/decisions/route.js` (résolution du profil, types valides, binding « soi » du pipeline, table de correspondance décision → stade) déplacées dans `services/investor/decisions.js`. Route amaigrie. |
| Investisseur — **organisations** | ✅ fait | Décisions de `api/investor/organizations/route.js` (une organisation n'est visible que de ses membres, liste bornée au profil, seul un administrateur DE CETTE organisation peut ajouter/re-rôler un membre) déplacées dans `services/investor/organizations.js`. Route amaigrie. |
| Investisseur — **liste de suivi, préférences, réunions** | ✅ fait | Décisions de `watchlist` (bascule ajout/retrait), `preferences` (garde de profil, défauts d'écriture) et `meetings` (un appelant libre-service doit nommer une venture, sinon la requête renverrait les réunions de tous les investisseurs) déplacées dans `services/investor/{watchlist,preferences,meetings}.js`. Routes amaigries. |
| Investisseur — **tableau de bord** | ✅ fait | Décisions de `api/investor/dashboard/route.js` (notation des recommandations selon les pondérations industrie 30 / pays 25 / stade 20 / ticket 15 / complétude 10 et son tri) et assemblage des blocs (pipeline, liste de suivi, campagnes, relations et leurs prochaines réunions, statistiques) déplacées dans `services/investor/dashboard.js` (fonction pure `scoreVentures` testable). Route amaigrie. |
| Investisseur — **agrégateurs** | ✅ fait | Assemblages de `api/investor/executive-dashboard/route.js` et `api/investor/admin-overview/route.js` déplacés dans `services/investor/{executiveDashboard,adminOverview}.js` (aucune décision hors la forme d'une ligne ; gardés sous `requireAuth(["super_admin"])`). Routes amaigries. |
| Investisseur — **mot de passe** | ✅ fait | Décisions de `api/investor/setup-password/route.js` (champs requis, longueur minimale, recherche du jeton d'installation et son expiration, hachage + écriture) déplacées dans `services/investor/setupPassword.js`. Route amaigrie. |
| Investisseur — **register** | ➖ sans objet | `api/investor/register` est un 410 « flux retiré » : aucune décision, aucune écriture. Laissé tel quel. |

> **Domaine investisseur : ✅ terminé.** Toutes les routes à décision de
> `api/investor/**` sont migrées vers `services/investor/**` (diligence,
> campagnes, pipeline, relations, évaluation, décisions, organisations, liste de
> suivi, préférences, réunions, tableau de bord, agrégateurs, mot de passe).
> `register` est un 410 sans décision ; `profile` (lecture « soi ») et
> `diligence/documents`, `approval`, `ventures`, `kpis`, `updates`,
> `venture-kpis` (lectures/écritures sans décision) restent au contrôleur.
> Tests 255 suites / 3775 ✅ (dont `investor-portal.test.js`), lint 0 erreur,
> build ✅.
| LMS & paiement — **inscription publique** | ✅ fait | Décisions de `api/public/register/route.js` (résolution du groupe avec repli familles → v2_groups, règle « un e-mail existant n'est pas une preuve de propriété — jamais réécrire les identifiants d'un compte », garde de conflit facilitateur/participant dans le même programme, synchronisation de la table d'adhésion canonique) et de `api/public/group-info/route.js` (résolution du groupe + fenêtre d'inscription) déplacées dans `services/lms/publicRegistration.js`. Routes amaigries (la présence des champs et la longueur du mot de passe restent au contrôleur, qui valide). Test ajouté (`src/__tests__/lms-public-registration.test.js`) ; le garde-fou statique `security-p0-regressions.test.js` pointe désormais le service. |
| LMS & paiement — **règlement partagé** | ✅ fait | La décision « régler un paiement VÉRIFIÉ » (contrôle du montant vs prix décidé côté serveur, passage en payé, octroi de l'accès, envoi du reçu, journalisation), dupliquée dans `api/webhooks/kkiapay/route.js` et `api/public/checkout/route.js` (action `verify`), est désormais dans `services/lms/checkout.js` (`settleVerifiedPayment`), appelée par les deux. Les journaux restent identiques : les valeurs `event` (webhook) vs `verified` (checkout) sont passées en paramètre, donc le SQL et les écritures sont inchangés. Le test end-to-end `src/__tests__/lms-checkout.test.js` reste vert. |
| LMS & paiement — **réconciliation** | ✅ fait | `lib/lms/checkoutReconcile.js` (module de DÉCISION logé dans `lib/`) déplacé vers `services/lms/checkoutReconcile.js` ; `lib/lms/checkoutReconcile.js` devient une simple façade, donc aucun importateur ne change (dont `src/__tests__/lms-checkout-reconcile-cron.test.js`, qui mocke ce chemin lib). Tests 253 suites / 3689 ✅, lint 0 erreur, build ✅. |

| LMS & paiement — **socle de règlement partagé** | ✅ fait | La règle de règlement d'un paiement vérifié (contrôle du montant, passage à « payé », octroi de l'accès, envoi du reçu, journalisation) était écrite **deux fois** — dans la vérification du payeur (`api/public/checkout`) et dans la notification Kkiapay (`api/webhooks/kkiapay`). Elle vit maintenant à un seul endroit : `services/lms/checkout.js` → `settleVerifiedPayment(...)`. Les deux contrôleurs n'ont plus que l'authentification et l'enveloppe ; les valeurs journalistées restent celles que le fournisseur a réellement rapportées, donc la piste d'audit est identique. Le filet de comportement est le test d'intégration existant `lms-checkout.test.js`, qui fait passer les deux chemins par le socle partagé (montant falsifié refusé et journalisé, reçu envoyé même quand l'accès échoue). |
| LMS & paiement — **balayage de réconciliation** | ✅ fait | `lib/lms/checkoutReconcile.js` — le filet de sécurité qui rejoue une étape d'accès échouée et revérifie un succès non confirmé — est passé en `services/lms/checkoutReconcile.js`. La façade `lib/lms/checkoutReconcile` est conservée : ses deux importateurs (`api/lms/registrations`, `api/lms/checkout-reconcile`) et le test du cron résolvent inchangés. |
| E-mail — **webhook Resend** | ✅ fait | Décisions de `api/webhooks/resend/route.js` (vérification de signature Svix à temps constant et multi-candidats pour la rotation, fenêtre de fraîcheur anti-rejeu, table événement → statut, append au journal) déplacées dans `services/email/resendWebhook.js` (`processResendWebhook`, `verifySvixSignature`). Route amaigrie. Test ajouté (`src/__tests__/email-resend-webhook.test.js`) ; le garde-fou `security-lot6-hardening.test.js` pointe désormais le service. Tests 258 suites / 3803 ✅, lint 0 erreur, build ✅. |
| LMS & paiement — **notification Kkiapay** | ✅ fait | La machine à états de `api/webhooks/kkiapay/route.js` (référence inconnue journalisée mais jamais créée, doublon sur une inscription déjà payée, échec explicite, sinon vérification côté serveur puis règlement partagé) déplacée dans `services/lms/checkoutWebhook.js` (`processPaymentNotification`, qui renvoie une issue discriminée). Le contrôleur garde `initDb`, le fournisseur, la vérification de signature, le parsing et l'enveloppe. Test ajouté (`src/__tests__/lms-payment-notification.test.js`) ; le test end-to-end `lms-checkout.test.js` (34 cas) reste vert. |

> **Point 4 : décisions migrées.** Ce qui reste (`api/lms/registrations`
> dispatch, `api/gmail-v1-test`, `api/integrations/**`,
> `api/public/course-match`, `api/webhooks/route.js`) a été **évalué** : aucune
> décision métier à déplacer (aiguillage ou délégation).

| CH-1 — **V15** (scores plateforme) | ✅ fait | `src/app/admin/platform/scores/page.js` (894 l.) découpée : composants présentationnels dans `src/components/admin/platform-scores/` (`ScoresHeader`, `ScoresControls`, `ScoresStats`, `ScoresFilters`, `BulkActionBar`, `RespondentsTable`, `BulkConfirmModal`, `statusConfig`). L'état, les chargements, les mémoïses, l'export CSV et les actions restent dans la page ; rendu inchangé. Tests 258 suites / 3803 ✅, lint 0 erreur, build ✅. |
| CH-1 — **V12** (relations investisseurs, admin) | ✅ fait | `src/app/admin/investors/relationships/page.js` (947 l.) découpée : composants dans `src/components/admin/investor-relationships/` (`RelationshipsToast`, `RelationshipsHeader`, `WorkspaceSummaryCard`, `DetailTabs`, `MeetingsPanel`, `DiligencePanel`, `WorkspaceListView`, `CreateMeetingModal`, `CompleteMeetingModal`, `AddDdRequestModal`, `constants`). Toutes les lectures, l'état et les actions restent dans la page ; rendu inchangé. Tests 258 suites / 3803 ✅, lint 0 erreur, build ✅. |
| CH-1 — **V11** (tableau de bord investisseur) | ✅ fait | `src/app/investor/dashboard/page.js` (948 l.) découpée : composants dans `src/components/investor/dashboard-page/` (`DashboardStats`, `DashboardTabs`, `CampaignsSection`, `UpcomingMeetingsSection`, `VentureFilters`, `VentureGrid`, `PipelineTab`, `WatchlistTab`, `IntroRequestModal`, `VentureDetailModal`, `ComparisonBar`, `ComparisonModal`, `ProfileGate`, `constants`). Les lectures (`useApi`), l'état, les actions et l'export restent dans la page ; rendu inchangé. Tests 258 suites / 3803 ✅, lint 0 erreur, build ✅. |
| CH-1 — **V14** (projets staff) | ✅ fait | `src/app/staff/projects/[id]/page.js` (900 l.) découpée : composants dans `src/components/staff/project-detail/` (`ProjectHeader`, `ProjectStats`, `ProjectTabs`, `OverviewTab`, `BlockersTab`, `TeamTab`, `UpdatesTab`, `DiscussionsTab`, `TimelineTab`, `constants`). Les lectures (`useApi`, `useSessionUser`), l'état, les filtres, les formulaires et les actions (`handlePostDiscussion`, `handleSubmitUpdate`) restent dans la page, ainsi que l'onglet tâches (câblage de `TaskManager`) ; rendu inchangé. Lint 0 erreur, build ✅. |
| CH-2 — **B11** (PeopleView + ProgramScopePanel) | ✅ fait | `src/components/permissions/PeopleView.js` (921 → 425 l.) et `.../ProgramScopePanel.js` (695 → 244 l.) découpés : blocs présentationnels dans `src/components/permissions/people-view/` (`SourceGlyph`, `PeopleContextsCard`, `WhyDrawerBody`, `PeopleMatrix`) et `src/components/permissions/program-scope-panel/` (`notify`, `labels`, `Stat`, `ScopeSummaryStats`, `UnmanagedWorklist`, `HoldersPanel`, `TemplateSplitPanel`, `AssignManagerModal`). Les lectures, l'état, les gardes de course (`createLatestGuard`), le repli sur changement de personne, les écritures et la porte de risque restent dans les deux panneaux ; rendu inchangé. Les contrats statiques `ui2-people`, `ui3-craft`, `ui3-followups`, `ui3-responsive`, `ui4-contexts`, `ui7-access-clarity` ont été repointés vers les nouveaux fichiers (mêmes assertions). Tests 258 suites / 3803 ✅, lint 0 erreur, build ✅. |

> **CH-1 / CH-2 (vues et composants réservés) : en cours.** Côté vues, **V15**,
> **V12**, **V11** et **V14** sont faites ; côté composants, **B4, B5, B8, B9,
> B11, B12** et **B13** sont faits. Restent les vues V1, V3, V4, V5, V7, V9, V10,
> V17 et le composant B3.

---

## 5. Qui possède quel dossier de route (garantie anti-conflit)

C'est la carte de propriété. Elle est **exhaustive** : chaque dossier de route de
l'API appartient à **exactement une** partie. Ce qui n'est pas listé pour un
stagiaire est au lead.

| Stagiaire | Dossiers de routes qu'il possède |
|---|---|
| 1 — Plateforme | `platform`, `forms`, `s`, `intents`, `evaluation`, `respond`, `responses`, `run-export` |
| 2 — Ventures | `ventures`, tous les `venture-*`, `journey-reports`, `journey-templates`, `knowledge` |
| 3 — Programmes | `programs`, `program-staff`, `program-types`, `participant-programs`, `pm`, `v2` |
| 4 — Permissions | `access-profiles`, `security`, `engineering`, `org-membership`, `responsibilities` |
| 5 — CRM | `contacts`, `people`, `families`, `groups`, `user-groups`, `group-members`, `segments`, `contact-emails` |
| 6 — Opérations | `tasks`, `blockers`, `standups`, `retros`, `projects`, `team-tasks` |
| 7 — Messagerie | `campaigns`, `internal-comms`, `announcements`, `followups`, `events`, `notifications` |
| **Lead** | **tous les autres** |

**Deux exceptions explicites (routes à cheval) :**

- `src/app/api/participant/programs/**` → **stagiaire 3** (c'est du programme,
  pas du portail participant). Le **reste** de `src/app/api/participant/**`
  reste au lead.
- Les **routes agrégatrices** (rapports, tableaux de bord) qui lisent
  plusieurs domaines à la fois — `api/op-reports/**`, `api/dashboard/**`,
  `api/activity/**`, `api/kpis/**`, `api/kpi-progress/**` — restent au lead et
  ne sont travaillées **qu'après** la fin des couloirs qu'elles agrègent.

### Propriété des fichiers de données (« modèles »)

Le découpage d'un service entraîne souvent la découpe du fichier de données
associé. Chaque domaine est donc propriétaire **aussi** de ses modèles :

| Stagiaire | Modèles qu'il possède (motifs) |
|---|---|
| 1 — Plateforme | `models/platform/**`, `models/platform*.js`, `models/forms.js`, `models/formRuns.js`, `models/formRunListStore.js`, `models/publicFormRuns.js`, `models/intents.js` |
| 2 — Ventures | `models/venture*` (y compris tous les `venture*Store.js`) |
| 3 — Programmes | `models/programs.js`, `models/programMembership.js`, `models/programWorkspace.js`, `models/program-history.js`, `models/curriculum.js` |
| 4 — Permissions | `models/authorization.js`, `models/authorization/**`, `models/accessProfilesStore.js`, `models/responsibilities.js` |
| 5 — CRM | `models/contact*.js`, `models/groups.js`, `models/invitations.js` |
| 6 — Opérations | `models/task*.js`, `models/blockers.js`, `models/standups.js`, `models/standupUpsert.js`, `models/retros.js`, `models/projects.js`, `models/projectCollaboration.js` |
| 7 — Messagerie | `models/communications.js`, `models/messageScopeStore.js` |
| **Lead** | **tous les autres** (ex. `models/teams.js`, `models/participant-membership.js`, `models/kpi-progress.js`, `models/kpiProgressStore.js`, `models/participantSyncStore.js`, `models/investor*.js`, `models/finance*`, `models/lms/**`, `models/workspace*`, …) |

> **Règle d'arbitrage :** si un fichier de modèle est utilisé **aussi** par une
> route qui n'est pas dans ton périmètre, il revient au **lead**. Tu le signales,
> tu ne l'édites pas.

### Vérifier soi-même qu'on n'empiète sur personne

```sh
# 1) la liste des dossiers de route de mon périmètre
ls -d src/app/api/<mes-dossiers>/*/ 2>/dev/null

# 2) aucun de mes fichiers n'apparaît dans une autre fiche (contrôle manuel)
grep -rln "mon-fichier" docs/REPARTITION_STAGIAIRES.md
```

---

## 6. Points de coordination (les rares cas)

| Cas | Qui décide | Règle |
|---|---|---|
| Une route de mon périmètre importe un domaine d'un autre stagiaire | Le lead | La route reste **à moi** ; je touche seulement sa partie « que faire », pas le service de l'autre |
| J'ai besoin d'un changement dans le fichier d'un autre | Le lead | J'écris une note ; je n'édite pas |
| Une vue et un composant semblent devoir changer ensemble | Le lead | Le composant garde son export public : la vue n'a rien à changer |
| Un dossier de route absent des listes | Le lead | Il est au lead par défaut |

**Règle finale :** en cas de doute sur la propriété d'un fichier, **on ne
l'édite pas** avant d'avoir la réponse du lead. Un fichier dormant coûte moins
cher qu'un conflit.
