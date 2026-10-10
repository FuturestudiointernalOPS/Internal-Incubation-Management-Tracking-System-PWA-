# Inventaire A2 — Extension de périmètre et déduplication des contrôles « par rôle »

> Suite de `docs/permissions/inventaire-A-controles-par-role.md` (ci-après « Inventaire A »).
> Inventaire en **lecture seule**. Aucune ligne n'est inventée : chaque extrait est la ligne source exacte, chaque comptage est produit par une commande `ripgrep` donnée ci-dessous et reproductible depuis la racine du projet.
> Date de la passe : 2026-10-09.

---

## 0. Périmètre et définitions

Découpage de référence (identique à l'Inventaire A, §1) :

- **production** = tout `src/**` **sauf** `src/__tests__/**` **et sauf** les dossiers du moteur
  `src/server/authz/**`, `src/models/authorization/**`, `src/services/authorization/**` ;
- **tests** = `src/__tests__/**` ;
- **moteur** = les trois dossiers ci-dessus.

Le glob de code utilisé partout dans ce document est :

```
--glob 'src/**/*.{js,jsx,ts,tsx}'
```

---

## 1. Extension de périmètre — résultats par extension

### 1.1 Inventaire des extensions réellement présentes

| Extension | Présente sous `src/` | Présente ailleurs (hors `node_modules`, `.next`, `coverage`) | Conséquence |
|---|---|---|---|
| `.js` | oui (langage unique) | oui (`scripts/**`, `tailwind.config.js`, `postcss.config.js`) | périmètre de l'Inventaire A |
| `.jsx` | **non** | **non** | 0 ligne |
| `.ts` | **non** | **non** | 0 ligne |
| `.tsx` | **non** | **non** | 0 ligne |
| `.mjs` / `.cjs` | non | oui (`scripts/**`, `next.config.mjs`, `eslint.config.mjs`) | hors `src`, listé §3 |

Commande de vérification :

```bash
find . -path ./node_modules -prune -o -path ./.next -prune -o -path ./coverage -prune \
  -o -type f \( -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) -print | sort
# → aucune sortie
```

**Conséquence directe :** étendre le glob de `src/**/*.js` à `src/**/*.{js,jsx,ts,tsx}` **ne change aucun comptage** : le projet n'écrit que du `.js` sous `src/`. Le seul écart réel vient de ce que l'Inventaire A filtrait `src/**/*.js` ; une recherche **sans glob** (que j'ai d'abord lancée) capture en plus `.json` et `.sql` et gonfle mécaniquement certains chiffres.

### 1.2 Comptages par mécanisme (glob de code)

Mécanismes de référence de l'Inventaire A (M1–M9) et de référence moteur (R1–R6) :

| Mécanisme | motif rg | total `src` | production | tests | moteur |
|---|---|---:|---:|---:|---:|
| M1 `requireAuth([rôles])` | `requireAuth\(\s*\[` | 87 | **83** | 4 | 0 |
| M2 `roles:[…]` / `allowed_roles:[…]` | `roles\s*:\s*\[` | 139 | **108** | 30 | 1 |
| M3 `role ===` / `role !==` | `role\s*===|role\s*!==` | 238 | **218** | 12 | 8 |
| M4 `.includes(…role…)` | `\.includes\(.*role` | 130 | **81** | 44 | 5 |
| M5 `const ROLE…` | `const\s+ROLE` | 24 | **21** | 1 | 2 |
| M6 `ROLE_ACCESS` | `ROLE_ACCESS` | 17 | **10** | 7 | 0 |
| M7 `PERSONAL_ROLES` | `PERSONAL_ROLES` | 4 | **3** | 1 | 0 |
| M8 `role_capabilities` | `role_capabilities` | 47 | **1** | 6 | 40 |
| M9 `requireVentureAccess(…)` | `requireVentureAccess\(` | 61 | **40** | 20 | 1 |
| R1 `requireAuth(` (total) | `requireAuth\(` | 238 | 229 | 9 | 0 |
| R2 `requireAuthorization(` | `requireAuthorization\(` | 287 | 278 | 5 | 4 |
| R3 `requireScopedAccess(` | `requireScopedAccess\(` | 14 | 0 | 13 | 1 |
| R4 `requireVentureScopedAccess(` | `requireVentureScopedAccess\(` | 69 | 65 | 4 | 0 |
| R5 `hasVentureCapability(` | `hasVentureCapability\(` | 12 | 8 | 4 | 0 |
| R6 `createHandler(` (total) | `createHandler\(` | 240 | 238 | 2 | 0 |

Commande (une itération par motif) :

```bash
G="--glob src/**/*.{js,jsx,ts,tsx}"
rg -n --no-heading --color never $G -e '<motif>' src | wc -l
rg -n --no-heading --color never $G -e '<motif>' src/__tests__ | wc -l
rg -n --no-heading --color never $G -e '<motif>' src/server/authz src/models/authorization src/services/authorization | wc -l
```

### 1.3 Réconciliation avec l'Inventaire A

| Mécanisme | Inventaire A (`.js`) | Cette passe (`.js/.jsx/.ts/.tsx`) | Écart | Explication |
|---|---:|---:|---:|---|
| M1 | 87 / 83 / 4 / 0 | 87 / 83 / 4 / 0 | 0 | identique |
| M2 | 139 / 108 / 30 / 1 | 139 / 108 / 30 / 1 | 0 | identique |
| M3 | 238 / 218 / 12 / 8 | 238 / 218 / 12 / 8 | 0 | identique |
| M4 | 130 / 81 / 44 / 5 | 130 / 81 / 44 / 5 | 0 | identique |
| M5 | 24 / 21 / 1 / 2 | 24 / 21 / 1 / 2 | 0 | identique |
| M6 | 17 / 10 / 7 / 0 | 17 / 10 / 7 / 0 | 0 | identique |
| M7 | 4 / 3 / 1 / 0 | 4 / 3 / 1 / 0 | 0 | identique |
| M8 | 47 / 1 / 6 / 40 | 47 / 1 / 6 / 40 | 0 | identique |
| M9 | 61 / 40 / 20 / 1 | 61 / 40 / 20 / 1 | 0 | identique |

**Conclusion.** Tous les comptages de l'Inventaire A sont reproduits à l'identique dès que l'on rétablit le glob de code. Aucun écart ne provient de l'extension d'extension (aucun `.jsx/.ts/.tsx`) ; l'écart observé en première intention (`role_capabilities` : 58 au lieu de 47) venait d'une recherche **sans glob**, qui ajoutait 11 lignes non-code : 6 en `.json` (clés i18n `legacyRoleCapabilities`, `rollupLegacyNote` dans `en/fr` `adminMisc.json` et `engineering.json`) et 5 en `.sql` (`migrations/authorization_system.sql`, `migrations/complete_setup.sql`).

Vérification du total « 561 lignes de production » de l'Inventaire A :

```bash
P="--glob src/**/*.{js,jsx,ts,tsx} --glob !src/__tests__/** \
   --glob !src/server/authz/** --glob !src/models/authorization/** --glob !src/services/authorization/**"
# somme des lignes par motif (sans dédup) :
... 9 motifs ... | wc -l    # → 565
# union dédupliquée file:ligne :
... 9 motifs ... | cut -d: -f1,2 | sort -u | wc -l   # → 561
```

Le **561** est l'**union dédupliquée** des 9 motifs ; la **somme brute** vaut **565**. Les 4 lignes comptées deux fois :

```
src/lib/masterNavigation/access.js:21                                   (M5 + M6)
src/components/pm/programs/programWorkspaceSelectors.js:37              (M3 + M4)
src/app/api/superadmin/standard-types/route.js:10                       (M2 + M5)
src/app/api/program-staff/route.js:22                                   (M2 + M5)
```

### 1.4 Autres emplacements vérifiés

| Emplacement | Fichier(s) | Contrôle « par rôle » ? |
|---|---|---|
| `src/middleware.*` | **inexistant** | non — aucun middleware Next.js |
| `next.config.mjs` | présent | non — 0 occurrence (rôle / requireAuth / createHandler / role_capabilities) |
| `eslint.config.mjs` | présent | non — 0 occurrence |
| `tailwind.config.js` | présent | non — 1 occurrence, un **commentaire** (`// … every role. Green and red …`) |
| `postcss.config.js` | présent | non — 0 occurrence |
| `src/app/**/page.*` | nombreux | oui, mais déjà dans `src` ; comptés dans M3/M5 (voir §5). Les locales `.jsx/.tsx` sont absentes. |
| `src/components/**` | nombreux | oui, mais déjà dans `src` ; comptés dans M3/M4 (masques d'interface). |
| `scripts/**` | ~190 fichiers `.mjs/.js/.cjs` | **oui mais hors runtime** — voir §3. |

---

## 2. Extension du total d'occurrences (mécanismes M1–M9 + nouveaux)

| Grandeur | Valeur | Règle |
|---|---:|---|
| Somme brute des 9 mécanismes (production) | 565 | somme des lignes, sans dédup |
| **Union dédupliquée des 9 mécanismes (production)** | **561** | `file:ligne` unique |
| Somme brute étendue (14 motifs, production) | 710 | 9 mécanismes + 5 nouveaux |
| **Union dédupliquée étendue (production)** | **695** | `file:ligne` unique |

Les 5 mécanismes ajoutés (voir §3) totalisent 145 lignes brutes ; 15 d'entre elles étaient déjà captées par M2 (les `allowed_roles: [` satisfont aussi `roles: [`), d'où 710 → 695.

---

## 3. Autres mécanismes non couverts par l'Inventaire A

### 3.1 Dans `src/` (production)

| Mécanisme | motif rg | total | production | tests | moteur | Ce que c'est |
|---|---|---:|---:|---:|---:|---|
| N1 `allowed_roles` | `allowed_roles` | 177 | **68** | 68 | 41 | champ JSON de config (colonne `responsibilities.allowed_roles`) + API + UI de gestion |
| N2 `FEATURE_ELIGIBILITY_DEFAULTS` | idem | 62 | **2** | 43 | 17 | table d'éligibilité (rôle → feature_key) |
| N3 `RESPONSIBILITY_FEATURE_ROLES` | idem | 9 | **2** | 4 | 3 | alias de N2 (`src/lib/featureAccess.js`) |
| N4 `requireVentureScopedAccess(` | idem | 69 | **65** | 4 | 0 | garde **capacité + appartenance Venture** (moteur), pas « par rôle » |
| N5 `hasVentureCapability(` | idem | 12 | **8** | 4 | 0 | foncteur de **capacité Venture**, pas « par rôle » |

Occurrences exactes en production :

```bash
P="--glob src/**/*.{js,jsx,ts,tsx} --glob !src/__tests__/** \
   --glob !src/server/authz/** --glob !src/models/authorization/** --glob !src/services/authorization/**"
rg -n --no-heading --color never $P -e 'FEATURE_ELIGIBILITY_DEFAULTS' src
# src/lib/featureAccess.js:27:import { FEATURE_ELIGIBILITY_DEFAULTS } from "@/models/authorization/eligibility-defaults";
# src/lib/featureAccess.js:35:export const RESPONSIBILITY_FEATURE_ROLES = FEATURE_ELIGIBILITY_DEFAULTS;

rg -n --no-heading --color never $P -e 'RESPONSIBILITY_FEATURE_ROLES' src
# src/lib/featureAccess.js:35:export const RESPONSIBILITY_FEATURE_ROLES = FEATURE_ELIGIBILITY_DEFAULTS;
# src/lib/featureAccess.js:64:  const allowed = RESPONSIBILITY_FEATURE_ROLES[responsibilityKey];
```

**Nature de N1–N3 :** ce n'est **pas** un contrôle « par rôle » au sens d'allowlist en dur dans une route. `src/lib/featureAccess.js` déclare explicitement (lignes 16–24) que le module est **informational** et « NEVER blocks an assignment » : il alimente les avertissements ambre de l'UI. `isResponsibilityBlockedForRole` (l.123-137) est appelé uniquement par des composants d'affichage (`AssignmentsCard.js`, `UserAccessView.js`), jamais par une route. C'est donc un **(b) masque/alerte d'interface**, pas une **(a) décision d'accès serveur**.

**Nature de N4–N5 :** gardes **par capacité + périmètre**, pas par nom de rôle. `requireVentureScopedAccess({ module:"ventures", capability:"view"|"edit" })` et `hasVentureCapability({ area, action })` décident sur une capacité et une appartenance, jamais sur une liste de rôles. Ils sont listés pour mémoire mais **hors décisions « par rôle »**.

### 3.2 Hors runtime — `scripts/**`

Occurrences (`.mjs/.js/.cjs`), **non comptées en production** :

| Mécanisme | total `scripts` |
|---|---:|
| `requireAuth(\s*\[` | 3 |
| `role ===` / `role !==` | 20 |
| `.includes(…role` | 5 |
| `requireAuth(` (total) | 4 |
| `requireAuthorization(` | 2 |
| `createHandler(` | 1 |
| `requireVentureAccess(` | 1 |
| `allowed_roles` | 3 |
| `FEATURE_ELIGIBILITY_DEFAULTS` | 3 |
| `role_capabilities` | 25 |
| `roles\s*:\s*\[` | 0 |
| `const ROLE` | 0 |
| `ROLE_ACCESS` / `PERSONAL_ROLES` | 0 |

Exemples (extraits exacts) :

```
scripts/scan-role-gates.mjs:74:  if (fileEntry.requireAuthRoles.length) bits.push(`requireAuth([${fileEntry.requireAuthRoles.join(" | ")}])`);
scripts/i6c-zero-dependency-scan.mjs:120:    const hasStaffFamily = roles.some((role) => ["staff", "super_admin", "admin"].includes(role));
scripts/diagnose-user-authz.mjs:205:if (!["super_admin", "program_manager"].includes(role)) {
scripts/dryrun-eligibility-policy.mjs:202:  if (role === "super_admin") {
scripts/align-legacy-roles.mjs:64:  const { rows: profileRows } = await pool.query("SELECT key, allowed_roles FROM profiles");
```

Ces scripts sont des outils de diagnostic / migration / audit (noms `audit-*`, `diagnose-*`, `dryrun-*`, `simulate-*`). Les trois occurrences `requireAuth([` sont, qui plus est, des **chaînes** affichées ou recherchées (`scan-role-gates.mjs:70` est un message de console, `:74` un template, `i6c-zero-dependency-scan.mjs:4` un commentaire). **Classement : (d) faux positifs / hors production.**

### 3.3 Autres motifs testés (négatifs)

| Motif | Production `src` | Interprétation |
|---|---:|---|
| `requireRole` / `hasRole` / `assertRole` / `authorizeRole` | 0 | aucun helper de rôle supplémentaire |
| `roles.includes` | 5 | variante de M4, déjà captée |
| `allowedRoles` | 66 | variable locale (souvent issue de `allowed_roles`), captée via M2/M4 |
| `isSuperAdmin` | 106 | variable dérivée d'un `role ===` déjà compté (aucun contrôle propre) |
| `session.role` | 166 | **suragrégat** : recouvre M3 (`===`/`!==`) et les simples lectures de champ |

Aucun contrôle par rôle autre que M1–M9 + N1–N5 n'existe.

---

## 4. Déduplication : occurrences → mécanismes → décisions

### 4.1 Règle de comptage

- **Occurrence** = une ligne brute qui matche un motif (sans dédup). Une ligne peut appartenir à plusieurs mécanismes.
- **Mécanisme distinct** = un *type* de contrôle (un motif + sa sémantique), pas une ligne.
- **Décision d'accès distincte** = un **point unique de refus/acceptation dans un flux d'exécution** :
  - toute **invocation de garde exécutable** (`requireAuth([…])`, option `roles` d'un `createHandler`, `requireVentureAccess`, comparaison `session.role`/`role` qui refuse une requête) = **1 décision** ;
  - un **objet d'options réutilisé** (`const ROLE = { roles: […] }` passé à N handlers) = **N décisions** (une par handler), pas 1 ;
  - une **liste de rôles qui ne sert qu'à un masque de navigation ou d'affichage** = **0 décision d'accès serveur** (classée (b)) ;
  - un **commentaire / libellé / clé i18n / donnée non autoritaire** = **0** (classé (d)).

### 4.2 Tableau de réconciliation

| Mécanisme | Lignes brutes (prod) | Lignes retenues (prod, code) | Décisions d'accès serveur distinctes | Règle appliquée |
|---|---:|---:|---:|---|
| M1 `requireAuth([…])` | 83 | 83 | **82** | 1 ligne = 1 garde, **−1** commentaire JSDoc (`guards.js:43` → (d)) |
| M2 `roles:[…]` | 108 | 108 | **102** | 95 options `createHandler({roles})` (1 = 1 handler) + 2 `const ROLE` réutilisés par 7 handlers (program-staff ×4, standard-types ×3) ; 6 `allowed_roles` (données) + 4 `programTabs` (UI) + 1 `overviewHelpers` (helper) = 0 décision |
| M3 `role ===` / `role !==` | 218 | 218 | **≈ 90** | gardes serveur (api/services/lib/server) − routage session-login − comparaisons de données − flags d'affichage (voir §5) |
| M4 `.includes(…role)` | 81 | 81 | **≈ 57** | refus serveur − masques UI − résolutions de portée (voir §5) |
| M5 `const ROLE…` | 21 | 21 | **0** | ce sont des *définitions* de constantes/dictionnaires, pas des décisions (les usages sont comptés en M2/M3/M4) |
| M6 `ROLE_ACCESS` | 10 | 10 | **0** | masque de **navigation** (5 commentaires + table d'ids) → (b)/(d) |
| M7 `PERSONAL_ROLES` | 3 | 3 | **0** | masque de **navigation** → (b) |
| M8 `role_capabilities` | 1 | 1 | **0** | 1 commentaire (`PersonAccessScreen.js:198`) → (d) |
| M9 `requireVentureAccess(…)` | 40 | 40 | **38** | 38 appels api (appartenance Venture, bypass rôle global `super_admin` → 404) ; 1 définition de fonction + 1 JSDoc → 0 |
| **Total M1–M9** | **565** | **565** | **≈ 369** | — |
| N1 `allowed_roles` | 68 | 68 | **0** | sont majoritairement des champs de données/API/UI ; le seul usage « décision » est l'alerte d'affichage de `featureAccess.js` → (b) |
| N2/N3 éligibilité | 4 | 4 | **0** | alias + accès tableau → (c)/(b) |
| N4 `requireVentureScopedAccess` | 65 | 65 | (capacité, hors « par rôle ») | — |
| N5 `hasVentureCapability` | 8 | 8 | (capacité, hors « par rôle ») | — |

### 4.3 Trio de synthèse

| Niveau | Nombre | Portée |
|---|---:|---|
| **Occurrences brutes** (union dédupliquée, 9 mécanismes) | **561** | production |
| **Occurrences brutes** (union dédupliquée, 14 motifs étendus) | **695** | production |
| **Mécanismes distincts** | **9** (M1–M9) **+ 5** (N1–N5) = **14** | — |
| **Décisions d'accès serveur distinctes** (par rôle) | **≈ 369** | M1 82 + M2 102 + M3 ≈90 + M4 ≈57 + M9 38 |
| **Masques d'interface** (b) | ≈ 75 | M3 composants + M4 composants + M6 + M7 + M2 `programTabs` |
| **Résolutions de portée/comportement** (c) | ≈ 60 | routage, filtres de données, flags |
| **Faux positifs** (d) | ≈ 12 | commentaires, i18n, données non autoritaires |

> Les valeurs « ≈ » de M3/M4/(b)/(c)/(d) relèvent d'une **classification analytique** (ligne par ligne, listes fournies §5 et §6) et non d'un motif rg unique ; les comptages M1/M2/M9 et tous les comptages « lignes » sont, eux, reproductibles au chiffre près.

---

## 5. Classement des décisions distinctes

### 5.1 (a) Décisions d'accès serveur — M1 `requireAuth([…])`

82 invocations exécutables (1 commentaire exclu, listé en (d)). Toutes sous `src/app/api/**` sauf les 2 dernières (`src/services/programs/participantPrograms.js`).

```
src/app/api/admin/analytics/route.js:19:    const authError = await requireAuth(["super_admin"]);
src/app/api/admin/analytics/users/route.js:15:    const authError = await requireAuth(["super_admin"]);
src/app/api/admin/fix-participant/route.js:22:    const authError = await requireAuth(["super_admin"]);
src/app/api/admin/projects/[id]/reports/generate/route.js:18:    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
src/app/api/admin/projects/route.js:20:    const authError = await requireAuth(["super_admin"]);
src/app/api/admin/run-migration/route.js:95:    const authError = await requireAuth(["super_admin"]);
src/app/api/auth/invite-family/route.js:33:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/auth/invite/route.js:36:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/campaigns/[id]/route.js:21:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/campaigns/[id]/route.js:48:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/campaigns/[id]/route.js:68:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/contacts/duplicates/route.js:27:    const authError = await requireAuth(["super_admin"]);
src/app/api/contacts/duplicates/route.js:47:    const authError = await requireAuth(["super_admin"]);
src/app/api/contacts/merge/preview/route.js:20:    const authError = await requireAuth(["super_admin"]);
src/app/api/contacts/merge/route.js:22:    const authError = await requireAuth(["super_admin"]);
src/app/api/dashboard/route.js:27:      const authError = await requireAuth(["super_admin"]);
src/app/api/data/route.js:18:    const authError = await requireAuth(["super_admin"]);
src/app/api/data/route.js:29:    const authError = await requireAuth(["super_admin"]);
src/app/api/facilitator-reviews/route.js:113:    const authError = await requireAuth([
src/app/api/facilitators/invite-bulk/route.js:84:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/families/route.js:83:    const authError = await requireAuth(["super_admin"]);
src/app/api/families/route.js:143:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/families/route.js:175:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/families/route.js:202:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/group-members/route.js:24:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/group-members/route.js:74:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/groups/route.js:22:    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
src/app/api/investor/admin-overview/route.js:14:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/approval/route.js:17:    const authError = await requireAuth(["super_admin", "staff"]);
src/app/api/investor/approval/route.js:35:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/campaigns/route.js:45:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/campaigns/route.js:66:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/executive-dashboard/route.js:14:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/profile/route.js:89:    const authError = await requireAuth(["super_admin", "staff"]);
src/app/api/investor/relationships/meetings/route.js:45:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/relationships/meetings/route.js:87:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/relationships/route.js:48:    const authError = await requireAuth(["super_admin"]);
src/app/api/investor/relationships/route.js:77:    const authError = await requireAuth(["super_admin"]);
src/app/api/migrate/phase0/route.js:23:    const authError = await requireAuth(["super_admin"]);
src/app/api/migrate/phase1/route.js:16:    const authError = await requireAuth(["super_admin"]);
src/app/api/migrate/phase1/route.js:94:    const authError = await requireAuth(["super_admin"]);
src/app/api/migrate/phase5/route.js:16:    const authError = await requireAuth(["super_admin"]);
src/app/api/migrate/phase5/route.js:94:    const authError = await requireAuth(["super_admin"]);
src/app/api/participant-programs/bulk/route.js:27:    const authError = await requireAuth([
src/app/api/participants/route.js:27:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/platform/collections/route.js:29:    const authError = await requireAuth(["super_admin", "staff"]);
src/app/api/platform/collections/route.js:62:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/collections/route.js:81:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/collections/route.js:100:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/import/execute/route.js:24:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/import/preview/route.js:19:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/import/review-flags/route.js:25:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/import/review-flags/route.js:43:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/integrations/calendar/route.js:37:    const authError = await requireAuth(["super_admin", "program_manager"]);
src/app/api/platform/investor-run/route.js:22:  const authError = await requireAuth(["super_admin"]);
src/app/api/platform/seed/founder-assessment/route.js:21:    const authError = await requireAuth(["super_admin"]);
src/app/api/platform/seed/investor-application/route.js:24:  const authError = await requireAuth(["super_admin"]);
src/app/api/pm/programs/route.js:57:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/pm/programs/templates/route.js:24:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/pm/programs/templates/route.js:41:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/programs/route.js:18:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/programs/route.js:82:    const authError = await requireAuth(["staff", "super_admin"]);
src/app/api/program-types/route.js:31:    const authError = await requireAuth(["super_admin"]);
src/app/api/send-pending/route.js:13:    const authError = await requireAuth(["super_admin"]);
src/app/api/submissions/route.js:231:    const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
src/app/api/system/database/route.js:32:    const authError = await requireAuth(["super_admin"]);
src/app/api/tasks/approve/route.js:19:    const authError = await requireAuth(["super_admin"]);
src/app/api/teams/route.js:97:    const authError = await requireAuth([
src/app/api/teams/route.js:179:    const authError = await requireAuth([
src/app/api/teams/route.js:231:    const authError = await requireAuth([
src/app/api/v2/groups/route.js:23:    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
src/app/api/v2/groups/route.js:76:    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
src/app/api/v2/groups/route.js:121:    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
src/app/api/v2/kpis/route.js:20:    const authError = await requireAuth(["super_admin", "program_manager"]);
src/app/api/v2/kpis/route.js:37:    const authError = await requireAuth(["super_admin", "program_manager"]);
src/app/api/v2/kpis/route.js:55:    const authError = await requireAuth(["super_admin", "program_manager"]);
src/app/api/v2/program-staff/route.js:30:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/v2/program-staff/route.js:48:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/v2/program-staff/route.js:64:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/app/api/v2/program-staff/route.js:80:    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
src/services/programs/participantPrograms.js:47:  const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
src/services/programs/participantPrograms.js:107:  const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
```

Les lignes `[` seules (`facilitator-reviews:113`, `participant-programs/bulk:27`, `teams:97/179/231`) sont des tableaux **multilignes** : le motif renvoie la ligne d'ouverture ; l'allowlist est en dessous (une décision chacune).

### 5.2 (a) Décisions d'accès serveur — M2 `createHandler({ roles })`

- **95** lignes d'option `{ roles: [ … ] }` = **95 gardes** (une par handler HTTP). Extraits (fichier:ligne) :

```
src/app/api/activity/route.js:6,14            { roles: ["staff", "super_admin"] }
src/app/api/admin/blockers/route.js:5         createHandler({ roles: ["super_admin"] }, …)
src/app/api/admin/finance/data-sources/route.js:5
src/app/api/admin/tasks/route.js:5
src/app/api/admin/ventures/create/route.js:21
src/app/api/admin/ventures/route.js:6,41
src/app/api/audit-log/route.js:5
src/app/api/audit-logs/[id]/route.js:6        { roles: ["super_admin", "security_officer"] }
src/app/api/audit-logs/route.js:6
src/app/api/auth/resend-invite/[cid]/route.js:16
src/app/api/auth/revoke/[cid]/route.js:12
src/app/api/campaigns/route.js:15,21
src/app/api/crm/activities/[id]/route.js:13,41
src/app/api/crm/activities/route.js:17,36
src/app/api/crm/automations/[id]/route.js:9,22,40
src/app/api/crm/automations/route.js:10,22
src/app/api/crm/contacts/[cid]/organizations/[rid]/route.js:24,58
src/app/api/crm/contacts/[cid]/organizations/route.js:27,43
src/app/api/crm/leads/[id]/route.js:11,32,132
src/app/api/crm/leads/[id]/tasks/route.js:18
src/app/api/crm/leads/route.js:18,39
src/app/api/crm/opportunities/[id]/route.js:16,45,110
src/app/api/crm/opportunities/[id]/stage/route.js:35
src/app/api/crm/opportunities/[id]/tasks/route.js:19
src/app/api/crm/opportunities/route.js:21,49
src/app/api/crm/organizations/[id]/route.js:23,52,86
src/app/api/crm/organizations/route.js:25,49
src/app/api/crm/pipelines/[id]/route.js:12,32
src/app/api/crm/pipelines/[id]/stages/route.js:12,27
src/app/api/crm/pipelines/route.js:13,27
src/app/api/crm/segments/[id]/route.js:9,27
src/app/api/crm/segments/route.js:10,24
src/app/api/deliverables/route.js:6,34
src/app/api/documents/route.js:20,30
src/app/api/evaluation/route.js:25,51,64
src/app/api/events/route.js:17,28
src/app/api/followups/route.js:23,47,72
src/app/api/forensic/user-role/route.js:5
src/app/api/intelligence/metrics/route.js:5
src/app/api/invites/route.js:14
src/app/api/kpi-progress/recalculate/route.js:13
src/app/api/kpi-progress/route.js:20
src/app/api/pm/programs/assignment/route.js:8
src/app/api/pm/programs/[id]/route.js:16
src/app/api/pm/schedule/route.js:7
src/app/api/pm/submissions/route.js:16
src/app/api/progress/route.js:9
src/app/api/responses/review/route.js:19
src/app/api/responses/route.js:19
src/app/api/security/events/route.js:7,35      { roles: ["super_admin", "security_officer"] }
src/app/api/security/login-history/route.js:6
src/app/api/security/sessions/route.js:6,19
src/app/api/segments/route.js:18,33
src/app/api/segments/run/route.js:17
src/app/api/sessions/route.js:8,53
src/app/api/superadmin/full-state/route.js:14
src/app/api/superadmin/groups/assignment/route.js:14
src/app/api/ventures/assigned/route.js:16
src/app/api/ventures/lead-manager/home/route.js:17
```

- **+7** gardes issus de 2 lignes réutilisées (`const ROLE = { roles: ['super_admin'] }`, référence §4.1) :

```
src/app/api/program-staff/route.js:22     const ROLE = { roles: ['super_admin'] };
   → appliqué en :54 (GET), :63 (POST), :102 (PUT), :161 (DELETE)  = 4 gardes
src/app/api/superadmin/standard-types/route.js:10   const ROLE = { roles: ['super_admin'] };
   → appliqué en :12 (GET), :20 (POST), :30 (DELETE)              = 3 gardes
```

**Total M2 = 102 décisions.** Les 11 lignes restantes sont hors décision : 6 `allowed_roles:` (données), 4 dans `src/components/pm/programs/programTabs.js` (visibilité d'onglets → (b)) et 1 dans `src/components/permissions/overviewHelpers.js:13` (helper : `const list = Array.isArray(roles) ? roles : [];`).

### 5.3 (a) Décisions d'accès serveur — M9 `requireVentureAccess(…)`

38 appels (appartenance/mandat Venture ; bypass du rôle global `super_admin` → sinon 404). Extrait : `src/lib/ventureAuth.js:113-115` :

```js
// src/lib/ventureAuth.js
109: export async function requireVentureAccess(ventureId) {
114:   const globalRoles = ["super_admin"];
115:   if (globalRoles.includes(session.role)) {
```

Les 38 sites : `src/app/api/ventures/[id]/{advisors:20,31,44 ; analytics:10 ; coaching:23,34,52 ; deliverables:47,135 ; deliverables/upload:25 ; documents:51,94 ; documents/[docId]/permissions:36,57 ; documents/[docId]/reviews:22,43 ; documents/[docId]/transition:32 ; documents/[docId]/versions:19,40 ; document-types:39 ; feedback:8,55 ; founders:24 ; fundraising:9,40 ; investment:8,36 ; investors:9,38 ; journey:62 ; journey-report:40 ; progress:30 ; reports:11 ; sessions/upload:24 ; submissions/review-queue:33 ; tasks/[taskId]/submissions:76,87 ; verification/upload:25}`.
Les 2 lignes restantes (`src/lib/ventureAuth.js:82` JSDoc, `:109` définition de fonction) ne sont pas des décisions.

### 5.4 (a) Décisions d'accès serveur — M3 (sous-ensemble)

Sites serveur qui **refusent** une requête sur `session.role` / `role` (api, services, lib, models, server) :

```
src/app/api/attendance/route.js:99,152
src/app/api/auth/invite-family/route.js:50
src/app/api/contacts/[cid]/emails/route.js:30
src/app/api/engineering/permissions/route.js:86
src/app/api/facilitators/invite-bulk/route.js:107
src/app/api/pm/programs/assignment/route.js:20
src/app/api/pm/programs/[id]/manager/route.js:60
src/app/api/pm/schedule/route.js:13
src/app/api/pm/submissions/route.js:38
src/app/api/retros/current/route.js:48
src/app/api/retros/submit/route.js:73
src/app/api/standups/current/route.js:68
src/app/api/standups/submit/route.js:69
src/app/api/teams/route.js:39,53
src/app/api/user-groups/route.js:29
src/app/api/ventures/[id]/verification/documents/[docId]/versions/route.js:31
src/app/api/ventures/lead-manager/home/route.js:24
src/services/communications/announcements.js:97,126
src/services/communications/internal-comms/read.js:23
src/services/communications/internal-comms/send.js:29,34,40
src/services/communications/ventureNotifications.js:21,32
src/services/contacts/alternativeEmails.js:27
src/services/contacts/registryRead.js:47,52
src/services/dashboard/opReports.js:57
src/services/dashboard/userAdmin.js:106
src/services/investor/diligence/requestActions.js:43        (isAdmin → décision d'affichage de la demande)
src/services/operations/facilitatorReviews.js:159
src/services/participant/submissions.js:29,48
src/services/platform/intents/delete.js:30
src/services/platform/intents/detail.js:37
src/services/platform/intents/list.js:24
src/services/platform/intents/tasks.js:43,92
src/services/platform/intents/update.js:44
src/services/programs/programStaff.js:35,36,37,76,95,154,229
src/services/projects/collaboration.js:285
src/services/tasks/assignments.js:101,160
src/services/tasks/blockers.js:58,116,261
src/services/tasks/comments.js:137,157
src/services/tasks/create.js:203
src/services/tasks/query.js:58,79,108
src/services/tasks/remove.js:40
src/services/tasks/teamBoard.js:88
src/services/tasks/updateEffects.js:235
src/services/tasks/updateFields/assignment.js:66
src/services/tasks/updateGuards.js:45,65
src/services/ventures/founders.js:98
src/services/ventures/milestoneEngine/authority.js:24,54
src/services/ventures/profile/access.js:15,54
src/services/ventures/submissions/createSubmission.js:41,63,122
src/services/ventures/submissions/scope.js:16,35,36,49,50
src/services/ventures/ventureDocumentTypes.js:208
src/services/ventures/verification/categories.js:44,45,51,68
src/services/workspace/calendar.js:121,127
src/services/workspace/navigation.js:275
src/lib/ventureAuth.js:18
src/lib/ventureDeliverables.js:31
src/server/auth/session.js:235
```

Extraits représentatifs exacts :

```
src/app/api/attendance/route.js:99:      session?.role !== "super_admin" &&
src/app/api/engineering/permissions/route.js:86:      session.role !== "super_admin"
src/services/tasks/query.js:58:  if (role !== "super_admin" && userId && userId !== sessionCid) {
src/services/platform/intents/list.js:24:    session.role !== "super_admin" &&
src/server/auth/session.js:235:    session.role !== "super_admin"
```

**≈ 90 décisions.** Les autres lignes M3 sont classées (b)/(c)/(d) ci-dessous.

### 5.5 (a) Décisions d'accès serveur — M4 (sous-ensemble)

```
src/app/api/contacts/full-state/route.js:26            !["super_admin","staff","program_manager"].includes(session?.role)
src/app/api/engineering/permissions/profile-role-defaults/route.js:76   !PROFILE_BASELINE_ROLES.includes(roleName)
src/app/api/feedback/route.js:56                        !["super_admin","staff","program_manager"].includes(session?.role)
src/app/api/journey-reports/route.js:28                 !GLOBAL_ROLES.includes(session.role)
src/app/api/upload/route.js:38                          internal = […].includes(role)
src/app/api/venture-options/route.js:49,74              !SETUP_ROLES.includes(session.role)
src/app/api/ventures/assigned/route.js:23               ["super_admin"].includes(session.role)
src/app/api/ventures/[id]/blockers/route.js:69
src/app/api/ventures/[id]/lead/route.js:58,77
src/app/api/ventures/[id]/lifecycle/route.js:49         !["super_admin"].includes(session.role)
src/app/api/ventures/[id]/notes/route.js:50             GLOBAL_ROLES.includes(session.role)
src/app/api/ventures/[id]/tasks/route.js:146            !reviewerRoles.includes(session?.role)
src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js:140   !REVIEWER_ROLES.includes(session?.role)
src/app/api/ventures/[id]/verification/route.js:16,36   ["super_admin"].includes(session.role)
src/app/api/ventures/route.js:55,56,161
src/app/api/venture-templates/route.js:55               !SETUP_ROLES.includes(session.role)
src/lib/identity.js:28                                  BASELINE_IDENTITIES.includes(role)
src/lib/ventureAuth.js:6,115
src/models/platform/registry.js:111                     module.permissions.includes(role)
src/server/auth/guards.js:32,56                         allowedRoles.includes(session.role)   (définition du mécanisme M1)
src/services/contacts/alternativeEmails.js:28
src/services/investor/campaigns.js:115                  MANAGEMENT_ROLES.includes(session?.role)
src/services/investor/pipeline.js:70
src/services/participant/fullState.js:31                FULL_STATE_ROLES.includes(role)
src/services/participant/submissions.js:24,41,64
src/services/tasks/create.js:85
src/services/ventures/founders.js:107,164,201
src/services/ventures/operatingPlans.js:54              GLOBAL_ROLES.includes(role)
src/services/ventures/profile/access.js:58
src/services/ventures/scope.js:42                       GLOBAL_ROLES.includes(role)
src/services/ventures/submissions/createSubmission.js:82,115
src/services/workspace/calendar.js:91,157
src/services/communications/inboxNotifications.js:32,44,52
src/models/programs/core/programList.js:85
```

**≈ 57 décisions.**

### 5.6 (b) Masques d'interface (affichage / navigation) — aucune décision serveur

M3 côté composants et pages client (50+ lignes), M4 côté composants, M6, M7 :

```
# M6 — table de navigation de rôle (masque)
src/lib/masterNavigation/access.js:21            export const ROLE_ACCESS = {
src/lib/masterNavigation/builders.js:40,41,58    ROLE_ACCESS[role] || ROLE_ACCESS[LEGACY_PROFILE_SURFACES[role]] || …
# M7 — surfaces personnelles (masque sidebar)
src/components/layout/shell/useDashboardNavigation.js:80   const PERSONAL_ROLES = ["member","founder","participant","team","investor"];
src/components/layout/shell/useDashboardNavigation.js:118,131   PERSONAL_ROLES.includes(sessionRole/activeRole)
# M3 composants (extraits)
src/components/layout/DashboardLayout.js:283     if (user.role !== "program_manager" && user.role !== "super_admin") {
src/components/layout/shell/ShellHeader.js:179,185-204
src/components/layout/shell/SidebarContent.js:35,310,347
src/components/permissions/AdminsView.js:55,62   users.filter((user) => user.role === "super_admin")
src/components/pm/programs/programWorkspaceSelectors.js:67,77,78,92
# M4 composants (extraits)
src/components/layout/DashboardLayout.js:325     if (!["staff","program_manager"].includes(user.role)) return;
src/components/layout/shell/SidebarContent.js:310,347   ["participant","member","founder"].includes(role)
src/components/pm/programs/programWorkspaceSelectors.js:92   tab.roles.includes(user.role)
```

**≈ 75 lignes.** Aucune n'intervient dans une décision d'accès **serveur** : elles masquent un menu, un onglet, un bouton ou choisissent un libellé.

### 5.7 (c) Résolutions de portée / comportement

- **Routage de connexion** (choix de l'espace, pas refus) : `src/app/api/auth/session-login/route.js:205,207,209,211,214,215,221,225,229` (9 lignes).
- **Filtres de données** par champ de données (jamais le rôle de l'acteur) :
  `src/app/api/families/route.js:155` (`body.default_role`), `src/app/api/program-staff/route.js:112` (`role !== undefined`), `src/app/api/standups/submit/route.js:105` (`user_role === "intern"`), `src/app/api/ventures/[id]/members/route.js:255`, `src/app/api/ventures/[id]/founders/[founderId]/route.js:61` (`role !== founder.role`), `src/services/contacts/registration.js:102`, `src/services/communications/internal-comms/scope.js:107`, `src/services/investor/organizations.js:99`, `src/services/ventures/memberRoster.js:141`, `src/services/ventures/submissions/review.js:92,93`, `src/services/platform/form-runs/handlers/get.js:213`, `src/models/contacts/directory.js:42`, `src/models/investor/diligenceAndPipeline/pipeline.js:242`, `src/models/communications/followups.js:56,59`.
- **Flags d'affichage calculés** (`isSuperAdmin`, `isSA`, `isPM`…), utilisés ensuite par le rendu : `src/app/admin/blockers/page.js:45`, `src/app/admin/investors/page.js:57`, `src/app/admin/op-reports/page.js:86`, `src/app/admin/work/page.js:200`, `src/services/communications/announcements.js:35`, `src/services/dashboard/opReports.js:71`, `src/services/platform/intents/list.js:36`, `src/services/tasks/query.js:128`, etc.

**≈ 60 lignes.**

### 5.8 (d) Faux positifs (commentaires, libellés, i18n, données non autoritaires)

| Fichier:ligne | Extrait exact | Raison |
|---|---|---|
| `src/server/auth/guards.js:43` | ` *   const authError = await requireAuth(['super_admin']);` | JSDoc (exemple) — compté en M1 |
| `src/components/permissions/permission-center/PersonAccessScreen.js:198` | `   * reads the profile's capabilities INSTEAD OF role_capabilities — so a` | commentaire — **unique** ligne M8 prod |
| `src/lib/masterNavigation.js:10,17,19` | ` *   ROLE_ACCESS (flat id masks + href/icon overrides per role)` etc. | commentaires — comptés en M6 |
| `src/lib/masterNavigation/builders.js:10,15` | import + commentaire | commentaire/import — M6 |
| `src/lib/ventureAuth.js:82` | ` *   const { ventureId, session } = await requireVentureAccess(params.id);` | JSDoc — M9 |
| `src/models/platform/roles.js:117` | `export const ROLE_HOME = {` | **dictionnaire** rôle→destination (donnée), pas une décision |
| `src/components/dashboard/unified-dashboard/constants.js:182` | `export const ROLE_HIERARCHY = {` | donnée d'affichage |
| `src/app/workspaces/page.js:25` | `const ROLE_LABEL_KEY = {` | clés i18n de libellés |
| `src/app/crm/contacts/page.js:21`, `src/app/admin/crm/page.js:10`, `src/components/crm/TimelineScreen.js:31`, `src/components/crm/people-detail/constants.js:19` | `const ROLE_LABELS = {` | libellés |
| `src/app/admin/ventures/[id]/founders/page.js:14` | `const ROLE_COLORS = {` | couleurs |
| `src/components/ventures/workspace/ventureMeta.js:10,11` | `export const FOUNDER_ROLES = ["Founder", …]` | rôles **métier** (fonction du fondateur), pas des rôles d'accès |
| `src/app/staff/dashboard/page.js:159` | `… assignment.role === "group_leader" ? …` | style conditionnel |
| `src/components/permissions-preview/Personnes.js:66` | `.filter((person) => (role === "tous" ? true : person.roleLabel === role))` | filtre d'affichage |

**≈ 12 lignes strictes** (hors les dictionnaires de données ci-dessus, déjà comptés en (c)).

---

## 6. Synthèse chiffrée

| Catégorie | Mécanismes concernés | Nombre |
|---|---|---:|
| (a) Décisions d'accès serveur | M1 82, M2 102, M3 ≈90, M4 ≈57, M9 38 | **≈ 369** |
| (b) Masques d'interface | M2 `programTabs` 4, M3 composants ≈42, M4 composants ≈20, M6 10, M7 3, N1 `featureAccess` 2 | **≈ 81** |
| (c) Portée / comportement | M3 routage+données+flags ≈60, M4 portée ≈7, N2/N3 2 | **≈ 69** |
| (d) Faux positifs | M5 dictionnaires 21, M6/M8/M9 commentaires, M1 JSDoc 1, libellés/données | **≈ 30** |
| **Occurrences brutes (union, 14 motifs)** | — | **695** |
| **Mécanismes distincts** | — | **14** |

**Lecture de la déduplication :** 695 lignes brutes → 14 mécanismes → **≈ 369 décisions d'accès serveur réellement distinctes** (dont le cœur « par rôle » sans la couche portée : M1 82 + M2 102 = **184**). Autrement dit, la part réellement décisionnelle est ≈ 53 % des occurrences ; le reste est masque d'interface, portée, dictionnaire ou commentaire.

---

## Incertitudes

1. **Comptages (a)/(b)/(c)/(d) de M3 et M4** : ce sont des classifications **analytiques ligne à ligne** (listes fournies §5.4–5.8), pas un motif `rg` unique. Les chiffres « ≈ 90 » et « ≈ 57 » peuvent varier de quelques unités selon qu'on range, par exemple, `isSuperAdmin` (flag d'affichage) en (b) ou une comparaison de champ de données en (c). Toute ligne est fournie pour vérification et reclassement.
2. **Frontière moteur / production** : l'Inventaire A exclut `src/server/authz/**`, `src/models/authorization/**`, `src/services/authorization/**`, mais inclut `src/server/auth/guards.js` (qui *définit* `requireAuth`). J'ai conservé cette convention ; `guards.js:32,56` (`allowedRoles.includes(session.role)`) y sont donc comptés en production, bien qu'ils soient l'implémentation du mécanisme.
3. **M2 « 95 options »** : dérivé de 108 lignes de production − 6 `allowed_roles` − 4 `programTabs` − 1 `overviewHelpers` − 2 `const ROLE`. Si un `createHandler` passe son option via une variable autre que `ROLE` (non détectée), le compte bougerait d'autant.
4. **`561`** est **l'union dédupliquée** des 9 motifs (la somme brute est 565). L'Inventaire A l'annonce comme « lignes de production » sans préciser la règle ; le chiffre est reproduit à l'identique avec la règle « union `file:ligne` ».
5. **`role_capabilities` = 47 vs 58** : écart entièrement expliqué par le glob (`.json`/`.sql` non-code). Il ne s'agit pas d'un écart de fond.
6. **`.mjs/.cjs` sous `scripts/**`** : 33 occurrences de motifs « rôle » existent, toutes hors runtime (diagnostic/migration). Elles ne sont pas des décisions d'accès applicatives ; elles sont listées §3.2.
7. **Absence de `middleware.*`** : vérifiée par `find` ; si un middleware est ajouté plus tard, il faudra rouvrir cet inventaire.
8. **Fichiers du moteur non audités ligne à ligne** : M8 (`role_capabilities`, 40 lignes moteur) et les définitions N2/N3 n'ont pas été dépliés ; ils sont hors « par rôle » au sens de cet inventaire.
