# Inventaire — Famille « dettes » : sécurité, droits retirés, identités héritées

**Périmètre** : lecture seule du dépôt `ImpactOs` (branche courante), code de
production sous `src/**` et documentation sous `docs/**`.
**Sources principales** : `docs/SECURITY_AUDIT_REGISTER.md` (registre des
vulnérabilités, section « 3. OPEN — residual register » + section « 8.
Concurrent hardening ») et `docs/AUTHZ_CURRENT_STATE.md` (sections 6 et 9).

**Méthode** : chaque item « OPEN » du registre a été confronté au code. Toute
affirmation porte un `fichier:ligne` et un extrait exact. Aucune valeur de base
de données n'a été inventée : les limites de lecture sont explicitées.

## Légende des statuts

| Statut | Sens |
|---|---|
| **FAIT CONFIRMÉ — OUVERT** | Le défaut décrit est toujours présent dans le code. |
| **FAIT CONFIRMÉ — CORRIGÉ** | Le code montre que le défaut est fermé / migré. |
| **PARTIEL** | Une partie est fermée, une partie subsiste (tracée). |
| **INDÉTERMINABLE depuis le code** | Non vérifiable sans base / réseau / `npm audit`. |

> **Avertissement sur le registre** : `SECURITY_AUDIT_REGISTER.md` est
> **contradictoire avec lui-même**. Sa section « 3. OPEN » (§3.2/§3.3) date de
> l'audit initial, tandis que sa section « 8. Concurrent hardening » ajoute les
> corrections du « Lot 15 ». Plusieurs items y sont donc listés **OPEN** en §3.2
> alors que §8 les déclare **FIXED — Lot 15** (PUB-2, PUB-3, CSRF-1, AUTH-4,
> AUTHZ-GLOBAL-1, AUTHZ-CRM-1, SECRET-3). Le présent inventaire tranche **par le
> code**, pas par le libellé.

---

## 1. Points de sécurité ouverts

### 1.1 Vue d'ensemble — tous les items marqués OPEN

| ID (§3) | Catégorie | Localisation (registre) | Statut vérifié dans le code |
|---|---|---|---|
| LOGIC-INV-1 | Business logic | `investor/pipeline` | **FAIT CONFIRMÉ — OUVERT** |
| PUB-3 | Business logic | `respond` | **FAIT CONFIRMÉ — CORRIGÉ** (Lot 15) |
| UPLOAD-1 | Upload / buckets | `upload`, `profile/photo`, `lms/*` | **FAIT CONFIRMÉ — OUVERT** (buckets publics) |
| BOLA-FORM-1 | BOLA | `run-export`, `platform/form-runs*`, `ai/evaluation-scores` | **FAIT CONFIRMÉ — OUVERT** (décision de gouvernance) |
| CSRF-1 | CSRF / GET mutant | `engineering/permissions/*`, `program-types` | **FAIT CONFIRMÉ — CORRIGÉ** (Lot 15 + SYS-2) |
| DEP-1 | Dépendances | `npm audit` (`unpdf → canvas`) | **INDÉTERMINABLE depuis le code** |
| RATE-2 | Rate limiting | `s/public-submit`, `courses`, `errors`, uploads, AI | **PARTIEL** (throttle présent, périmètre incomplet) |
| ERR-1 | Error handling | « many routes » | **PARTIEL** (`error.message` en 500 subsiste) |
| AUTH-4 | Énumération | `auth/login`, `auth/reset-password` | **PARTIEL** (corrigé, sauf 403 distincts + `session-login`) |
| SECRET-1 | Mots de passe | `auth/login`, `session-login`, équipes/groupes | **FAIT CONFIRMÉ — OUVERT** |
| SECRET-3 | Mots de passe équipe | `teams`, `pm/teams` | **PARTIEL** (génération corrigée, stockage clair subsiste) |
| AUTHZ-GLOBAL-1 | Scope catalogues globaux | `ventures/[id]/knowledge`, `ventures/[id]/coaches` | **FAIT CONFIRMÉ — CORRIGÉ** (Lot 15) |
| PUB-2 | Business logic | `s/public-draft` | **FAIT CONFIRMÉ — CORRIGÉ** (jeton) |
| AUTHZ-CRM-1 | Scope | `notifications`, `contact-emails`, `team-tasks` | **PARTIEL / CORRIGÉ** (`contact-emails`, `notifications`) |
| MVC-1 | Layering | SQL inline dans les routes | **INDÉTERMINABLE depuis ce passage** (champ continu) |
| DATA-1 | Exposition | `SELECT *` (`families`/`v2_teams`/`contacts`/`dd_documents`) | **PARTIEL** (traitement partiel, non clos) |

### 1.2 Catégorie A — mots de passe stockés / comparés en clair

**Statut : FAIT CONFIRMÉ — OUVERT.**

Le repli de comparaison en clair est toujours présent sur les chemins
d'authentification. Le helper central ne fait que du bcrypt
(`src/server/auth/password.js:19-25` : `bcrypt.hash` / `bcrypt.compare`) ; c'est
chaque route qui réintroduit la comparaison directe.

| # | Preuve `fichier:ligne` | Extrait exact | Rôle |
|---|---|---|---|
| A1 | `src/app/api/auth/login/route.js:146-153` | `const isHashed = user.password && user.password.startsWith("$2");` … `} else {` `isMatch = cleanPassword === user.password;` | Comparaison en clair de repli |
| A2 | `src/app/api/auth/session-login/route.js:114-121` | `const isHashed = user.password && user.password.startsWith("$2");` … `} else {` `isMatch = cleanPassword === user.password;` | Idem (route sœur) |
| A3 | `src/app/api/auth/reset-password/route.js:58-61` | `const isHashed = user.password && user.password.startsWith('$2');` `isMatch = isHashed ? await verifyPassword(...) : (currentPassword === user.password);` | Idem (reset) |
| A4 | `src/app/api/auth/login/route.js:109` et `:112` | `if (password === family.shared_password_edit)` / `else if (password === family.shared_password_read)` | Mot de passe partagé de « famille » comparé en clair |
| A5 | `src/app/api/auth/session-login/route.js:87` et `:91` | `if (cleanPassword === family.shared_password_edit)` / `else if (cleanPassword === family.shared_password_read)` | Idem |
| A6 | `src/models/groups/orgTeams.js:60-70` | `INSERT INTO v2_teams (…, password, team_username) VALUES (…, password, …)` | Mot de passe d'équipe **stocké en clair** |
| A7 | `src/app/api/teams/route.js:128-136` | `createOrgTeam(teamId, program_id, name, handler_id, handler_name, generatedPassword, generatedUsername)` | Idem, valeur transmise en clair |

**Lien SECRET-3 (génération vs stockage)** : la *génération* du mot de passe
d'équipe est bien cryptographique — `src/lib/teamCredentials.js:41-43`
(`FST${randomCredentialToken(8)}`, `randomBytes`) — donc la partie « génération »
est **CORRIGÉE**. Le *stockage en clair* subsiste (A6/A7) et est documenté comme
volontaire (l'écran doit afficher ces identifiants, cf. registre §6.4).

> Aucun mot de passe en clair n'a été lu : seules les écritures/lectures de code
> sont attestées. L'existence effective de mots de passe en clair **en base** est
> hors de portée du code (voir « Incertitudes »).

### 1.3 Catégorie B — stockage public (buckets) sans lien signé

**Statut : FAIT CONFIRMÉ — OUVERT.**

| # | Preuve `fichier:ligne` | Extrait exact | Bucket |
|---|---|---|---|
| B1 | `src/app/api/upload/route.js:117` | `await supabase.storage.createBucket("submissions", { public: true });` | `submissions` (public) |
| B2 | `src/app/api/upload/route.js:126-128` et `:142-144` | `const publicUrl = supabase.storage.from("submissions").getPublicUrl(fileName).data.publicUrl;` | URL publique permanente |
| B3 | `src/app/api/profile/photo/route.js:90-92` | `const publicUrl = supabase.storage.from("profile-photos").getPublicUrl(fileName).data.publicUrl;` | `profile-photos` |
| B4 | `src/app/api/lms/courses/thumbnail/route.js:76-78` | `const publicUrl = supabase.storage.from("course-thumbnails").getPublicUrl(fileName).data.publicUrl;` | `course-thumbnails` |

**Contre-exemple (partiel / corrigé ailleurs)** : le module des ressources de
section LMS signe bien les liens côté apprenant
(`src/models/lms/sectionResources.js` — signé via `createSignedUrl`, verrouillé
par `src/__tests__/lms-section-resource-learner-files.test.js`). Les trois
routes ci-dessus, elles, émettent toujours une URL publique.

### 1.4 Catégorie C — routes de lecture (GET) ayant des effets de bord (écriture)

**Statut : FAIT CONFIRMÉ — CORRIGÉ** (les GET « mutants » subsistent mais sont
désormais protégés par un contrôle same-origin, `CSRF-1` / Lot 15).

| # | Preuve `fichier:ligne` | Extrait exact | Effet de bord |
|---|---|---|---|
| C1 | `src/app/api/engineering/permissions/seed/route.js:12-20` | `export async function GET(req) {` `const originError = requireSameOrigin(req);` … `await seedDefaultRoleCapabilities();` | Seed sur GET (écriture) — garde same-origin |
| C2 | `src/app/api/engineering/permissions/sync-context-grants/route.js:33-41` | `requireSameOrigin(req);` … `await syncAllContextGrantsEverywhere();` | Réconciliation sur GET — garde same-origin |
| C3 | `src/app/api/engineering/permissions/context-roles/route.js:38-46` | `requireSameOrigin(req);` … `const seeded = await seedContextRoleProfiles();` | Seed sur GET — garde same-origin |
| C4 | `src/lib/requestOrigin.js:41-88` | `export function isSameOriginRequest(req)` … `return site === "same-origin" \|\| site === "none";` | Mécanisme de défense |
| C5 | `src/app/api/program-types/route.js:15-27` | `export async function GET() {` … `// A GET must not run DDL.` `const result = await listProgramTypeKeys();` | `SYS-2` : le DDL est passé au POST (`:34` `createProgramTypeOptionsTable()`) |

Autres GET mutants protégés de la même façon (vérifiés) :
`engineering/permissions/{profiles,profile-assignments,profile-role-defaults,legacy-role-cleanup}` et
`src/app/api/platform/seed/founder-assessment/route.js:33-40`
(`GET` → `POST()` après `requireSameOrigin`).

> Reste conceptuel : ce sont toujours des GET qui écrivent ou amorcent une
> écriture. La correction ferme le vecteur CSRF (navigation cross-site), elle ne
> change pas la forme de l'API (le code le documente explicitement,
> `seed/route.js:8-11`).

### 1.5 Catégorie D — fuite d'existence de compte (réponses / temps différents)

**Statut : PARTIEL.**

| # | Preuve `fichier:ligne` | Extrait exact | Effet |
|---|---|---|---|
| D1 | `src/app/api/auth/login/route.js:30` | `const INVALID_CREDENTIALS = "Invalid credentials or unauthorized access.";` | Message unique (compte connu/inconnu) — **corrigé** |
| D2 | `src/app/api/auth/login/route.js:33-34` + `:123` | `const TIMING_EQUALIZER_HASH = "$2b$10$…"` … `await verifyPassword(cleanPassword, TIMING_EQUALIZER_HASH);` | Coût bcrypt payé sur compte inconnu — **corrigé** |
| D3 | `src/app/api/auth/reset-password/route.js:11-15` + `:62-68` | `const TIMING_EQUALIZER_HASH = …` … `await verifyPassword(currentPassword, TIMING_EQUALIZER_HASH);` … `return NextResponse.json({ success: false, error: 'Invalid credentials.' }, { status: 401 });` | Réponse identique 404→401 — **corrigé** |
| D4 | `src/app/api/auth/login/route.js:177-261` | `if (user.status === "inactive") { … error: "Access Denied: Your account is inactive.", status: 403 }` … `pending` … `archived` | **Subsiste** : 403 distincts (décision UX) |
| D5 | `src/app/api/auth/session-login/route.js:99-110` | `if (!user) { await auditLoginAttempt(…); return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 401 }); }` | **Découverte inattendue** : route sœur sans *timing equalizer* (pas de bcrypt sur compte inconnu) |
| D6 | `src/app/api/auth/session-login/route.js:140-193` | `if (user.status === "pending") { … status: 403 }` / `inactive`/`suspended` | 403 distincts subsistants |

> `AUTH-4` du registre ne cite que `auth/login` et `auth/reset-password` : ces
> deux-là sont corrigés (D1–D3). Le reste (D4) est la décision UX annoncée.
> **D5/D6 sont une découverte inattendue** : `auth/session-login`, route sœur non
> citée par le registre, n'a pas reçu le même durcissement d'énumération.

### 1.6 Catégorie E — domaine « formulaires / exécutions » sans rattachement à un programme

**Statut : FAIT CONFIRMÉ — OUVERT** (décision de gouvernance, cf. registre §6.7).

Le domaine des « Runs » (`platform_form_runs`) est global : il n'a **aucune
dimension locataire / programme**, et la seule frontière est la capacité
`runs.view` / `runs.edit` / `reports.export`.

| # | Preuve `fichier:ligne` | Extrait exact | Données exposées |
|---|---|---|---|
| E1 | `src/app/api/run-export/route.js:47-48` | `const capError = await requireAuthorization("reports", "export");` | Export de **n'importe quel** run |
| E2 | `src/app/api/run-export/route.js:59-65` + `:88` | `const runResult = await getRunWithFormName(parseInt(runId));` … `submissionRow.submitter_name \|\| "—"` | PII du répondant (nom) sans rattachement programme |
| E3 | `src/app/api/platform/form-runs/report-file/route.js:50-63` | `const capError = await requireAuthorization("runs", "view");` … `const runId = parseInt(searchParams.get("run_id"));` | Fichier de rapport d'un run arbitraire |
| E4 | `src/app/api/platform/form-runs/handlers/get.js:94-95` | `const authError = await requireAuthorization("runs", "view");` | Garde unique avant les branches ci-dessous |
| E5 | `src/app/api/platform/form-runs/handlers/get.js:47-72` | `if (submissionId) { … const submissionResult = await getSubmissionById(submissionId);` | `submission_id` : lit une soumission arbitraire (hors anonymat) |
| E6 | `src/app/api/platform/form-runs/handlers/get.js:98-101` | `if (timeline) { const entries = await getTimelineBySubmissionId(timeline);` | `timeline` : lit la vie d'une soumission arbitraire |
| E7 | `src/app/api/platform/form-runs/handlers/get.js:142-179` | `if (searchParams.has("scoring")) { const submissionId = parseInt(searchParams.get("scoring"));` | `scoring` : scores + `submission_data` d'une soumission arbitraire |
| E8 | `src/app/api/platform/form-runs/handlers/get.js:188-191` | `if (searchParams.get("responses") === "true") { const submissionsResult = await listSubmissionsForOpenRuns();` | Toutes les soumissions des runs ouverts |
| E9 | `src/app/api/platform/ai/evaluation-scores/route.js:34-45` | `const capError = await requireAuthorization("runs", "view");` … `getEvaluationScoreboard({ runIdParam: searchParams.get("run_id"), … })` | Tableau de scores + PII des répondants |

**Partie corrigée (Lot 13)** — la lecture `submitter_id` est bien liée à la
session : `src/app/api/platform/form-runs/handlers/get.js:209-216`
(`const targetSubmitter = session.role === "super_admin" ? submitterId : session.cid;`).
Le reste (E1–E9) reste **OUVERT** faute de dimension programme.

### 1.7 Items OPEN hors catégories exigées (vérifiés)

| ID | Preuve `fichier:ligne` | Extrait exact | Statut |
|---|---|---|---|
| LOGIC-INV-1 | `src/services/investor/pipeline.js:152-160` | `if (newStage === "invested") { … await createInvestmentDecision({ pipeline_id: pipelineId, investment_amount: investedAmount, notes });` | **OUVERT** — le client pose `stage:"invested"` + `amount`, sans confirmation staff |
| PUB-3 | `src/services/platformRespond.js:12-19` + `:53-96` | `The attribution is therefore resolved SERVER-SIDE, from the identity the respondent actually typed` … `resolvedCid = emailMatch.rows[0].cid;` | **CORRIGÉ** |
| PUB-2 | `src/app/api/s/public-draft/route.js:63-73` + `:128-137` | `if (!storedToken \|\| String(token \|\| "") !== String(storedToken)) {` … `return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });` | **CORRIGÉ** (jeton) |
| AUTHZ-GLOBAL-1 | `src/app/api/ventures/[id]/knowledge/route.js:87,102,109` | `await requireAuthorization("knowledge", "create")` / `"edit"` / `"delete"` | **CORRIGÉ** |
| AUTHZ-GLOBAL-1 | `src/app/api/ventures/[id]/coaches/route.js:67,102,117` | `const capError = await requireAuthorization("ventures", "edit");` | **CORRIGÉ** |
| AUTHZ-CRM-1 | `src/app/api/contact-emails/route.js:29-35` | `if (await canManageContactEmails(session, targetCid)) return null;` | **CORRIGÉ** |
| AUTHZ-CRM-1 | `src/app/api/notifications/route.js:28-29` + `src/services/communications/inboxNotifications.js:121-130` | `const outcome = await publishInboxNotification({…});` … `if (!canCreateNotificationFor(session, recipient_id)) { return { denied: { … status: 403 } }; }` | **CORRIGÉ** au niveau contrôleur/service |
| ERR-1 | `src/app/api/upload/route.js:150` ; `src/app/api/investor/pipeline/route.js:34` ; `src/app/api/admin/analytics/route.js:27` | `{ success: false, error: error.message }` (status 500) | **PARTIEL** — fuite de `error.message` subsiste hors surfaces balayées (Lot 14) |
| RATE-2 | `src/app/api/auth/login/route.js:42-49` (throttle présent) ; `src/app/api/upload/route.js` (aucun throttle) | `const ipLimited = enforceRateLimit(req, …)` ; aucune occurrence dans `upload/route.js` | **PARTIEL** — uploads/AI non throttlés |
| DEP-1 | `ImpactOs/package.json:105` | `"unpdf": "^0.12.2"` | **INDÉTERMINABLE** sans `npm audit` (réseau) |

---

## 2. Droits retirés (`lms.assign`, `lms.enroll`, `lms.publish`)

**Recherche** : `lms.assign|lms.enroll|lms.publish` sur l'ensemble du dépôt.

**Résultat : 0 site d'application et 0 source d'octroi dans `src/**`.**

Les seules occurrences sous `src/**` sont des **clés de traduction i18n** de
l'espace `lms.enroll.*` — ce ne sont **pas** des capacités (aucun appel
`requireAuthorization("lms", "assign"|"enroll"|"publish")`) :

| # | Fichier:ligne | Extrait exact | Nature |
|---|---|---|---|
| R1 | `src/components/lms/CourseEditor.js:292` | `{t("lms.enroll.title")}` | Libellé i18n — ni application ni octroi |
| R2 | `src/components/lms/EnrollModal.js:20` | `{ list: [], failure: data?.error \|\| "lms.enroll.loadFailed" }` | Libellé i18n |
| R3 | `src/components/lms/EnrollModal.js:69,71,73,76,84,96,107` | `"lms.enroll.userNotFound"` / `"lms.enroll.enrolled"` / `t("lms.enroll.title")` / `t("lms.enroll.emailOrCid")` … | Libellés i18n |

**Sites d'application actuels (migrés vers `lms.edit`)** — donc plus aucune
référence retirée :

| # | Fichier:ligne | Extrait exact | Capacité |
|---|---|---|---|
| R4 | `src/app/api/lms/enrollments/route.js:17-22` | `// Admin enrollment is course management (lms.edit).` `const capError = await requireAuthorization("lms", "edit");` | `lms.edit` |
| R5 | `src/app/api/lms/courses/[id]/enrollments/route.js:14-19` | `// Learner rosters are course management (lms.edit).` `const capError = await requireAuthorization("lms", "edit");` | `lms.edit` |
| R6 | `src/app/api/lms/courses/[id]/publish/route.js:15-20` | `// Course lifecycle (publish/unpublish) is course management (lms.edit).` `const capError = await requireAuthorization("lms", "edit");` | `lms.edit` |
| R7 | `src/app/api/lms/program-requirements/route.js` (balayé par `scripts/phase3-lms-retired-scan.mjs`) | Inventaire verrouillé par le scan | `lms.edit` |

**Source de retrait (pas d'octroi)** — l'unique mécanisme qui touche ces clés
est une **suppression** :

| # | Fichier:ligne | Extrait exact | Nature |
|---|---|---|---|
| R8 | `src/models/authorization/backfill/policies.js:35-38` | `sql: \`DELETE FROM ${table} WHERE module = ? AND capability IN (${placeholders})\`,` `args: ["lms", ...retired],` | Retrait des octrois retirés |

**Sources d'octroi `lms.*` restantes** (aucune ne concerne les clés retirées) :

| # | Fichier:ligne | Extrait exact | Capacité octroyée |
|---|---|---|---|
| R9 | `src/models/authorization/profileCatalogueSeed.js:65-69` | `{ key: "learner", … capabilities: { lms: { view: 1 } } }` | `lms.view` (Learner) |
| R10 | `src/models/authorization/backfill/policies.js:54-61` | `"Program Manager": [["lms", "view", 1]]` / `program_manager: [["lms", "view", 1]]` | `lms.view` (PM) |

> Conséquence conforme au registre (`AUTHZ_CURRENT_STATE.md` §9, décision D1) :
> **personne ne détient `lms.edit`** par défaut, donc seul un Super Admin peut
> publier/enrôler/attacher tant que D1 n'est pas tranchée.

---

## 3. Identités héritées (valeurs de rôle « contextuelles » ou retirées)

> **Limite explicite et non négociable** : il est **IMPOSSIBLE de lire les valeurs
> réellement présentes en base depuis le code**. Le code montre seulement les
> endroits qui **écrivent** ou **lisent** une valeur *comme un rôle*. Aucune
> conclusion n'est tirée sur ce que contiennent réellement `contacts.role`,
> `venture_members.member_type`, `v2_program_staff.role`, etc. La liste ci-dessous
> est donc une liste de **sites d'écriture/lecture**, pas un inventaire de données.

### 3.1 Constantes et résolveurs de rôle (code partagé)

| # | Fichier:ligne | Extrait exact | Constat |
|---|---|---|---|
| I1 | `src/models/platform/roles.js:11` | `export const DEFAULT_ROLE = "participant";` | `participant` = rôle par défaut |
| I2 | `src/models/platform/roles.js:13-20` | `export const PRIVILEGED_ROLES = new Set([` `"investor",` `"founder",` `"mentor",` `]);` | `mentor` (contextuel) et `founder`/`investor` listés **comme rôles privilégiés** |
| I3 | `src/models/platform/roles.js:79-89` | `if (normalizedRole === "investor") return "investor";` `if (normalizedRole === "founder") return "founder";` | Valeurs utilisées comme rôle effectif |
| I4 | `src/models/platform/roles.js:90-94` | `if (normalizedRole === "staff" \|\| normalizedRole === "program_manager" \|\| normalizedRole === "project_manager") return "staff";` | `program_manager` traité comme rôle |

### 3.2 Résolution de rôle aux points d'entrée (auth)

| # | Fichier:ligne | Extrait exact | Constat |
|---|---|---|---|
| I5 | `src/app/api/auth/session-login/route.js:205-231` | `if (user.role === "super_admin" …)` `} else if (user.role === "investor") {` `finalRole = "investor";` `} else if (user.role === "founder") {` `finalRole = "founder";` `} else if (user.role === "program_manager") {` … `else if (user.role === "participant") { finalRole = "participant"; }` | `investor`, `founder`, `program_manager`, `participant` lus comme rôles |
| I6 | `src/app/api/auth/session-login/route.js:298` | `role: "participant",` (bloc `isFamilyLogin`) | Rôle écrit pour l'entité famille |
| I7 | `src/app/api/auth/login/route.js:324` | `role: "participant",` (bloc `isFamilyLogin`) | Idem |
| I8 | `src/app/api/auth/login/route.js:330` | `role: finalRole,` | Rôle effectif propagé |

### 3.3 Contrôles `session.role === "…"` dans les routes

| # | Fichier:ligne | Extrait exact | Constat |
|---|---|---|---|
| I9 | `src/app/api/contacts/[cid]/emails/route.js:29` | `if ((session.role === "participant" \|\| session.role === "founder") && session.cid !== cid)` | `participant`/`founder` branchés comme rôles de session |

### 3.4 Écriture/lecture de rôles « contextuels » dans les modèles

| # | Fichier:ligne | Extrait exact | Constat |
|---|---|---|---|
| I10 | `src/models/authorization/contactContexts.js:85` | `roles[key] = owner ? "founder" : row.member_type \|\| "team_member";` | Écrit `founder` / `team_member` comme rôle de contexte |
| I11 | `src/models/authorization/contactContexts.js:115` | `for (const row of participantResult.rows) roles[String(row.id)] = "participant";` | Écrit `participant` comme rôle de contexte |
| I12 | `src/models/authorization/contextRoleProfiles.js:47-52` | `{ context: "program", role_key: "participant", … }` | `participant` comme clé de rôle contextuel |
| I13 | `src/models/authorization/contextRoleProfiles.js:53-59` | `{ context: "program", role_key: "program_manager", … }` | `program_manager` comme clé de rôle contextuel |
| I14 | `src/models/authorization/contextRoleProfiles.js:88-94` | `{ context: "venture", role_key: "venture_manager", … }` | `venture_manager` comme clé de rôle contextuel |
| I15 | `src/models/authorization/contextRoleProfiles.js:95-100` | `{ context: "investor", role_key: "investor", profile_name: "Mentor", … }` | `investor` / `Mentor` |
| I16 | `src/models/authorization/contextRoleProfiles.js:284-294` | `"venture:founder": …` `"venture:team_member": …` `"venture:venture_manager": …` `"lms:learner": …` `"investor:investor": …` `"program:program_manager": …` | Familles de rôles héritées/contextuelles |
| I17 | `src/models/authorization/profile-catalog.js:106-111` | `{ key: "venture_manager", … context: "venture", allowedRoles: ["staff"], }` | `venture_manager` comme clé de profil |
| I18 | `src/models/authorization/profileCatalogueSeed.js:59-69` | `{ key: "investor", label: "Mentor", context: "investor", … }` … `{ key: "venture_manager", label: "Venture Manager", … }` | Libellés `Mentor`/`Venture Manager` |
| I19 | `src/models/authorization/backfill/policies.js:98` | `const MESSAGING_REMOVED_ROLES = ["teacher", "participant", "founder", "member"];` | Rôles retirés nommés (`teacher`, `participant`, `founder`) |

> **Ce qui n'est PAS affirmable** : « telles valeurs existent en base ».
> Seuls les sites ci-dessus sont attestés par le code. Toute conclusion sur la
> donnée réelle exigerait une requête sur la base (hors périmètre lecture seule
> de cet inventaire).

---

## 4. Vocabulaire dérivé — libellé corrompu dans le catalogue de capacités

> **CORRECTIF (Phase 2) — NON REPRODUIT SUR LE DISQUE.** La vérification directe
> (`sed`, `grep`, `git diff` vide) montre `tasks: { name: "Tasks" }` et un module
> `crm` : le libellé est **propre** aujourd'hui. La ligne ci-dessous provient d'un
> **instantané obsolète** des outils de lecture. Voir
> `inventaire-00-cartographie.md` §8 « Correctif d'instantané ».

**Statut : FAIT CONFIRMÉ.**

| # | Fichier:ligne | Extrait exact | Constat |
|---|---|---|---|
| V1 | `src/server/authz/capabilities.js` (instantané obsolète) | `name: "Tasksengineering.permissions.prototype.sections.people"` (rapporté) | **NON REPRODUIT** — sur le disque, `name` vaut `"Tasks"`. Constat d'instantané retiré (voir correctif ci-dessus). |

Aucun autre libellé corrompu de ce type n'a été trouvé dans
`src/server/authz/capabilities.js` (les autres `name:` sont des libellés propres :
`"Projects"`, `"Programs"`, `"Users"`, …, `"LMS"`, voir `:16-123`).

---

## Incertitudes

1. **Valeurs réelles en base** : impossibles à lire depuis le code. Les identités
   héritées (§3) ne sont attestées qu'au niveau des sites d'écriture/lecture ;
   je ne peux pas affirmer ce que contiennent `contacts.role`,
   `venture_members.member_type`, `v2_program_staff.role`, etc.
2. **Mots de passe en clair effectifs** : le repli de comparaison (A1–A5) et le
   stockage équipe/famille (A6–A7) sont confirmés dans le code ; l'existence de
   lignes réellement en clair dans les tables dépend de la donnée et n'est pas
   vérifiable sans requête base.
3. **DEP-1 (`tar`)** : non vérifiable sans exécuter `npm audit` (réseau). Le
   `package.json` confirme `unpdf` (`:105`) et `html2canvas` (`:93`), mais la
   présence/le chemin `canvas`/`tar` fautif relève de l'arbre de dépendances
   installé, pas du dépôt.
4. **RATE-2** : je confirme la présence du limiteur sur les routes d'auth
   (`login/route.js:42-49`) et son absence sur `upload/route.js` ; je n'ai pas
   énuméré *toutes* les routes publiques/coûteuses, donc le périmètre exact du
   « reste » est partiel.
5. **MVC-1 et DATA-1** : champs d'inventaire continus (SQL inline, `SELECT *`).
   Je n'ai pas produit l'énumération exhaustive ; ils restent « ongoing/partiel »
   conformément au registre.
6. **Contradictions du registre** : la section §3 (OPEN) et la section §8
   (FIXED — Lot 15) se contredisent sur PUB-2, PUB-3, CSRF-1, AUTH-4,
   AUTHZ-GLOBAL-1, AUTHZ-CRM-1 et SECRET-3. J'ai tranché par le code ; là où le
   code ne permit pas de trancher entièrement, le statut est PARTIEL.
7. **Découverte inattendue non couverte par le registre** :
   `src/app/api/auth/session-login/route.js` est une route sœur de `auth/login`
   qui **n'a pas** reçu le durcissement anti-énumération (ni message unique +
   *timing equalizer* complet, ni le même traitement de statut). À confirmer
   côté produit si elle est réellement utilisée en production.
