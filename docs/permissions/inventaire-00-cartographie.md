# Phase 0 — Cartographie du système d'autorisation (lecture seule)

> Livrable de Phase 0. **Aucune ligne de code applicatif n'a été modifiée.**
> Objet : remplacer les estimations du prompt par des inventaires mesurés, et
> établir la table de traçabilité spécification → code.
> Date de l'inventaire : 2026-10-09. Branche courante du dépôt `ImpactOs`.

---

## 0. Documents de référence — constat

| Document attendu | Présence dans le dépôt | Constat |
|---|---|---|
| Spécification fonctionnelle v1.0 | **Présente** — `specification_systeme_permissions.docx` | Contenu extrait et lu intégralement (§1 à §17). Le .docx contient **uniquement** la spécification. |
| Rapport d'écart | **ABSENT** | Aucun fichier « rapport d'écart » n'existe dans le dépôt. Les seuls états des lieux présents sont : le tableau §2 du prompt (7 familles), `docs/AUTHZ_CURRENT_STATE.md`, `docs/SECURITY_AUDIT_REGISTER.md`. |

**Conséquence (règle 9 du protocole)** : la table de traçabilité ci-dessous s'appuie
sur le §2 du prompt et ces deux documents comme description d'écart, faute du
rapport d'écart annoncé. Ce point doit être confirmé par un humain.

---

## 1. Le moteur central — où il vit (faits confirmés)

| Élément | Emplacement | Rôle |
|---|---|---|
| Vocabulaire des capacités | `src/server/authz/capabilities.js` | `PERMISSION_MODULES`, `ACCESS_LEVELS` |
| Résolution du contexte | `src/services/authorization/contextResolver.js` | `resolveAuthorizationContext` |
| Algèbre des droits | `src/services/authorization/capabilityMerge.js` | `mergeEffectiveCapabilities` (max-merge puis − restrictions) |
| Décision pure | `src/services/authorization/contextDecisions.js` | `authorize`, `buildPermissionExplanation` |
| Entrée serveur | `src/services/authorization/contextAccess.js` | `can()` (ferme), `evaluateAuthorization()` (ouvre vers 500) |
| Frontière HTTP | `src/server/authz/responses.js` | `requireAuthorization`, `requireScopedAccess` |
| Cache de contexte | `src/services/authorization/contextCache.js` | clé `cid\|role\|profils actifs`, TTL |
| Éligibilité (schéma + seed) | `src/models/authorization/eligibility.js` | `feature_eligibility`, fail-closed |
| Politiques de portée | `src/models/authorization/scope-catalog.js` + `src/services/authorization/scope.js` | 7 politiques (voir inventaire C) |
| Gardes de portée | `src/lib/programScopedAccess.js`, `src/lib/ventureScopedAccess.js` | enforcement programme / venture |
| Registre d'affectations | `src/models/authorization/profileAssignmentsStore.js` | `profile_assignments` (périodes, source, statut) |
| Dérivation automatique | `src/services/authorization/contextGrant{Assignments,Reconcile,Sweep,History}.js` | écriture de la « copie » et du résiduel |

**Deux entrées de décision coexistent** : le moteur par capacités/portée
(`requireAuthorization`, `requireScopedAccess`) **et** des mécanismes historiques
(listes de rôles, comparaison au nom du rôle, `requireVentureAccess`,
`hasVentureCapability`) — c'est la famille A.

### 1.1 Comptages structurels mesurés (remplacent les estimations)

| Grandeur | Estimé (prompt §2) | **Mesuré** | Méthode |
|---|---:|---:|---|
| Fichiers de route API | — | **435** | `find src/app/api -name route.js` |
| Handlers HTTP exportés (toutes formes) | ~685 | **771** (535 `function` + 236 `const`) | `grep -rhoE 'export (const\|async function\|function) (GET\|POST\|…)'` |
| Handlers selon l'inventaire D | — | **748** | Écart de ~23 non expliqué → voir Incertitudes |
| Appels `requireAuthorization(` | — | **287** (278 prod) | grep |
| Appels `requireScopedAccess(` | — | **14** (dont **0** dans les routes) | grep |
| Appels `requireAuth(` | — | **238** (229 prod) | grep |

---

## 2. Table de traçabilité — spécification v1.0 → code

| § Spec | Exigence | Emplacement dans le code | Statut |
|---|---|---|---|
| §2 | Trois rôles globaux SUPER_ADMIN / STAFF / MEMBER | `src/lib/identity.js:24` (`BASELINE_IDENTITIES`) ; `contacts.role` | **Conforme** (nettoyage en cours — voir §3 famille G) |
| §2.1 | Attribution du rôle à la création (STAFF interne, MEMBER externe) | `src/app/api/admin/approve-user`, invitations, modèle contacts | **Partiel** (chemins multiples) |
| §3 | Un utilisateur = 1 rôle + N profils contextuels | `profiles` (table) ; `src/models/authorization/profile-catalog.js` | **Conforme** |
| §3.1 | Catalogue extensible de profils | `PROFILE_CATALOG` (`profile-catalog.js:69-112`) ; écran Profiles | **Conforme** |
| §3.2 | Profils par défaut + déclencheurs automatiques | `src/services/authorization/contextGrantAssignments.js` ; `contextGrantReconcile.js` | **Partiel** (tous les déclencheurs ? voir inventaire vérifications §5) |
| §3.3 | Compatibilité rôle ↔ profil, aux affectations **manuelles ET automatiques** | `profileRoleGateDecision` (`services/authorization/profileCatalog.js:275`) ; `contextGrantReconcile.js:114-128` ; `responsibilityAssignment.js:129-152` | **Partiel** — bloque aux 2 points nommés, **2 chemins manuels y échappent** (inventaire vérifications §1) |
| §4 | Features à identifiant stable | `PERMISSION_MODULES` (`capabilities.js`) ; `MODULE_TO_FEATURE` (`models/authorization/eligibility.js:36`) | **Conforme** (libellé vérifié sur le disque — voir §8 : le « libellé corrompu » n'est PAS reproduit) |
| §5 | Éligibilité au niveau rôle **et** profil | `feature_eligibility` ; `evaluateEligibility` ; identité `profile` | **Conforme** |
| §5.3 | Permission impossible sur feature non éligible ; réévaluation à la modification | `validateCapabilitiesWithinEligibility` ; `invalidateAuthorizationContext` | **Partiel** (alerte « plafond sans droit » absente — famille B) |
| §6 | Permissions rôle / profil / individuelles | `role_capabilities` (legacy), `group_capabilities`, `user_capabilities` | **Conforme** |
| §6.2 | Actions VIEW/CREATE/UPDATE/DELETE/MANAGE/EXPORT/ASSIGN | `ACCESS_LEVELS` (0–5) + capacités nommées | **Partiel** — **MANAGE absent** (inventaire vérifications §7) |
| §6.5 | Refus par défaut ; combinaison rôle/profil/utilisateur | `mergeEffectiveCapabilities` | **Conforme** (une règle de conflit explicite reste à formaliser — spec §16.1) |
| §7 | Périmètre global / contextuel / personnel | `scope-catalog.js` ; `scope.js` ; `programScopedAccess` ; `ventureScopedAccess` | **Partiel** — 2 politiques sur 7 appliquées (inventaire C) |
| §8 | Affectations avec `scope_type`, `scope_id`, `starts_at`, `ends_at`, `source`, `assigned_by`, `created_at` | `profile_assignments` (`profileAssignmentsStore.js:27-37`) | **Conforme** (colonnes présentes) |
| §8.2 | Manuel **et** automatique **dans la même transaction** que la relation | `contextGrantAssignments.js`, `contextGrantReconcile.js` | **Partiel** (même transaction non confirmée partout) |
| §8.3 | Sources MANUAL / PROGRAM_ASSIGNMENT / PROGRAM_ENROLLMENT / COURSE_ENROLLMENT / VENTURE_ASSIGNMENT / SYSTEM | colonne `source` (valeurs `manual` / `automatic` aujourd'hui) | **Partiel** — vocabulaire de source non aligné sur la spec |
| §8.4 | Multi-profils ; anti-doublons ; chevauchements | `findActiveAssignment`, `refreshAutomaticAssignmentPeriod` | **Conforme** (inventaire vérifications §4) |
| §9.1 | Période semi-ouverte : début inclus, fin exclue | lectures : `ends_at > NOW()` ; **`starts_at` jamais vérifié** | **ÉCART** — voir §3 famille F |
| §9.2 | La décision vérifie directement la période, pas une copie | `contextReads.js:29-33` filtre `expires_at` ; `listActiveProfileKeys` filtre `status`/`ends_at` | **Partiellement conforme** — la copie `user_capabilities` est bien datée, mais la borne de DÉBUT manque |
| §9.3 / §12.6 | Historique consultable (actifs + passés, auteur, source) | `listProfileAssignments` ; registre d'audit ; écran Audit | **Partiel** |
| §10 | Accès historique = règle d'autorisation distincte | `contextGrantHistory.js` (lecture résiduelle dérivée) ; `venture_managed_history`/`program_managed_history` | **Partiel** — politiques **déclarées mais non appliquées** (inventaire C) |
| §11 | Calcul : compte → rôle/profils → éligibilité → permission → périmètre → historique/restrictions | `resolveAuthorizationContext` → `authorize` | **Partiel** — périmètre non intégré au moteur (`authorize` ne reçoit pas la ressource) |
| §12 | Administration rôles / profils / éligibilités / permissions / affectations / historique | Centre des permissions : écrans People, Templates, Eligibility, Governance, Operations, Audit, Context scope | **Partiel** (détail par écran à établir en Phase 9) |
| §13 | Refus par défaut, contrôle serveur, périmètre, séparation, historique, automatisation, audit, réévaluation, anti-escalade, auth≠autorisation | dispersé (voir familles A–G) | **Partiel** — plusieurs non tenus |
| §15 | 13 scénarios de validation | non regroupés aujourd'hui | **À créer (Phase 2)** |
| §16 | 5 décisions à verrouiller | ouvertes | **Phase 1 (arrêt humain)** |

---

## 3. Écarts mesurés, par famille (prompt §2)

| Id | Problème | Estimé | **Mesuré** | Preuve / livrable |
|---|---|---|---|---|
| A | Contrôles « par rôle » hors moteur | ~276 | **561 lignes de production** sur 9 mécanismes (M1–M9) | `inventaire-A-controles-par-role.md`. Dédup/nature à finaliser : 561 lignes ≠ 561 décisions distinctes |
| B | Plafond + droit, deux interrupteurs silencieux | — | Confirmé : aucune garde d'alerte « droit sans plafond / plafond sans droit » | mot. `eligibility.js`, écrans ; **manque l'alerte** (spec §12.3) |
| C | Portée réécrite hors moteur | 3 trous connus | **24 filtres ad hoc** ; **2 politiques appliquées sur 7** ; **4 gardes fail-open** (dont 2 assumées) | `inventaire-C-portees.md`. **Les 3 trous connus sont CORRIGÉS** |
| D | Actions sans décision | ~137 | **48 sans décision** (dont **2 A_PROTEGER**) + **155 auth seule** + **129 rôle seul** | `inventaire-D-actions.md` |
| E | Décisions produit en attente | — | Confirmé ; correspond aux décisions §16 de la spec | à traiter en Phase 1 |
| F | « Vérité recopiée » | — | **Nuancé** : les lectures vérifient bien `expires_at`/`ends_at` ; **la borne de début (`starts_at`) n'est jamais vérifiée** | `contextReads.js:29-33` ; `profileAssignmentsStore.js:79-84` |
| G | Dettes sécurité / identité | — | **4 items de sécurité confirmés OUVERTS** + 5 partiels ; droits retirés = **0 site** ; identité héritée transitoire présente | `inventaire-G-securite-identite.md` |

### 3.1 Faits nouveaux / contradictions relevées

1. **Spec §9.1 non tenue** : la borne de DÉBUT de période (`starts_at`) n'est jamais
   contrôlée (`ends_at > NOW()` seulement). Une affectation datée dans le futur est
   traitée comme active immédiatement.
2. **Famille F partiellement démentie** : la décision lit bien la date d'expiration
   (`contextReads.js:29-33`, `profileAssignmentsStore.js:79-84`) — elle ne dépend pas
   *entièrement* d'une copie. Seule la borne de début manque.
3. **Registre de sécurité contradictoire avec lui-même** : `SECURITY_AUDIT_REGISTER.md`
   §3 liste OPEN des items (PUB-2, PUB-3, CSRF-1, AUTH-4, AUTHZ-GLOBAL-1, AUTHZ-CRM-1,
   SECRET-3) que sa §8 déclare corrigés « Lot 15 ». Vérification code : corrigés.
4. ~~**Libellé corrompu confirmé** : `src/server/authz/capabilities.js:94`~~
   **RETIRÉ — NON REPRODUIT.** La vérification directe sur le disque (`sed`,
   `grep`, `git diff` **vide**) montre `tasks: { name: "Tasks" }` et un module
   `crm` présent : le libellé est **propre**. L'instantané des outils de lecture
   était **obsolète**. Voir §8 « Correctif d'instantané ».
5. **Route sœur non durcie** : `auth/session-login` n'a pas reçu le traitement
   anti-énumération de `auth/login` (non listée par le registre).
6. **Vocabulaire de source non aligné** : la spec §8.3 nomme 6 sources ; le code
   utilise `manual` / `automatic`.
7. **`MANAGE` absent** du vocabulaire d'actions.

---

## 4. Zones « non vérifiables depuis le code » (restantes après Phase 0)

| Zone | Pourquoi | Ce qu'il faudrait |
|---|---|---|
| Valeurs d'identité héritées réellement en base | Impossible de lire l'état de la base depuis le code | Requête de sondage sur `contacts.role` (hors production) |
| `DEP-1` (dépendances vulnérables) | Nécessite `npm audit` / réseau | Exécution de `npm audit` |
| Dictionnaire de données réel vs schéma attendu | Nécessite la base | Comparaison de schéma (voir `docs/SCHEMA_DRIFT_AUDIT.md`) |
| Divergences « mode ombre » (famille A) | Nécessite d'exécuter les deux décisions | Phase 5 |
| Écart 771 ↔ 748 handlers | Décompte ambigu (hubs, formes) | Réconciliation manuelle (Phase 2, test de couverture) |

**Le critère de sortie de la Phase 0 (« aucune zone non vérifiable ne subsiste »)
n'est donc PAS atteint** : 5 zones dépendent de la base, du réseau ou de l'exécution.
Elles sont isolées ci-dessus et ne bloquent pas la Phase 1.

---

## 5. Décisions produit à verrouiller (spec §16 → Phase 1)

La spécification laisse **5 décisions explicitement ouvertes** (§16.1 à §16.5) qui
recoupent la famille E. Le prompt en propose 10 (D1–D10). Elles doivent être
validées par un humain **avant** la Phase 7. Aucune n'a été tranchée ici.

---

## 6. Fichiers produits par la Phase 0

| Fichier | Contenu | Mesure |
|---|---|---|
| `docs/permissions/inventaire-00-cartographie.md` | ce document : moteur, traçabilité spec→code, écarts mesurés | — |
| `docs/permissions/inventaire-A-controles-par-role.md` | contrôles hors moteur (M1–M9) | 561 lignes production |
| `docs/permissions/inventaire-C-portees.md` | politiques de portée + filtres ad hoc + 3 trous | 317 lignes |
| `docs/permissions/inventaire-D-actions.md` | toutes les routes et leur contrôle | 748 handlers |
| `docs/permissions/inventaire-G-securite-identite.md` | sécurité, droits retirés, identité héritée | 328 lignes |
| `docs/permissions/inventaire-verifications.md` | 9 comportements « non vérifiés » | 737 lignes |

---

## 7. Incertitudes

- **Écart de comptage des handlers** : 771 (formes `const` incluses) vs 748 (inventaire D). ~23 non expliqués.
- **Classement des routes à décision déléguée** : plusieurs handlers classés
  « auth seule » appliquent en réalité une décision dans un service ou un import
  dynamique (ventures, participant-programs). L'inventaire D décrit le mécanisme
  *observable dans le fichier* ; un audit exhaustif site par site reste à faire.
- **Colonnes « capacité équivalente » et « risque »** de l'inventaire A = première
  passe heuristique, à valider site par site.
- **`.includes(role)`** : compte non reproduit à l'identique (80 fourni, 81 large / 37 étroit en production).
- **Périmètre du scan** : `src/**/*.js` ; les `.jsx` et `.ts` n'ont pas été couverts pour l'inventaire A.
- **Une seule session d'agents pour 5 inventaires** : chaque inventaire est sourcé,
  mais un échantillon a seulement été re-vérifié manuellement (stub `/forms`,
  `requireScopedAccess`=0 dans les routes, filtres de période).

---

## 8. Correctif d'instantané (Phase 2) — divergence outils ↔ disque

**Constat** : un fait de la Phase 0 (« libellé corrompu du module `tasks` »,
rapporté par la lecture outillée et l'inventaire G) **n'est pas reproduit sur le
disque**. Vérification :

- `git --no-pager diff --stat` → **vide** (aucun fichier suivi modifié) ;
- `git status` → seuls des fichiers **non suivis** (`docs/permissions/**`, la spec,
  les 3 nouveaux tests) ;
- `sed -n '90,100p' src/server/authz/capabilities.js` → `tasks: { name: "Tasks" }` ;
- module `crm` présent (`capabilities.js:54`).

**Cause probable** : les outils de lecture (`read_file`, `grep` outillé) ont servi
un **instantané obsolète** du dépôt, alors que le terminal et les `fs` de Jest
lisent le **disque réel**. Le dépôt réel **n'a jamais contenu** cette corruption.

**Conséquence sur les livrables Phase 0** : les comptages faits **au terminal**
(435 routes, 751 handlers, 226 comparaisons de rôle, etc.) sont **fiables**. Les
références `fichier:ligne` produites via l'outil (inventaires A/C/D/G) doivent être
**re-vérifiées au terminal** avant toute action de correction, car des lignes ont pu
glisser (le module `crm` inséré décale la numérotation après `capabilities.js:54`).

### 8.1 Re-vérification `SNAP-1` (Phase 5) — confirmée au terminal

Les comptages de l'inventaire A, re-mesurés au **terminal** (production : hors
`src/__tests__` et hors moteur) :

| Mécanisme | Inventaire A | Terminal | Écart |
|---|---:|---:|---|
| M1 `requireAuth([…])` | 83 | **83** | — |
| M2 `roles:[…]` | 108 | **108** | — |
| M3 `role ===/!==` | 218 | **219** | +1 (à noter) |
| M4 `.includes(role)` | 81 | **81** | — |
| M5 `const ROLE` | 21 | **21** | — |
| M6 `ROLE_ACCESS` | 10 | **10** | — |
| M7 `PERSONAL_ROLES` | 3 | **3** | — |
| M8 `role_capabilities` | 1 | **1** | — |
| M9 `requireVentureAccess` | 40 | **40** | — |

Conclusion : les comptages sont **confirmés** ; seul M3 doit être re-lu ligne à
ligne avant d'agir (les `role ===` incluent des branches d'interface).

**Action recommandée (avant Phase 3)** : recontrôler au terminal chaque
`fichier:ligne` cité dans les inventaires A/C/D/G qui sert de base à une correction.
Les **3 fichiers de test de la Phase 2** lisent le disque réel (`fs.readFileSync`) et
sont donc à jour.
