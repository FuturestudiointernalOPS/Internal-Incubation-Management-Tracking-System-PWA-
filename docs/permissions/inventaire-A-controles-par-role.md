# Inventaire A — Contrôles d'autorisation « par rôle » (hors moteur central)

> Inventaire en lecture seule des décisions d'accès prises **hors du moteur central** (`src/server/authz/**`, `src/models/authorization/**`, `src/services/authorization/**`) : listes de rôles en dur, comparaison au nom du rôle, constantes de rôles, middlewares par rôle.
> Chaque ligne est reproductible par `ripgrep` ; l'extrait est la ligne source exacte (aucun contenu inventé).

## 1. Commandes exactes utilisées

Toutes les commandes s'exécutent depuis la racine du projet, avec `--glob 'src/**/*.js'` et recherche récursive dans `src`.

```bash
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'requireAuth\(\s*\[' src   # M1 requireAuth([rôles])
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'roles\s*:\s*\[' src   # M2 roles: [...] / allowed_roles: [...]
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'role\s*===|role\s*!==' src   # M3 role === / role !==
rg -n --no-heading --color never --glob 'src/**/*.js' -e '\.includes\(.*role' src   # M4 .includes(…role…)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'const\s+ROLE' src   # M5 const ROLE…
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'ROLE_ACCESS' src   # M6 ROLE_ACCESS[…] (masque nav)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'PERSONAL_ROLES' src   # M7 PERSONAL_ROLES
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'role_capabilities' src   # M8 role_capabilities (legacy)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'requireVentureAccess\(' src   # M9 requireVentureAccess(…)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'requireAuth\(' src   # R1 requireAuth( (total, dont sans rôles)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'requireAuthorization\(' src   # R2 requireAuthorization( (moteur)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'requireScopedAccess\(' src   # R3 requireScopedAccess( (moteur)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'requireVentureScopedAccess\(' src   # R4 requireVentureScopedAccess( (adjacent)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'hasVentureCapability\(' src   # R5 hasVentureCapability( (adjacent)
rg -n --no-heading --color never --glob 'src/**/*.js' -e 'createHandler\(' src   # R6 createHandler( (total)
```

Répartition : **production** = hors `src/__tests__/**` ET hors dossiers du moteur ; **tests** = `src/__tests__/**` ; **moteur** = `src/server/authz/**`, `src/models/authorization/**`, `src/services/authorization/**`.

## 2. Totaux par mécanisme et réconciliation

| Mécanisme | motif rg | total `src` | production | tests | moteur |
|---|---|---:|---:|---:|---:|
| M1 requireAuth([rôles]) | `requireAuth\(\s*\[` | 87 | **83** | 4 | 0 |
| M2 roles: [...] / allowed_roles: [...] | `roles\s*:\s*\[` | 139 | **108** | 30 | 1 |
| M3 role === / role !== | `role\s*===|role\s*!==` | 238 | **218** | 12 | 8 |
| M4 .includes(…role…) | `\.includes\(.*role` | 130 | **81** | 44 | 5 |
| M5 const ROLE… | `const\s+ROLE` | 24 | **21** | 1 | 2 |
| M6 ROLE_ACCESS[…] (masque nav) | `ROLE_ACCESS` | 17 | **10** | 7 | 0 |
| M7 PERSONAL_ROLES | `PERSONAL_ROLES` | 4 | **3** | 1 | 0 |
| M8 role_capabilities (legacy) | `role_capabilities` | 47 | **1** | 6 | 40 |
| M9 requireVentureAccess(…) | `requireVentureAccess\(` | 61 | **40** | 20 | 1 |

### Mécanismes de référence (moteur / non « par rôle »)

| Réf | motif rg | total `src` | production | tests | moteur |
|---|---|---:|---:|---:|---:|
| R1 requireAuth( (total, dont sans rôles) | `requireAuth\(` | 238 | 229 | 9 | 0 |
| R2 requireAuthorization( (moteur) | `requireAuthorization\(` | 287 | 278 | 5 | 4 |
| R3 requireScopedAccess( (moteur) | `requireScopedAccess\(` | 14 | 0 | 13 | 1 |
| R4 requireVentureScopedAccess( (adjacent) | `requireVentureScopedAccess\(` | 69 | 65 | 4 | 0 |
| R5 hasVentureCapability( (adjacent) | `hasVentureCapability\(` | 12 | 8 | 4 | 0 |
| R6 createHandler( (total) | `createHandler\(` | 240 | 238 | 2 | 0 |

### Écart avec les comptages fournis

| Grandeur fournie | Valeur fournie | Valeur mesurée | Périmètre de la valeur fournie | Explication |
|---|---:|---|---|---|
| comparaisons `role ===` / `role !==` | 226 | 226 | production seule | correspondance exacte hors `src/__tests__` (238 en incluant les tests) |
| appels `requireAuth([...])` | 87 | 87 | total `src` | 87 = total `src` incluant 4 appels dans `src/__tests__` ; production = 83 |
| occurrences `roles: [...]` | 139 | 139 | total `src` | 139 = total `src` (30 dans les tests, 1 dans le moteur) ; production = 108. Le motif capture aussi les champs `allowed_roles: [...]` |
| occurrences `.includes(role…)` | 80 | 130 | non reproductible à l'identique | voir note ci-dessous |
| définitions `const ROLE…` | 24 | 24 | total `src` | 24 = total `src` (1 dans les tests, 2 dans le moteur) ; production = 21 |
| appels `requireAuth(` (total) | 238 | 238 | total `src` | 238 = total `src` ; production = 229 |
| appels `requireAuthorization(` (moteur) | 287 | 287 | total `src` | référence moteur ; production = 278 |
| appels `requireScopedAccess(` (moteur) | 14 | 14 | total `src` | 13 dans `src/__tests__`, 1 seul en production |

**Note `.includes(role…)`** — le chiffre 80 n'a pu être reproduit exactement. Définitions candidates mesurées :

- lignes contenant `.includes(` **et** `role` sur la même ligne (définition retenue pour l'inventaire) : **81** en production (130 au total `src`).
- littéral `.includes(role` (le motif le plus étroit) : 37 en production.
- `.includes(` + `role` insensible à la casse, séparateurs compris : 86 en production.
Le chiffre 80 est vraisemblablement obtenu avec une variante de motif légèrement différente (portée de glob, casse ou comptage de matchs vs lignes). L'inventaire ci-dessous utilise la définition **ligne = `.includes(` + `role`**, qui est la plus large et donc la plus exhaustive.

L'écart entre le nombre de lignes de cet inventaire et les totaux ci-dessus vient de la **fusion** des lignes qui matchent plusieurs mécanismes (une ligne peut porter `.includes(role)` et `role ===`) : la colonne « mécanisme » les liste alors toutes ; le décompte par mécanisme reste celui du tableau §2.

## Domaine : admin (28 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/admin/announcements/page.js` | 146 | M3 | `user?.role === "super_admin" \|\|` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/announcements/page.js` | 147 | M3 | `user?.role === "program_manager" \|\|` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/announcements/page.js` | 148 | M3 | `user?.role === "admin" \|\|` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/announcements/page.js` | 149 | M3 | `user?.role === "staff";` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/blockers/page.js` | 45 | M3 | `const isSuperAdmin = role === "super_admin";` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/communications/contacts/BulkProgramModal.js` | 79 | M3 | `contact.role === "participant",` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/communications/contacts/BulkProgramModal.js` | 104 | M3 | `contact.role === "participant" \|\|` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/communications/contacts/BulkProgramModal.js` | 105 | M3 | `contact.role === "unassigned",` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/communications/contacts/BulkProgramModal.js` | 152 | M3 | `contact.role === "participant" \|\|` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/communications/contacts/BulkProgramModal.js` | 153 | M3 | `contact.role === "unassigned",` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/crm/page.js` | 10 | M5 | `const ROLE_LABELS = {` | à préciser selon la ressource (users.view / settings.view) | faible | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/admin/hooks/useAdminDashboardData.js` | 135 | M3 | `if (storedUser && JSON.parse(storedUser).role === "super_admin") {` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/hooks/useAdminDashboardData.js` | 146 | M3 | `payload.user.role !== "super_admin"` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/hooks/useAdminWidgetData.js` | 29 | M3 | `const isSA = user.role === "super_admin";` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/layout.js` | 19 | M4 | `return ADMIN_ROLES.includes(role) ? role : null;` | à préciser selon la ressource (users.view / settings.view) | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/app/admin/layout.js` | 69 | M4 | `if (ADMIN_ROLES.includes(role)) {` | à préciser selon la ressource (users.view / settings.view) | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/app/admin/op-reports/page.js` | 86 | M3 | `const isSA = role === "super_admin";` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/projects/[id]/page.js` | 52 | M3 | `(contact) => contact.status === "active" && contact.role !== "participant",` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/work/page.js` | 200 | M3 | `const isSuperAdmin = role === "super_admin";` | à préciser selon la ressource (users.view / settings.view) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/api/admin/analytics/route.js` | 19 | M1 | `const authError = await requireAuth(["super_admin"]);` | à préciser selon la ressource (users.view / settings.view) | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/admin/analytics/users/route.js` | 15 | M1 | `const authError = await requireAuth(["super_admin"]);` | à préciser selon la ressource (users.view / settings.view) | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/admin/blockers/route.js` | 5 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {` | à préciser selon la ressource (users.view / settings.view) | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/admin/finance/data-sources/route.js` | 5 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async () => {` | à préciser selon la ressource (users.view / settings.view) | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/admin/projects/[id]/reports/generate/route.js` | 18 | M1 | `const authError = await requireAuth(["super_admin", "staff", "program_manager"]);` | à préciser selon la ressource (users.view / settings.view) | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/admin/projects/route.js` | 20 | M1 | `const authError = await requireAuth(["super_admin"]);` | à préciser selon la ressource (users.view / settings.view) | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/admin/run-migration/route.js` | 95 | M1 | `const authError = await requireAuth(["super_admin"]);` | à préciser selon la ressource (users.view / settings.view) | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/admin/tasks/route.js` | 5 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {` | à préciser selon la ressource (users.view / settings.view) | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/components/admin/projects/list/constants.js` | 16 | M3 | `(contact) => contact.status === "active" && contact.role !== "participant",` | à préciser selon la ressource (users.view / settings.view) | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |

## Domaine : staff (5 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/staff/dashboard/page.js` | 159 | M3 | `` className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${assignment.role === "group_leader" ? "bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20" : "bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20"}`} `` | programs.view (dérivé de l'affectation) | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/staff/op-report/readers.js` | 166 | M3 | `contact.role !== "super_admin" &&` | programs.view (dérivé de l'affectation) | moyen | Décision métier basée sur le nom du rôle. |
| `src/components/staff/ProjectsView.js` | 83 | M3 | `const isLead = (project) => project.members?.some((member) => member.user_cid === cid && member.role === "lead");` | programs.view (dérivé de l'affectation) | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/staff/op-report/SummaryOwnerCard.js` | 8 | M3 | `(project) => project.member_role === "lead",` | programs.view (dérivé de l'affectation) | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/staff/project-detail/TeamTab.js` | 39 | M3 | `` className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${member.member_role === "lead" ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "bg-slate-500/10 text-slate-500"}`} `` | programs.view (dérivé de l'affectation) | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |

## Domaine : pm / programs (53 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/admin/programs/[id]/teams/page.js` | 28 | M3 | `(contact.role === "super_admin" \|\|` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/programs/[id]/teams/page.js` | 29 | M3 | `contact.role === "program_manager" \|\|` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/programs/[id]/teams/page.js` | 30 | M3 | `contact.role === "admin" \|\|` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/admin/programs/[id]/teams/page.js` | 31 | M3 | `contact.role === "staff"),` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/api/pm/programs/[id]/manager/route.js` | 60 | M3 | `const isSuperAdmin = session?.role === "super_admin";` | programs.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/pm/programs/[id]/route.js` | 16 | M2 | `{ roles: ["super_admin", "program_manager", "staff"] },` | programs.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/pm/programs/assignment/route.js` | 8 | M2 | `{ roles: ["super_admin", "program_manager", "staff"] },` | programs.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/pm/programs/assignment/route.js` | 20 | M3 | `if (session?.role === "staff") {` | programs.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/pm/programs/route.js` | 57 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/pm/programs/templates/route.js` | 24 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/pm/programs/templates/route.js` | 41 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/pm/schedule/route.js` | 7 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | programs.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/pm/schedule/route.js` | 13 | M3 | `if (session?.role === "super_admin") {` | programs.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/pm/submissions/route.js` | 16 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | programs.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/pm/submissions/route.js` | 38 | M3 | `session?.role !== "super_admin" &&` | programs.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/program-staff/route.js` | 22 | M2 + M5 | `const ROLE = { roles: ['super_admin'] };` | programs.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/program-staff/route.js` | 112 | M3 | `if (role !== undefined) {` | programs.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/program-types/route.js` | 31 | M1 | `const authError = await requireAuth(["super_admin"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/programs/route.js` | 18 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/programs/route.js` | 82 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/program-staff/route.js` | 30 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/program-staff/route.js` | 48 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/program-staff/route.js` | 64 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/program-staff/route.js` | 80 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | programs.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/pm/programs/[id]/actions/kpis.js` | 23 | M3 | `if (user.role !== "super_admin") {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/pm/programs/[id]/actions/kpis.js` | 56 | M3 | `if (user.role !== "super_admin") {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/components/admin/programs/edit-modal/ProgramFacilitatorsSection.js` | 233 | M3 | `c.role !== "participant" &&` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/admin/programs/edit-modal/ProgramFacilitatorsSection.js` | 234 | M3 | `c.role !== "applicant" &&` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/admin/programs/edit-modal/ProgramFacilitatorsSection.js` | 235 | M3 | `c.role !== "student",` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/program-workspace/ConfigTab.js` | 230 | M3 | `disabled={user.role === "program_manager"}` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/program-workspace/ConfigTab.js` | 231 | M3 | `` className={`w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold ${user.role === "program_manager" ? "opacity-50 cursor-not-allowed" : ""}`} `` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/program-workspace/DeployTeamModal.js` | 229 | M3 | `{member.role === "teacher"` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/program-workspace/ReportsTab.js` | 9 | M3 | `{user.role === "program_manager" && (` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/program-workspace/StaffAssignmentModal.js` | 60 | M3 | `.filter((member) => member.role !== "super_admin")` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/programs/programTabs.js` | 29 | M2 | `roles: ["super_admin", "program_manager"],` | programs.view | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/pm/programs/programTabs.js` | 45 | M2 | `roles: ["super_admin", "program_manager", "staff"],` | programs.view | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/pm/programs/programTabs.js` | 51 | M2 | `roles: ["super_admin", "program_manager", "staff"],` | programs.view | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/pm/programs/programTabs.js` | 67 | M2 | `roles: ["super_admin", "program_manager", "staff"],` | programs.view | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/pm/programs/programWorkspacePayloads.js` | 22 | M3 | `user.role === "super_admin" ? configNameRef.current?.value : program?.name,` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/programs/programWorkspaceSelectors.js` | 37 | M3 + M4 | `approvedIds.includes(member.cid) && member.role !== "investor",` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. Test d'appartenance à une liste de rôles hors route API. |
| `src/components/pm/programs/programWorkspaceSelectors.js` | 67 | M3 | `user.role === "super_admin" \|\|` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/programs/programWorkspaceSelectors.js` | 77 | M3 | `user.role === "super_admin" \|\|` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/programs/programWorkspaceSelectors.js` | 78 | M3 | `user.role === "program_manager" \|\|` | programs.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/pm/programs/programWorkspaceSelectors.js` | 92 | M4 | `tab.roles.includes(user.role) \|\|` | programs.view | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/models/programs/core/programList.js` | 85 | M4 | `!["super_admin", "program_manager", "staff"].includes(session.role)` | programs.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/programs/programStaff.js` | 35 | M3 | `if (session.role === "super_admin") return;` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 36 | M3 | `if (session.role === "program_manager") return;` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 37 | M3 | `if (session.role === "staff") {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 76 | M3 | `if (session?.role === "staff") {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 95 | M3 | `if (session?.role === "staff") {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 154 | M3 | `if (session?.role === "staff" && target.rows[0]?.program_id) {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 160 | M3 | `if (role !== undefined) {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/programs/programStaff.js` | 229 | M3 | `if (session?.role === "staff" && row.rows[0]?.program_id) {` | programs.view | moyen | Décision métier basée sur le nom du rôle. |

## Domaine : participant (11 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/api/admin/fix-participant/route.js` | 22 | M1 | `const authError = await requireAuth(["super_admin"]);` | lms.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/participant-programs/bulk/route.js` | 27 | M1 | `const authError = await requireAuth([` | lms.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/participants/route.js` | 27 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | lms.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/services/participant/fullState.js` | 31 | M4 | `if (FULL_STATE_ROLES.includes(role)) return true;` | lms.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/participant/submissions.js` | 24 | M4 | `if (PRIVILEGED_READ_ROLES.includes(role)) return { participantId, teamId };` | lms.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/participant/submissions.js` | 29 | M3 | `if (teamId && role !== "team") {` | lms.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/participant/submissions.js` | 41 | M4 | `if (PRIVILEGED_WRITE_ROLES.includes(role)) {` | lms.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/participant/submissions.js` | 48 | M3 | `if (teamId && role !== "team") {` | lms.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/participant/submissions.js` | 64 | M4 | `if (!programId \|\| PRIVILEGED_WRITE_ROLES.includes(role)) return false;` | lms.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/programs/participantPrograms.js` | 47 | M1 | `const authError = await requireAuth(["staff", "super_admin", "program_manager"]);` | lms.view | moyen | Appel requireAuth([rôles]) hors route API. |
| `src/services/programs/participantPrograms.js` | 107 | M1 | `const authError = await requireAuth(["staff", "super_admin", "program_manager"]);` | lms.view | moyen | Appel requireAuth([rôles]) hors route API. |

## Domaine : investor (25 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/admin/investors/page.js` | 57 | M3 | `const isSuperAdmin = role === "super_admin";` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/api/investor/admin-overview/route.js` | 14 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/approval/route.js` | 17 | M1 | `const authError = await requireAuth(["super_admin", "staff"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/approval/route.js` | 35 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/campaigns/route.js` | 45 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/campaigns/route.js` | 66 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/executive-dashboard/route.js` | 14 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/profile/route.js` | 89 | M1 | `const authError = await requireAuth(["super_admin", "staff"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/relationships/meetings/route.js` | 45 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/relationships/meetings/route.js` | 87 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/relationships/route.js` | 48 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/investor/relationships/route.js` | 77 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/investor-run/route.js` | 22 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/seed/investor-application/route.js` | 24 | M1 | `const authError = await requireAuth(["super_admin"]);` | investor.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/ventures/[id]/investors/route.js` | 9 | M9 | `const { session } = await requireVentureAccess(id);` | investor.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/investors/route.js` | 38 | M9 | `const { session } = await requireVentureAccess(id);` | investor.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/investor/organizations/page.js` | 182 | M3 | `member.role === "admin" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/investor/organizations/page.js` | 184 | M3 | `{member.role === "admin" ? <Crown className="w-3 h-3 inline mr-1" /> : null}` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/investor/organizations/page.js` | 220 | M3 | `{organization.member_role === "admin" && (` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/models/investor/diligenceAndPipeline/pipeline.js` | 242 | M3 | `} else if (stage && (role === "super_admin" \|\| role === "staff")) {` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/investor/campaigns.js` | 115 | M4 | `const management = MANAGEMENT_ROLES.includes(session?.role);` | investor.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/investor/diligence/requestActions.js` | 43 | M3 | `const isAdmin = session?.role === "super_admin";` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/investor/organizations.js` | 99 | M3 | `isSameInvestor(member.investor_id, scope.profileId) && member.role === "admin",` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/investor/pipeline.js` | 65 | M3 | `return !ventureId && !(stage && (role === "super_admin" \|\| role === "staff"));` | investor.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/investor/pipeline.js` | 70 | M4 | `const management = MANAGEMENT_ROLES.includes(session?.role);` | investor.view | moyen | Test d'appartenance à une liste de rôles hors route API. |

## Domaine : facilitator (5 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/api/facilitator-reviews/route.js` | 113 | M1 | `const authError = await requireAuth([` | facilitator.participants.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/facilitators/invite-bulk/route.js` | 84 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | facilitator.participants.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/facilitators/invite-bulk/route.js` | 107 | M3 | `if (session?.role === "staff") {` | facilitator.participants.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/facilitator/layout.js` | 23 | M3 | `if (session.role !== "super_admin") {` | facilitator.participants.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/operations/facilitatorReviews.js` | 159 | M3 | `if (session.role === "program_manager") {` | facilitator.participants.view | moyen | Décision métier basée sur le nom du rôle. |

## Domaine : crm (47 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/api/crm/activities/[id]/route.js` | 13 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/activities/[id]/route.js` | 41 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/activities/route.js` | 17 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/activities/route.js` | 36 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/automations/[id]/route.js` | 9 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/automations/[id]/route.js` | 22 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/automations/[id]/route.js` | 40 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/automations/route.js` | 10 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/automations/route.js` | 22 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/contacts/[cid]/organizations/[rid]/route.js` | 24 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/contacts/[cid]/organizations/[rid]/route.js` | 58 | M2 | `{ roles: ["super_admin", "staff"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/contacts/[cid]/organizations/route.js` | 27 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/contacts/[cid]/organizations/route.js` | 43 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/leads/[id]/route.js` | 11 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/leads/[id]/route.js` | 32 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/leads/[id]/route.js` | 132 | M2 | `{ roles: ["super_admin"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/leads/[id]/tasks/route.js` | 18 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/leads/route.js` | 18 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/leads/route.js` | 39 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/[id]/route.js` | 16 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/[id]/route.js` | 45 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/[id]/route.js` | 110 | M2 | `{ roles: ["super_admin"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/[id]/stage/route.js` | 35 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/[id]/tasks/route.js` | 19 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/route.js` | 21 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/opportunities/route.js` | 49 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/organizations/[id]/route.js` | 23 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/organizations/[id]/route.js` | 52 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/organizations/[id]/route.js` | 86 | M2 | `{ roles: ["super_admin"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/organizations/route.js` | 25 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/organizations/route.js` | 49 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/pipelines/[id]/route.js` | 12 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/pipelines/[id]/route.js` | 32 | M2 | `{ roles: ["super_admin"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/pipelines/[id]/stages/route.js` | 12 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/pipelines/[id]/stages/route.js` | 27 | M2 | `{ roles: ["super_admin"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/pipelines/route.js` | 13 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/pipelines/route.js` | 27 | M2 | `{ roles: ["super_admin"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/segments/[id]/route.js` | 9 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/segments/[id]/route.js` | 27 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/segments/route.js` | 10 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/crm/segments/route.js` | 24 | M2 | `{ roles: ["super_admin", "staff", "program_manager"] },` | contacts.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/crm/contacts/page.js` | 21 | M5 | `const ROLE_LABELS = {` | contacts.view | faible | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/crm/page.js` | 31 | M3 | `role === "program_manager"` | contacts.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/app/crm/page.js` | 33 | M3 | `: role === "super_admin"` | contacts.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/components/crm/TimelineScreen.js` | 31 | M5 | `const ROLE_LABELS = {` | contacts.view | faible | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/components/crm/people-detail/constants.js` | 19 | M5 | `export const ROLE_LABELS = {` | contacts.view | faible | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/components/crm/useMembershipState.js` | 133 | M3 | `if (roleFilter !== "all" && member.role !== roleFilter) return false;` | contacts.view | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |

## Domaine : ventures (109 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/admin/ventures/[id]/founders/page.js` | 14 | M5 | `const ROLE_COLORS = {` | ventures.view | faible | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/admin/ventures/create/route.js` | 21 | M2 | `export const POST = createHandler({ roles: ["super_admin"] }, async (req) => {` | ventures.view | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/admin/ventures/route.js` | 6 | M2 | `{ roles: ["super_admin"] },` | ventures.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/admin/ventures/route.js` | 41 | M2 | `{ roles: ["super_admin"] },` | ventures.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/ventures/[id]/advisors/route.js` | 10 | M5 | `const ROLES = ["participant","founder","staff","program_manager","super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/advisors/route.js` | 20 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/advisors/route.js` | 31 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/advisors/route.js` | 44 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/analytics/route.js` | 10 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/blockers/route.js` | 69 | M4 | `if (blockerCreator.rows[0].user_id !== session.cid && !["staff","super_admin","program_manager"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/coaching/route.js` | 13 | M5 | `const ROLES = ["participant","founder","staff","program_manager","super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/coaching/route.js` | 23 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/coaching/route.js` | 34 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/coaching/route.js` | 52 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/dashboard/route.js` | 23 | M4 | `const isInternalViewer = ["super_admin"].includes(session?.role);` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/deliverables/route.js` | 47 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/deliverables/route.js` | 135 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/deliverables/upload/route.js` | 25 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/document-types/route.js` | 39 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/reviews/route.js` | 12 | M5 | `const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/documents/[docId]/reviews/route.js` | 22 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/reviews/route.js` | 43 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/transition/route.js` | 11 | M5 | `const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/documents/[docId]/transition/route.js` | 32 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/transition/route.js` | 41 | M4 | `if (!PRIVILEGED.includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/documents/[docId]/versions/route.js` | 11 | M5 | `const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/documents/[docId]/versions/route.js` | 19 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/versions/route.js` | 40 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/route.js` | 13 | M5 | `const ROLES = ["participant","founder","staff","program_manager","super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/documents/route.js` | 36 | M4 | `if (PRIVILEGED.includes(session.role)) return null;` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/documents/route.js` | 44 | M3 | `if (session.role === "investor") return ["shared_with_investor"];` | ventures.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/ventures/[id]/documents/route.js` | 51 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/route.js` | 94 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/route.js` | 118 | M4 | `if (!PRIVILEGED.includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/feedback/route.js` | 8 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/feedback/route.js` | 55 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/founders/[founderId]/route.js` | 61 | M3 | `if (role && role !== founder.role) {` | ventures.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/ventures/[id]/founders/route.js` | 24 | M9 | `const access = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/founders/route.js` | 68 | M4 | `if (!VENTURE_ROLES.includes(role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/fundraising/route.js` | 9 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/fundraising/route.js` | 40 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/history/route.js` | 35 | M4 | `if (session && !["super_admin"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/investment/route.js` | 8 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/investment/route.js` | 36 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/journey-report/route.js` | 40 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/journey/route.js` | 62 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/lead/route.js` | 58 | M4 | `if (["staff", "program_manager"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/lead/route.js` | 77 | M4 | `if (!privileged.includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/lifecycle/route.js` | 49 | M4 | `if (!["super_admin"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/members/route.js` | 255 | M3 | `if (role !== undefined) {` | ventures.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/ventures/[id]/notes/route.js` | 50 | M4 | `return !!session && GLOBAL_ROLES.includes(session.role);` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/progress/route.js` | 21 | M5 | `const ROLES = ["participant","founder","staff","program_manager","super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/progress/route.js` | 30 | M9 | `const { id } = await params; const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/reports/route.js` | 11 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/sessions/upload/route.js` | 24 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/staff-assignments/route.js` | 14 | M5 | `const ROLES = ["super_admin"];` | ventures.view | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/submissions/review-queue/route.js` | 33 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js` | 76 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js` | 87 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js` | 140 | M4 | `if (!REVIEWER_ROLES.includes(session?.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/tasks/route.js` | 146 | M4 | `if (!reviewerRoles.includes(session?.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/verification/documents/[docId]/versions/route.js` | 31 | M3 | `if (session.role === "super_admin") return true;` | ventures.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/ventures/[id]/verification/route.js` | 16 | M4 | `if (["super_admin"].includes(session.role)) return true;` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/verification/route.js` | 36 | M4 | `if (!["super_admin"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/verification/route.js` | 157 | M4 | `authorType: staffRoles.includes(session.role) ? "staff" : "founder",` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/[id]/verification/upload/route.js` | 25 | M9 | `const { session } = await requireVentureAccess(id);` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/assigned/route.js` | 16 | M2 | `{ roles: ["staff", "program_manager", "super_admin"] },` | ventures.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/ventures/assigned/route.js` | 23 | M4 | `if (["super_admin"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/lead-manager/home/route.js` | 17 | M2 | `{ roles: ["staff", "program_manager", "super_admin"] },` | ventures.view | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/ventures/lead-manager/home/route.js` | 24 | M3 | `if (session.role === "super_admin") {` | ventures.view | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/ventures/route.js` | 55 | M4 | `if (!["super_admin"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/route.js` | 56 | M4 | `if (["staff", "program_manager"].includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/ventures/route.js` | 161 | M4 | `if (!session \|\| !globalRoles.includes(session.role)) {` | ventures.view | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/lib/ventureAuth.js` | 6 | M4 | `return ["staff", "super_admin", "program_manager"].includes(role);` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/lib/ventureAuth.js` | 18 | M3 | `if (session.role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/lib/ventureAuth.js` | 82 | M9 | `*   const { ventureId, session } = await requireVentureAccess(params.id);` | ventures.view | faible | Commentaire / JSDoc — non exécuté. Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/lib/ventureAuth.js` | 109 | M9 | `export async function requireVentureAccess(ventureId) {` | ventures.view | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/lib/ventureAuth.js` | 115 | M4 | `if (globalRoles.includes(session.role)) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/lib/ventureDeliverables.js` | 31 | M3 | `if (role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/founders.js` | 98 | M3 | `if (session.role === "super_admin") return { allowed: true, isOwner: true };` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/founders.js` | 107 | M4 | `const allowed = founder.is_owner \|\| MANAGEMENT_ROLES.includes(founder.role);` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/founders.js` | 164 | M4 | `if (!VENTURE_ROLES.includes(role)) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/founders.js` | 201 | M4 | `if (role && !VENTURE_ROLES.includes(role)) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/memberRoster.js` | 141 | M3 | `if (memberContactId && role !== undefined) {` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/milestoneEngine/authority.js` | 24 | M3 | `if (role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/milestoneEngine/authority.js` | 54 | M3 | `if (role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/operatingPlans.js` | 54 | M4 | `return GLOBAL_ROLES.includes(role);` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/profile/access.js` | 15 | M3 | `if (session.role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/profile/access.js` | 54 | M3 | `if (session.role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/profile/access.js` | 58 | M4 | `if (["staff", "program_manager"].includes(session.role)) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/scope.js` | 42 | M4 | `return GLOBAL_ROLES.includes(role);` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/submissions/createSubmission.js` | 41 | M3 | `if (session && (role === "participant" \|\| role === "member")) {` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/createSubmission.js` | 63 | M3 | `} else if (session && role === "team") {` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/createSubmission.js` | 82 | M4 | `} else if (session && !MANAGEMENT_ROLES.includes(role)) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/submissions/createSubmission.js` | 115 | M4 | `if (session && ["participant", "team"].includes(session.role)) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/submissions/createSubmission.js` | 122 | M3 | `if (session.role === "participant") {` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/review.js` | 92 | M3 | `if (role === "facilitator") return "facilitator";` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/review.js` | 93 | M3 | `if (role === "program_manager") return "management";` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/review.js` | 97 | M4 | `if (submission && FINAL_STATUSES.includes(submission.status) && submission.reviewed_by_role) {` | ventures.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/ventures/submissions/scope.js` | 16 | M3 | `if (session?.role === "team") {` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/scope.js` | 35 | M3 | `session.role !== "staff" &&` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/scope.js` | 36 | M3 | `session.role !== "team"` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/scope.js` | 49 | M3 | `session.role !== "staff" &&` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/submissions/scope.js` | 50 | M3 | `session.role !== "team",` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/ventureDocumentTypes.js` | 208 | M3 | `if (session.role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/verification/categories.js` | 44 | M3 | `if (session.role === "super_admin") return { allowed: true, isReviewer: true };` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/verification/categories.js` | 45 | M3 | `if (session.role === "verification_officer") return { allowed: true, isReviewer: true };` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/verification/categories.js` | 51 | M3 | `if (session.role === "staff") {` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/ventures/verification/categories.js` | 68 | M3 | `if (session.role === "super_admin") return true;` | ventures.view | moyen | Décision métier basée sur le nom du rôle. |

## Domaine : engineering / permissions (30 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/api/engineering/permissions/profile-role-defaults/route.js` | 76 | M4 | `if (!PROFILE_BASELINE_ROLES.includes(roleName)) {` | permissions.* / engineering.* | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/engineering/permissions/route.js` | 86 | M3 | `session.role !== "super_admin"` | permissions.* / engineering.* | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/ventures/[id]/documents/[docId]/permissions/route.js` | 11 | M5 | `const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin"];` | permissions.* / engineering.* | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/ventures/[id]/documents/[docId]/permissions/route.js` | 36 | M9 | `const { session } = await requireVentureAccess(id);` | permissions.* / engineering.* | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/permissions/route.js` | 57 | M9 | `const { session } = await requireVentureAccess(id);` | permissions.* / engineering.* | moyen | Middleware d'accès venture (bypass super_admin + appartenance). |
| `src/app/api/ventures/[id]/documents/[docId]/permissions/route.js` | 66 | M4 | `if (!PRIVILEGED.includes(session.role)) {` | permissions.* / engineering.* | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/components/permissions-preview/Personnes.js` | 66 | M3 | `.filter((person) => (role === "tous" ? true : person.roleLabel === role))` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions-preview/Regles.js` | 172 | M4 | `const next = row.roles.includes(role) ? row.roles.filter((value) => value !== role) : [...row.roles, role];` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions-preview/Regles.js` | 195 | M4 | `const active = row.roles.includes(role);` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions-preview/store.js` | 170 | M3 | `isSuperAdmin: user.role === "super_admin",` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions/AccessChecker.js` | 103 | M3 | `const isSuperAdmin = data.user?.role === "super_admin";` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions/AdminsView.js` | 55 | M3 | `() => users.filter((user) => user.role === "super_admin"),` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions/AdminsView.js` | 62 | M3 | `.filter((user) => user.role !== "super_admin")` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions/ProfilesView.js` | 50 | M2 | `const [newProfile, setNewProfile] = useState({ key: "", label: "", context: "", allowed_roles: [] });` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/ProfilesView.js` | 156 | M2 | `const draft = prev[rowKey(row)] \|\| { allowed_roles: [] };` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/ProfilesView.js` | 157 | M4 | `const has = (draft.allowed_roles \|\| []).includes(role);` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions/ProfilesView.js` | 177 | M2 | `const current = Array.isArray(row.allowed_roles) ? row.allowed_roles : [];` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/ProfilesView.js` | 181 | M4 | `draftRoles.every((role) => current.includes(role));` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions/ProfilesView.js` | 277 | M4 | `const has = prev.allowed_roles.includes(role);` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions/ProfilesView.js` | 290 | M2 | `setNewProfile({ key: "", label: "", context: data?.contexts?.[0] \|\| "", allowed_roles: ["member"] });` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/ProfilesView.js` | 308 | M2 | `setNewProfile({ key: "", label: "", context: "", allowed_roles: [] });` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/overviewHelpers.js` | 13 | M2 | `const list = Array.isArray(roles) ? roles : [];` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/permission-center/PersonAccessScreen.js` | 198 | M8 | `* reads the profile's capabilities INSTEAD OF role_capabilities — so a` | permissions.* / engineering.* | faible | Commentaire / JSDoc — non exécuté. Repli legacy rôle → capacités (role_capabilities). |
| `src/components/permissions/permission-center/PersonAccessScreen.js` | 308 | M3 | `superAdmin: userPerms?.user?.role === "super_admin",` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions/permission-center/ResponsibilityAccessView.js` | 105 | M2 | `responsibility.id === resp.id ? { ...responsibility, allowed_roles: [...allowedRoles] } : responsibility,` | permissions.* / engineering.* | faible | Liste/allowlist de rôles (roles:, dont allowed_roles). |
| `src/components/permissions/permission-center/ResponsibilityAccessView.js` | 132 | M4 | `const next = current.includes(role)` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions/permission-center/ResponsibilityAccessView.js` | 239 | M4 | `const active = effective.includes(role);` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions/permission-center/person-access/PersonAccessView.js` | 175 | M3 | `const isSuperAdmin = userPerms?.user?.role === "super_admin";` | permissions.* / engineering.* | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/permissions/profiles-view/ProfileCatalogue.js` | 39 | M4 | `checked={(draft.allowed_roles \|\| []).includes(role)}` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/permissions/profiles-view/ProfileCreateForm.js` | 97 | M4 | `checked={newProfile.allowed_roles.includes(role)}` | permissions.* / engineering.* | faible | Test d'appartenance à une liste de rôles hors route API. |

## Domaine : tasks (22 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/api/tasks/approve/route.js` | 19 | M1 | `const authError = await requireAuth(["super_admin"]);` | tasks.view | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/services/platform/intents/tasks.js` | 43 | M3 | `session.role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/platform/intents/tasks.js` | 92 | M3 | `if (finalAssignedTo && session.role !== "super_admin") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/assignments.js` | 101 | M3 | `if (role !== "super_admin" && assignment.assigner_id !== userCid) {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/assignments.js` | 160 | M3 | `if (role !== "super_admin") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/blockers.js` | 58 | M3 | `if (session.role !== "super_admin") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/blockers.js` | 116 | M3 | `session.role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/blockers.js` | 261 | M3 | `session.role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/comments.js` | 137 | M3 | `role !== "super_admin"` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/comments.js` | 157 | M3 | `role !== "super_admin"` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/create.js` | 85 | M4 | `!["super_admin", "staff", "program_manager", "team"].includes(role)` | tasks.view | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/tasks/create.js` | 203 | M3 | `if (needsAssignment && role !== "super_admin") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/query.js` | 58 | M3 | `if (role !== "super_admin" && userId && userId !== sessionCid) {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/query.js` | 79 | M3 | `role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/query.js` | 108 | M3 | `if (role !== "super_admin") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/query.js` | 128 | M3 | `isSuperAdmin: role === "super_admin",` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/remove.js` | 40 | M3 | `role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/teamBoard.js` | 88 | M3 | `if (session.role === "team") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/updateEffects.js` | 235 | M3 | `if (role !== "super_admin" && !isTaskOwner && !isAssignee && !isOnlyStatusChange) {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/updateFields/assignment.js` | 66 | M3 | `if (role !== "super_admin") {` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/updateGuards.js` | 45 | M3 | `role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/tasks/updateGuards.js` | 65 | M3 | `role !== "super_admin" &&` | tasks.view | moyen | Décision métier basée sur le nom du rôle. |

## Domaine : API transverses (123 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/api/activity/route.js` | 6 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/activity/route.js` | 14 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/attendance/route.js` | 99 | M3 | `session?.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/attendance/route.js` | 152 | M3 | `session.role !== "staff"` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/audit-log/route.js` | 5 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/audit-logs/[id]/route.js` | 6 | M2 | `{ roles: ["super_admin", "security_officer"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/audit-logs/route.js` | 6 | M2 | `{ roles: ["super_admin", "security_officer"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/auth/invite-family/route.js` | 33 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/auth/invite-family/route.js` | 50 | M3 | `if (session?.role === "staff") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/invite/route.js` | 36 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/auth/resend-invite/[cid]/route.js` | 16 | M2 | `{ roles: ["super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/auth/revoke/[cid]/route.js` | 12 | M2 | `{ roles: ["super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/auth/session-login/route.js` | 205 | M3 | `if (user.role === "super_admin" \|\| user.id === "sa") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 207 | M3 | `} else if (user.role === "investor") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 209 | M3 | `} else if (user.role === "founder") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 211 | M3 | `} else if (user.role === "program_manager") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 214 | M3 | `user.role === "staff" \|\|` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 215 | M3 | `user.role === "project_manager" \|\|` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 221 | M3 | `} else if (user.role === "facilitator") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 225 | M3 | `} else if (user.role === "member") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/auth/session-login/route.js` | 229 | M3 | `} else if (user.role === "participant") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/campaigns/[id]/route.js` | 21 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/campaigns/[id]/route.js` | 48 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/campaigns/[id]/route.js` | 68 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/campaigns/route.js` | 15 | M2 | `export const GET = createHandler({ roles: ["staff", "super_admin"] }, async () => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/campaigns/route.js` | 21 | M2 | `export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/contacts/[cid]/emails/route.js` | 30 | M3 | `if ((session.role === "participant" \|\| session.role === "founder") && session.cid !== cid) {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/contacts/duplicates/route.js` | 27 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/contacts/duplicates/route.js` | 47 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/contacts/full-state/route.js` | 26 | M4 | `if (!["super_admin", "staff", "program_manager"].includes(session?.role)) {` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/contacts/merge/preview/route.js` | 20 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/contacts/merge/route.js` | 22 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/dashboard/route.js` | 27 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/data/route.js` | 18 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/data/route.js` | 29 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/deliverables/route.js` | 6 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/deliverables/route.js` | 34 | M2 | `{ roles: ["staff", "super_admin", "program_manager", "team", "participant"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/documents/route.js` | 20 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/documents/route.js` | 30 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/evaluation/route.js` | 25 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/evaluation/route.js` | 51 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/evaluation/route.js` | 64 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/events/route.js` | 17 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/events/route.js` | 28 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/families/route.js` | 83 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/families/route.js` | 143 | M1 | `const authError = await requireAuth(["super_admin", "program_manager", "staff"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/families/route.js` | 155 | M3 | `if (body.default_role !== undefined) { updates.push("default_role = ?"); args.push(body.default_role \|\| null); }` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/families/route.js` | 175 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/families/route.js` | 202 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/feedback/route.js` | 31 | M4 | `const effectiveParticipantId = staffSide.includes(session.role) ? participant_id : session.cid;` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/feedback/route.js` | 56 | M4 | `if (!["super_admin", "staff", "program_manager"].includes(session?.role)) {` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/followups/route.js` | 23 | M2 | `{ roles: ["staff", "super_admin", "program_manager", "facilitator", "participant"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/followups/route.js` | 47 | M2 | `{ roles: ["staff", "super_admin", "program_manager", "facilitator"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/followups/route.js` | 72 | M2 | `{ roles: ["staff", "super_admin", "program_manager", "facilitator"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/forensic/user-role/route.js` | 5 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/forensic/user-role/route.js` | 17 | M3 | `if (user.role === "super_admin" \|\| user.id === "sa") return "super_admin";` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/forensic/user-role/route.js` | 19 | M3 | `user.role === "staff" \|\|` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/forensic/user-role/route.js` | 20 | M3 | `user.role === "project_manager"` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/group-members/route.js` | 24 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/group-members/route.js` | 74 | M1 | `const authError = await requireAuth(["staff", "super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/groups/route.js` | 22 | M1 | `const authError = await requireAuth(["super_admin", "staff", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/intelligence/metrics/route.js` | 5 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async () => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/invites/route.js` | 14 | M2 | `export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/journey-reports/route.js` | 28 | M4 | `if (!GLOBAL_ROLES.includes(session.role)) {` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/kpi-progress/recalculate/route.js` | 13 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/kpi-progress/route.js` | 20 | M2 | `{ roles: ["staff", "super_admin", "program_manager"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/kpis/route.js` | 24 | M5 | `const ROLES = ["super_admin", "staff", "program_manager"];` | à créer — à préciser manuellement | moyen | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/migrate/phase0/route.js` | 23 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/migrate/phase1/route.js` | 16 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/migrate/phase1/route.js` | 94 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/migrate/phase5/route.js` | 16 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/migrate/phase5/route.js` | 94 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/collections/route.js` | 29 | M1 | `const authError = await requireAuth(["super_admin", "staff"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/collections/route.js` | 62 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/collections/route.js` | 81 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/collections/route.js` | 100 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/form-runs/handlers/get.js` | 213 | M3 | `const targetSubmitter = session.role === "super_admin" ? submitterId : session.cid;` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/platform/import/execute/route.js` | 24 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/import/preview/route.js` | 19 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/import/review-flags/route.js` | 25 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/import/review-flags/route.js` | 43 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/integrations/calendar/route.js` | 37 | M1 | `const authError = await requireAuth(["super_admin", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/platform/seed/founder-assessment/route.js` | 21 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/progress/route.js` | 9 | M2 | `export const GET = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/responses/review/route.js` | 19 | M2 | `{ roles: ["super_admin", "staff"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/responses/route.js` | 19 | M2 | `export const GET = createHandler({ roles: ["staff", "super_admin"] }, async () => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/retros/current/route.js` | 48 | M3 | `session.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/retros/submit/route.js` | 73 | M3 | `if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/security/events/route.js` | 7 | M2 | `{ roles: ["super_admin", "security_officer"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/security/events/route.js` | 35 | M2 | `{ roles: ["super_admin", "security_officer"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/security/login-history/route.js` | 6 | M2 | `{ roles: ["super_admin", "security_officer", "program_manager"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/security/sessions/route.js` | 6 | M2 | `{ roles: ["super_admin", "security_officer"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/security/sessions/route.js` | 19 | M2 | `{ roles: ["super_admin", "security_officer"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/segments/route.js` | 18 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/segments/route.js` | 33 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/segments/run/route.js` | 17 | M2 | `{ roles: ["staff", "super_admin"] },` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. |
| `src/app/api/send-pending/route.js` | 13 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/sessions/route.js` | 8 | M2 | `export const POST = createHandler({ roles: ["staff", "super_admin", "program_manager", "facilitator"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/sessions/route.js` | 53 | M2 | `export const GET = createHandler({ roles: ["staff", "super_admin", "program_manager", "facilitator"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/standups/current/route.js` | 68 | M3 | `session.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/standups/submit/route.js` | 69 | M3 | `if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/standups/submit/route.js` | 105 | M3 | `const workspace = user_role === "intern" ? "interns" : "main";` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/submissions/route.js` | 231 | M1 | `const authError = await requireAuth(["staff", "super_admin", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/superadmin/full-state/route.js` | 14 | M2 | `export const GET = createHandler({ roles: ["super_admin"] }, async () => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/superadmin/groups/assignment/route.js` | 14 | M2 | `export const POST = createHandler({ roles: ["super_admin"] }, async (req) => {` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/app/api/superadmin/standard-types/route.js` | 10 | M2 + M5 | `const ROLE = { roles: ['super_admin'] };` | à créer — à préciser manuellement | élevé | Allowlist de rôles en dur (roles:/allowed_roles:) sur un endpoint API. Déclaration d'une constante de rôles (source d'allowlists). |
| `src/app/api/system/database/route.js` | 32 | M1 | `const authError = await requireAuth(["super_admin"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/teams/route.js` | 39 | M3 | `if (session?.role === "team") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/teams/route.js` | 53 | M3 | `if (session?.role !== "team" && !canReadTeams) {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/teams/route.js` | 97 | M1 | `const authError = await requireAuth([` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/teams/route.js` | 179 | M1 | `const authError = await requireAuth([` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/teams/route.js` | 231 | M1 | `const authError = await requireAuth([` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/upload/route.js` | 38 | M4 | `const internal = ["super_admin", "staff", "program_manager", "team"].includes(role);` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/user-groups/route.js` | 29 | M3 | `if (session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Branchement sur le nom du rôle dans une route API. |
| `src/app/api/v2/groups/route.js` | 23 | M1 | `const authError = await requireAuth(["super_admin", "staff", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/groups/route.js` | 76 | M1 | `const authError = await requireAuth(["super_admin", "staff", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/groups/route.js` | 121 | M1 | `const authError = await requireAuth(["super_admin", "staff", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/kpis/route.js` | 20 | M1 | `const authError = await requireAuth(["super_admin", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/kpis/route.js` | 37 | M1 | `const authError = await requireAuth(["super_admin", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/v2/kpis/route.js` | 55 | M1 | `const authError = await requireAuth(["super_admin", "program_manager"]);` | à créer — à préciser manuellement | élevé | Garde de rôles en dur sur un endpoint API (doit devenir une capacité). |
| `src/app/api/venture-options/route.js` | 49 | M4 | `if (!session \|\| !SETUP_ROLES.includes(session.role)) {` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/venture-options/route.js` | 74 | M4 | `if (!session \|\| !SETUP_ROLES.includes(session.role)) {` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |
| `src/app/api/venture-templates/route.js` | 55 | M4 | `if (!session \|\| !SETUP_ROLES.includes(session.role)) {` | à créer — à préciser manuellement | élevé | Allowlist par .includes(rôle) sur un endpoint API. |

## Domaine : pages transverses (1 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/app/workspaces/page.js` | 25 | M5 | `const ROLE_LABEL_KEY = {` | à créer — à préciser manuellement | faible | Déclaration d'une constante de rôles (source d'allowlists). |

## Domaine : UI transverses (35 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/components/dashboard/ProfileView.js` | 320 | M3 | `if (active.some((entry) => entry.role === role)) return role;` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/dashboard/UnifiedDashboard.js` | 290 | M3 | `const isSuperAdmin = user?.role === "super_admin";` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/dashboard/unified-dashboard/MyProjectsCard.js` | 42 | M3 | `{project.role === "owner"` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/dashboard/unified-dashboard/constants.js` | 182 | M5 | `export const ROLE_HIERARCHY = {` | à créer — à préciser manuellement | faible | Déclaration d'une constante de rôles (source d'allowlists). |
| `src/components/layout/DashboardLayout.js` | 283 | M3 | `if (user.role !== "program_manager" && user.role !== "super_admin") {` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/DashboardLayout.js` | 287 | M3 | `user.role === "super_admin"` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/DashboardLayout.js` | 325 | M4 | `if (!["staff", "program_manager"].includes(user.role)) return;` | à créer — à préciser manuellement | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/layout/shell/ShellHeader.js` | 179 | M4 | `if (notification.type === "announcement" && ["participant", "member", "founder"].includes(user?.role)) {` | à créer — à préciser manuellement | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/layout/shell/ShellHeader.js` | 185 | M3 | `if (role === "super_admin")` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/ShellHeader.js` | 187 | M3 | `else if (role === "staff")` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/ShellHeader.js` | 189 | M3 | `else if (role === "program_manager")` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/ShellHeader.js` | 191 | M3 | `else if (role === "participant")` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/ShellHeader.js` | 204 | M3 | `if (role === "super_admin")` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/SidebarContent.js` | 35 | M3 | `` const profileHref = `/${role === "super_admin" ? "admin" : role === "program_manager" ? "pm" : role === "facilitator" ? "facilitator" : role === "investor" ? "investor" : "participant"}/profile`; `` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/SidebarContent.js` | 310 | M4 | `{t(["participant", "member", "founder"].includes(role) ? "participant.template.mySpace" : "navigation.mainOperations")}` | à créer — à préciser manuellement | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/layout/shell/SidebarContent.js` | 347 | M4 | `{["participant", "member", "founder"].includes(role) ? <Link href={profileHref} onClick={() => setMobileMenuOpen(false)} aria-label={t(tnav("profile"))} data-nav-active={pathname === profileHref \|\| undefined} data-nav-depth={0} title={t(tnav("profile"))} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary font-semibold text-[13px]"><User className="w-4 h-4 flex-shrink-0" />{!collapsed && <span>{t(tnav("profile"))}</span>}</Link> : <>` | à créer — à préciser manuellement | faible | Test d'appartenance à une liste de rôles hors route API. |
| `src/components/layout/shell/useDashboardBadges.js` | 116 | M3 | `parsedUser.role === "super_admin"` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/useDashboardBadges.js` | 169 | M3 | `if (parsedUser.role !== "super_admin") return;` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/useDashboardBadges.js` | 191 | M3 | `if (parsedUser.role !== "program_manager") return;` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/useDashboardBadges.js` | 219 | M3 | `if (savedUser?.role !== "program_manager") return;` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/useDashboardBadges.js` | 231 | M3 | `if (savedUser?.role !== "program_manager") return;` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/layout/shell/useDashboardNavigation.js` | 80 | M7 | `const PERSONAL_ROLES = ["member", "founder", "participant", "team", "investor"];` | à créer — à préciser manuellement | faible | Liste des rôles « personnels » (routing/UX). |
| `src/components/layout/shell/useDashboardNavigation.js` | 118 | M7 | `PERSONAL_ROLES.includes(sessionRole) ? "/api/lms/my-learning?exists=1" : null,` | à créer — à préciser manuellement | faible | Liste des rôles « personnels » (routing/UX). |
| `src/components/layout/shell/useDashboardNavigation.js` | 131 | M7 | `if (PERSONAL_ROLES.includes(activeRole)) {` | à créer — à préciser manuellement | faible | Liste des rôles « personnels » (routing/UX). |
| `src/components/messaging/chat/getPermissions.js` | 4 | M3 | `const isSA = role === "super_admin";` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/chat/getPermissions.js` | 6 | M3 | `role === "staff" &&` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/chat/getPermissions.js` | 8 | M3 | `const isPM = role === "program_manager";` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/chat/getPermissions.js` | 9 | M3 | `const isParticipant = role === "participant";` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/chat/getPermissions.js` | 56 | M3 | `contact.role === "participant" &&` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/chat/getPermissions.js` | 62 | M3 | `if (contact.role !== "participant" && userProgramIds.length > 0) {` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/hooks/useDerivedData.js` | 17 | M3 | `if (role === "super_admin") return [];` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/hooks/useDerivedData.js` | 18 | M3 | `if (role === "staff") return [];` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/hooks/useDerivedData.js` | 19 | M3 | `if (role === "program_manager") {` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/hooks/useDerivedData.js` | 24 | M3 | `if (role === "participant") {` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |
| `src/components/messaging/hooks/useDerivedData.js` | 39 | M3 | `if (role === "participant" \|\| role === "founder") return true;` | à créer — à préciser manuellement | faible | Branchement de rôle côté rendu (UX) ; non décisionnel si l'API est protégée. |

## Domaine : lib / plateforme (17 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/lib/api/createHandler.js` | 18 | M2 | `*   export const POST = createHandler({ roles: ['super_admin'] }, async (req) => {` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Allowlist de rôles en dur via createHandler({roles}) sur un endpoint API. |
| `src/lib/context.js` | 33 | M3 | `role === "founder";` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/lib/featureAccess.js` | 129 | M4 | `if (WARNING_BYPASS_ROLES.includes(role)) return false;` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/lib/featureAccess.js` | 136 | M4 | `return !allowed.includes(role);` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/lib/identity.js` | 28 | M4 | `return BASELINE_IDENTITIES.includes(role);` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/lib/masterNavigation.js` | 10 | M6 | `*   ROLE_ACCESS (flat id masks + href/icon overrides per role)` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation.js` | 17 | M6 | `*   are a ROUTING concern, resolved via ROLE_ACCESS.hrefs — never by` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation.js` | 19 | M6 | `* - ROLE_ACCESS contains only pointers (ordered id arrays) and overrides —` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/access.js` | 10 | M6 | `// ROLE_ACCESS — flat access/context data per role. Pointers only:` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/access.js` | 21 | M5 + M6 | `export const ROLE_ACCESS = {` | à créer — à préciser manuellement | faible | Déclaration d'une constante de rôles (source d'allowlists). Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/builders.js` | 10 | M6 | `ROLE_ACCESS,` | à créer — à préciser manuellement | faible | Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/builders.js` | 15 | M6 | `// Fallback access for a role absent from ROLE_ACCESS (an unknown/legacy` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/builders.js` | 40 | M6 | `ROLE_ACCESS[role] \|\|` | à créer — à préciser manuellement | faible | Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/builders.js` | 41 | M6 | `ROLE_ACCESS[LEGACY_PROFILE_SURFACES[role]] \|\|` | à créer — à préciser manuellement | faible | Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/builders.js` | 58 | M6 | `ROLE_ACCESS.super_admin.children[node.id] \|\|` | à créer — à préciser manuellement | faible | Référence au masque de navigation par rôle (routing/UX). |
| `src/lib/masterNavigation/builders.js` | 100 | M3 | `const canOpenAdmin = role === "super_admin";` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/lib/notificationLinks.js` | 50 | M4 | `["staff", "super_admin", "program_manager"].includes(role);` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |

## Domaine : services transverses (41 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/services/communications/announcements.js` | 35 | M3 | `isSuperAdmin: session.role === "super_admin",` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/announcements.js` | 97 | M3 | `if (existing.rows[0].author_id !== session.cid && session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/announcements.js` | 126 | M3 | `if (existing.rows[0].author_id !== session.cid && session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/inboxNotifications.js` | 32 | M4 | `!INBOX_ADMIN_ROLES.includes(session.role)` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/communications/inboxNotifications.js` | 44 | M4 | `!INBOX_ADMIN_ROLES.includes(session.role)` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/communications/inboxNotifications.js` | 52 | M4 | `INBOX_ADMIN_ROLES.includes(session.role)` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/communications/internal-comms/inbox.js` | 10 | M3 | `return session.role === "super_admin" \|\| cid === session.cid;` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/internal-comms/read.js` | 23 | M3 | `session.role !== "super_admin"` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/internal-comms/scope.js` | 107 | M4 | `["staff", "intern"].includes(contact.role);` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/communications/internal-comms/scope.js` | 166 | M3 | `if (session.role === "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/internal-comms/send.js` | 29 | M3 | `if (effectiveSenderId !== sessionCid && session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/internal-comms/send.js` | 34 | M3 | `if (target_type === "all" && session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/internal-comms/send.js` | 40 | M3 | `if (session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/ventureNotifications.js` | 21 | M3 | `session.role !== "super_admin"` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/communications/ventureNotifications.js` | 32 | M3 | `session.role === "super_admin"` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/alternativeEmails.js` | 27 | M3 | `if (session?.role === "super_admin") return true;` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/alternativeEmails.js` | 28 | M4 | `if (!PRIVILEGED.includes(session?.role)) return false;` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/contacts/registration.js` | 102 | M3 | `typeof contact.role === "string" ? contact.role.trim() : "";` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/registryRead.js` | 47 | M3 | `} else if (statusFilter === "archived" && session.role === "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/registryRead.js` | 52 | M3 | `} else if (session.role === "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/registryRead.js` | 90 | M3 | `participantCids.has(safeContact.cid) \|\| safeContact.role === "participant",` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/timeline.js` | 25 | M3 | `if (session.role === "participant" \|\| session.role === "founder") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/timeline.js` | 35 | M3 | `if (session.role === "program_manager") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/contacts/update.js` | 101 | M4 | `const isRolePromotion = Boolean(data.role) && NON_PARTICIPANT_ROLES.includes(data.role);` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/dashboard/opReports.js` | 57 | M3 | `if (session.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/dashboard/opReports.js` | 71 | M3 | `isSuperAdmin: session.role === "super_admin",` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/dashboard/opReports.js` | 138 | M3 | `const workspace = payload.user_role === "intern" ? "interns" : "main";` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/dashboard/overview/build.js` | 49 | M3 | `const isSessionAdmin = session.role === "super_admin" \|\| session.role === "admin";` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/dashboard/userAdmin.js` | 106 | M3 | `actor?.role === "super_admin"` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/platform/intents/delete.js` | 30 | M3 | `session.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/platform/intents/detail.js` | 37 | M3 | `session.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/platform/intents/list.js` | 24 | M3 | `session.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/platform/intents/list.js` | 36 | M3 | `isSuperAdmin: session.role === "super_admin",` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/platform/intents/update.js` | 44 | M3 | `session.role !== "super_admin" &&` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/projects/collaboration.js` | 285 | M3 | `if (!isInviter && role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/workspace/calendar.js` | 73 | M3 | `` * facilitator assignment, so keying this on `role === 'facilitator'` left every `` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Décision métier basée sur le nom du rôle. |
| `src/services/workspace/calendar.js` | 91 | M4 | `if (!sessionCid \|\| PROGRAM_UNSCOPED_ROLES.includes(role)) return none;` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/workspace/calendar.js` | 121 | M3 | `if (role === "participant" && sessionCid) {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/workspace/calendar.js` | 127 | M3 | `if (role !== "super_admin" && sessionCid) {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/services/workspace/calendar.js` | 157 | M4 | `PRIVILEGED_VENTURE_ROLES.includes(role) && !personalMode;` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/services/workspace/navigation.js` | 275 | M3 | `session.role !== "member"` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |

## Domaine : models transverses (5 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/models/communications/followups.js` | 56 | M3 | `if (session?.role === "participant") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/models/communications/followups.js` | 59 | M3 | `} else if (session?.role !== "super_admin") {` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/models/contacts/directory.js` | 42 | M3 | `role === "program_manager" ? "status IN ('active', 'pending')" : "status = 'active'";` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |
| `src/models/platform/registry.js` | 111 | M4 | `return module.permissions.includes(role);` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/models/platform/roles.js` | 117 | M5 | `export const ROLE_HOME = {` | à créer — à préciser manuellement | faible | Déclaration d'une constante de rôles (source d'allowlists). |

## Domaine : autres (4 lignes)

| Fichier | Ligne | Mécanisme | Extrait exact | Capacité équivalente (moteur) | Risque | Justification |
|---|---:|---|---|---|---|---|
| `src/server/auth/guards.js` | 32 | M4 | `if (allowedRoles && !allowedRoles.includes(session.role)) {` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/server/auth/guards.js` | 43 | M1 | `*   const authError = await requireAuth(['super_admin']);` | à créer — à préciser manuellement | faible | Commentaire / JSDoc — non exécuté. Appel requireAuth([rôles]) hors route API. |
| `src/server/auth/guards.js` | 56 | M4 | `if (allowedRoles && !allowedRoles.includes(session.role)) {` | à créer — à préciser manuellement | moyen | Test d'appartenance à une liste de rôles hors route API. |
| `src/server/auth/session.js` | 235 | M3 | `session.role !== "super_admin"` | à créer — à préciser manuellement | moyen | Décision métier basée sur le nom du rôle. |

## Hors production — `src/__tests__` (hors inventaire)

Ces occurrences ne sont pas des contrôles déployés ; elles ne sont pas comptées dans l'inventaire de production mais expliquent une partie des écarts :

| Mécanisme | Occurrences dans `src/__tests__` |
|---|---:|
| M1 requireAuth([rôles]) | 4 |
| M2 roles: [...] / allowed_roles: [...] | 30 |
| M3 role === / role !== | 12 |
| M4 .includes(…role…) | 44 |
| M5 const ROLE… | 1 |
| M6 ROLE_ACCESS[…] (masque nav) | 7 |
| M7 PERSONAL_ROLES | 1 |
| M8 role_capabilities (legacy) | 6 |
| M9 requireVentureAccess(…) | 20 |

## Zones non couvertes / incertitudes

- **`requireVentureScopedAccess(`** (65 en production) et **`hasVentureCapability(`** (8 en production) sont des gardes jouxtant le moteur (capacité + appartenance / capacité venture). Ils ne sont pas des contrôles *par rôle* et ne sont donc pas inventoriés ligne à ligne ; ils sont signalés ici pour mémoire.
- **`requireAuth()` sans tableau** (authentification seule, sans rôle) : inclus dans le total `requireAuth(` (229 en production) mais hors des lignes par rôle.
- **`createHandler(fn)` sans `roles`** : 238 appels `createHandler(` en production ; seuls ceux portant `roles: [...]` (mécanisme M2) sont listés.
- **Extraits multilignes** : `rg -n` renvoie la ligne du motif ; un tableau de rôles écrit sur plusieurs lignes apparaît par sa ligne d'ouverture (ex. `roles: [`), le contenu du tableau n'étant pas sur la ligne. Aucune ligne n'est inventée pour autant.
- **Faux positifs possibles** : les motifs `role`, `roles:` et `.includes(` peuvent apparaître dans des commentaires ou des noms de variables non autoritatives (ex. `contact.role`, `session.role`) ; le motif `roles:` capture en outre les champs de données `allowed_roles`. Les lignes de commentaire sont marquées « Commentaire / JSDoc — non exécuté » avec risque `faible`. Chaque extrait est fourni pour vérification manuelle.
- **Colonnes « Capacité équivalente » et « Risque » = première passe heuristique** (dérivée du chemin et du mécanisme), à valider site par site. Lorsqu'aucune capacité n'est identifiable automatiquement, la mention « à créer — à préciser manuellement » est portée plutôt qu'une capacité inventée.
- **Fichiers du moteur exclus** : `src/server/authz/**`, `src/models/authorization/**`, `src/services/authorization/**`. Le fichier de définition `src/server/auth/guards.js` (qui *implémente* `requireAuth` / `requireSession`) n'est pas un dossier moteur `authorization` ; il apparaît dans l'inventaire : ses deux lignes `allowedRoles.includes(session.role)` (définition du mécanisme) et un exemple JSDoc `requireAuth(['super_admin'])` (commentaire, risque faible).
- **Périmètre** : seuls les fichiers `*.js` sous `src/` sont couverts (pas de `.jsx`, `.ts`, `.mjs`). `node_modules`, `.next`, `coverage` sont exclus (ignorés par ripgrep).

*Total lignes de production inventoriées : 561*

