# Registre des vulnérabilités et écarts d'autorisation — issu de la Phase 0

> **Registre d'audit. Aucune correction appliquée. Aucune donnée modifiée.**
> Priorités proposées : **P0** = contournement d'authentification / escalade /
> fuite de données / secret ; **P1** = IDOR / XSS stocké / CSRF / SSRF / upload
> dangereux / contournement de logique métier ; **P2** = limitation de débit /
> validation faible / exposition d'information ; **P3** = durcissement.
> La priorité est **proposée**, pas décidée.

## 1. IDOR potentiel — lecture unitaire d'un fondateur

| Champ | Valeur |
|---|---|
| **Identifiant** | `IDOR-FOUNDER-1` |
| **Emplacement** | `GET /api/ventures/[id]/founders/[founderId]` (`src/app/api/ventures/[id]/founders/[founderId]/route.js`) |
| **Comportement actuel** | La route lit l'enregistrement par son identifiant puis vérifie **uniquement** `founder.venture_id === id` (`route.js:17`). Aucune vérification d'appartenance au venture ni de capacité. La session est la seule exigence (`createHandler` sans liste de rôles). |
| **Comportement prescrit** | Spec §11 et §13 : le contrôle doit porter sur **l'utilisateur, l'action, la ressource réelle et son périmètre**. Un porteur de session ne doit pas lire une ressource hors de son périmètre. |
| **Impact** | Lecture d'une fiche de fondateur (nom, courriel, rôle, statut) pour tout identifiant devinable/en énumérant, par n'importe quel utilisateur authentifié. Fuite de données personnelles. |
| **Preuves disponibles** | `docs/permissions/inventaire-D2-decisions-deleguees.md` §1.4 (verdict `AUTH_SEULE_CONFIRMÉ`). Route et absence de garde lisibles ; le chemin frère `members` applique `checkVentureMemberViewAccess` (preuve du contraste). |
| **Priorité proposée** | **P1** |
| **Tests nécessaires** | (1) appel sans relation → `403` ; (2) appel par un membre du venture → `200` ; (3) appel avec un `founderId` d'un autre venture → `403`. À écrire en Phase 2. |
| **Correctif minimal envisagé** | Ajouter, avant la lecture, la garde déjà utilisée par la route sœur (`checkVentureMemberViewAccess` ou `requireVentureScopedAccess("ventures","view")`). Aucune donnée à migrer. **Non appliqué.** |

## 2. Actions `A_PROTEGER` (aucune décision de permission)

### 2.1 `POST /api/respond`
| Champ | Valeur |
|---|---|
| **Identifiant** | `PROTECT-RESPOND-1` |
| **Emplacement** | `src/app/api/respond/route.js` (POST) |
| **Comportement actuel** | Aucune authentification, aucune décision de permission, aucune limitation de débit ; écrit des réponses de campagne (insertion, scoring, dérivation de statut de contact). |
| **Comportement prescrit** | Spec §13 : refus par défaut ; contrôle côté serveur ; une entrée publique doit être justifiée et bornée. |
| **Impact** | Injection en masse de réponses, croissance non bornée de la base, abus applicatif (déni de service logique). Pas de fuite de données observée. |
| **Preuves** | `docs/permissions/inventaire-D-actions.md` §4 ; registre historique `PUB-3`. |
| **Priorité proposée** | **P2** |
| **Tests nécessaires** | Refus/limitation au-delà d'un quota par fenêtre ; validation de l'existence et de l'activité de la campagne/slug. |
| **Correctif minimal envisagé** | Appliquer une limitation de débit + valider la campagne cible (ou retirer la route si elle est remplacée par `/s/public-submit`). **Non appliqué.** |

### 2.2 `POST /api/s/public-draft`
| Champ | Valeur |
|---|---|
| **Identifiant** | `PROTECT-DRAFT-1` |
| **Emplacement** | `src/app/api/s/public-draft/route.js` (POST) |
| **Comportement actuel** | Création de brouillon public ouverte (clé slug) ; la mise à jour exige le jeton, mais la **création** est sans authentification ni limitation. |
| **Comportement prescrit** | Spec §13 (entrée publique justifiée et bornée). |
| **Impact** | Création illimitée de brouillons (croissance de stockage, abus). |
| **Preuves** | `docs/permissions/inventaire-D-actions.md` §4 ; registre `PUB-2`. |
| **Priorité proposée** | **P2** |
| **Tests nécessaires** | Limitation de débit à la création ; validation du slug. |
| **Correctif minimal envisagé** | Limitation de débit sur la création. **Non appliqué.** |

## 3. Vulnérabilités confirmées ouvertes (registre de sécurité)

| Identifiant | Statut vérifié | Impact | Priorité proposée | Preuves | Test nécessaire | Correctif minimal |
|---|---|---|---|---|---|---|
| `SECRET-1` — mots de passe en clair | **OUVERT** | Comparaison en clair de repli sur `auth/login`, `auth/session-login`, `auth/reset-password` ; mots de passe équipe/famille stockés en clair | **P1** | `inventaire-G-securite-identite.md` §1.2 (extraits `auth/login/route.js:146-153`, `session-login/route.js:114-121`, `reset-password/route.js:58-61`) | Test de non-comparaison en clair + réhachage à la connexion | Hachage uniforme + réhachage au login ; migration des secrets exposés. Non appliqué. |
| `UPLOAD-1` — stockage public | **OUVERT** | Buckets `submissions`/`profile-photos`/`course-thumbnails` publics (`getPublicUrl`), sans lien signé | **P1** | `inventaire-G-securite-identite.md` §1 | Test d'accès non signé refusé | Passer en privé + liens signés à durée limitée. Non appliqué. |
| `BOLA-FORM-1` — domaine formulaires/exécutions global | **OUVERT** (décision de gouvernance) | Un porteur de capacité lit les données personnelles de n'importe quel participant (`run-export`, `report-file`, `responses`, `scoring`, `evaluation-scores`) faute de rattachement à un programme | **P1** | `inventaire-G-securite-identite.md` §1 ; `SECURITY_AUDIT_REGISTER.md` §6.7 | Portée par exécution (rattachement à un programme) ou restriction aux propriétaires | Restreindre la lecture aux propriétaires en attendant le rattachement. Non appliqué. |
| `LOGIC-INV-1` — investisseur auto-déclaré | **OUVERT** | Le client fixe `stage:"invested"` + montant → écrit des décisions d'investissement, gonfle les totaux, notifie (auto-périmètre mais non confirmé par le staff) | **P2** | `SECURITY_AUDIT_REGISTER.md` §3.2 | Confirmation staff requise pour le statut `invested` | Exiger une confirmation côté serveur. Non appliqué. |

## 4. Écarts d'autorisation non classiques

### 4.1 Borne de début d'affectation non vérifiée
| Champ | Valeur |
|---|---|
| **Identifiant** | `PERIOD-START-1` |
| **Emplacement** | `src/models/authorization/profileAssignmentsStore.js:79-84`, `:96-101`, `:164-172`, `:128-136` |
| **Comportement actuel** | Les lectures d'affectations actives filtrent `status='active'` et `ends_at > NOW()`, **jamais** `started_at <= NOW()`. |
| **Comportement prescrit** | Spec §9.1 : période semi-ouverte, **début inclus**. |
| **Impact** | Une affectation datée dans le futur (donc ses profils, plafonds et capacités) devient active **immédiatement** : droit accordé avant la date prévue. |
| **Preuves** | `docs/permissions/annexe-periode-validite.md` §1–2. |
| **Priorité proposée** | **P2** (gravité réelle dépend de l'usage effectif du datage futur, non mesuré en base) |
| **Tests nécessaires** | Affectation `started_at` futur → ne doit pas être active (test proposé, non écrit, dans l'annexe 3). |
| **Correctif minimal envisagé** | Ajouter `AND (started_at IS NULL OR started_at <= NOW())` aux 4 lectures. Non appliqué. |

### 4.2 Hub `platform/form-runs` — sous-action `submit`
| Champ | Valeur |
|---|---|
| **Identifiant** | `HUB-FORMRUNS-SUBMIT-1` |
| **Comportement actuel** | La sous-action `submit` du hub ne vérifie que la session ; 19 autres sous-actions passent par une capacité `runs.*`. |
| **Impact** | La soumission est une écriture non gouvernée par capacité (auteur = session). |
| **Preuves** | `inventaire-D2-decisions-deleguees.md` ; `inventaire-D-actions.md` §6. |
| **Priorité proposée** | **P3** (à confirmer : la soumission publique est peut-être légitime) |
| **Tests nécessaires** | Confirmer l'intention produit ; sinon décision minimale. |
| **Correctif minimal envisagé** | À définir après arbitrage. Non appliqué. |

### 4.3 Route sœur sans durcissement anti-énumération
| Champ | Valeur |
|---|---|
| **Identifiant** | `AUTH-ENUM-SESSIONLOGIN-1` |
| **Comportement actuel** | `auth/session-login` n'a pas reçu le traitement anti-énumération de `auth/login` (codes distincts, pas d'égalisation de temps). |
| **Impact** | Énumération d'existence de compte. |
| **Preuves** | `inventaire-G-securite-identite.md` (découverte). |
| **Priorité proposée** | **P2** |
| **Correctif minimal envisagé** | Aligner sur `auth/login`. Non appliqué. |

## 5. Synthèse

| Priorité proposée | Identifiants |
|---|---|
| P1 | `IDOR-FOUNDER-1`, `SECRET-1`, `UPLOAD-1`, `BOLA-FORM-1` |
| P2 | `PROTECT-RESPOND-1`, `PROTECT-DRAFT-1`, `LOGIC-INV-1`, `PERIOD-START-1`, `AUTH-ENUM-SESSIONLOGIN-1` |
| P3 | `HUB-FORMRUNS-SUBMIT-1` |

**Aucune de ces lignes n'est corrigée.** Toute correction nécessite une autorisation explicite et, pour les vulnérabilités de sécurité, un lot dédié avec test de régression (Phase 3 du plan).

---

## 6. Journal Phase 3 (2026-10-10) — correctifs code appliqués

Périmètre : **code uniquement** (aucune migration, aucune configuration, aucune donnée).

| ID | Statut | Preuve (disque réel) | Correctif | Test |
|---|---|---|---|---|
| `IDOR-FOUNDER-1` | **CORRIGÉ (code)** | `src/app/api/ventures/[id]/founders/[founderId]/route.js` : le GET n'avait que la session, aucun contrôle d'objet | Garde `checkVentureMemberViewAccess` ajoutée au GET ; 404 si pas d'accès au Venture | `src/__tests__/security-phase3-urgences.test.js` (membre 200 / étranger 404) |
| `PERIOD-START-1` | **CORRIGÉ (code)** | `src/models/authorization/profileAssignmentsStore.js` : 4 lectures « actives » filtraient `ends_at` mais jamais `started_at` | Ajout de `AND (started_at IS NULL OR started_at <= NOW())` aux 4 lectures | idem (4 tests SQL) |

**Non appliqués — en attente d'autorisation / décision :** `SECRET-1` (exige une migration de données : hachage des mots de passe en clair existants), `UPLOAD-1` (exige une configuration de stockage : buckets privés + liens signés), `BOLA-FORM-1` (décision produit : rattacher les exécutions à un programme, ou réserver aux propriétaires), `LOGIC-INV-1` (décision produit : confirmation staff du statut investisseur), `PROTECT-RESPOND-1` / `PROTECT-DRAFT-1` (ajout d'une limitation de débit — suivi rapide).

**Rectificatif d'inventaire** : `PROTECT-DRAFT-1` est **partiellement atténué** sur le disque — le brouillon porte désormais un **jeton** (lecture/mise à jour l'exigent) et la **création est bornée à un slug valide**. Il ne manque que la **limitation de débit** à la création ; le risque est donc plus faible que recensé initialement.

**Corrigé/non reproduit** : le « libellé corrompu » de la Phase 0 n'existe pas sur le disque (instantané obsolète).

---

## 7. Journal Phase 4 (2026-10-10) — escalade de privilèges fermée

Deux **vecteurs d'escalade confirmés par le code** dans `PUT /api/engineering/permissions` (route exigeant `permissions.assign_capabilities`) :

| ID | Vecteur | Preuve | Correctif |
|---|---|---|---|
| `ESCAL-SELF-1` | Un porteur de `assign_capabilities` pouvait **s'octroyer** un droit (grant/restrict/set_role/set_status sur son propre cid) | route sans garde d'auto-attribution | Garde `isSelfAssignment` sur grant/revoke/restrict/unrestrict/set_role/set_status → 403 |
| `ESCAL-SETROLE-1` | `set_role` (valeur `super_admin`) **contournait** la garde `promote_super_admin` (seule action gated) | `permissionWrites` `setUserRole(payload.role)` sans validation | `set_role` → `super_admin` réservé au super admin → 403 |

Tests : `src/__tests__/permissions-admin-api.test.js` (§13). **Restant** (décision produit) : plafonner l'attribution à autrui par le `risk` du droit.

---

## 8. Journal Phase 3 (suite, 2026-10-10) — surfaces publiques et d'authentification

Périmètre : **code uniquement** (aucune migration, aucune configuration, aucune
donnée). Trois lots indépendants, chacun avec test de régression.

| ID | Statut | Preuve (disque réel) | Correctif | Test |
|---|---|---|---|---|
| `AUTH-ENUM-SESSIONLOGIN-1` | **CORRIGÉ (code)** | `src/app/api/auth/session-login/route.js` : sur `!user`, la route répondait 401 **sans** payer de coût bcrypt, là où `auth/login` paie un `verifyPassword` sur un hash leurre | Ajout de `TIMING_EQUALIZER_HASH` + `await verifyPassword(cleanPassword, …)` sur le chemin « compte inconnu » ; message unique `INVALID_CREDENTIALS` sur les deux chemins | `security-phase3-public-surfaces.test.js` (3) |
| `PROTECT-DRAFT-1` | **CORRIGÉ (code)** | `src/app/api/s/public-draft/route.js` : la **création** d'un brouillon n'avait ni authentification ni limitation (la mise à jour exigeait déjà le jeton) | `enforceRateLimit` par IP sur le seul chemin de création (30/h) ; l'UPDATE (autosave) n'est pas bridé | idem (3) |
| `PROTECT-RESPOND-1` | **CORRIGÉ (code)** | `src/app/api/respond/route.js` : aucune limitation de débit | `enforceRateLimit` par IP (60/h) avant l'appel au service | idem (2) |

**Nature du correctif** : ces trois surfaces sont **publiques par conception** (un
répondant n'est pas connecté) et ne peuvent donc pas porter une décision de
permission. Le « refus par défaut » applicable est une **limitation de débit**,
qui borne l'abus sans casser l'usage légitime. La validation de la campagne cible
(`PROTECT-RESPOND-1`) reste à trancher si le produit le demande.

**Non appliqués — inchangés** : `SECRET-1` famille/équipes (migration + décision),
`UPLOAD-1` (configuration), `BOLA-FORM-1` et `LOGIC-INV-1` (décisions produit).

---

## 9. Journal Phase 8 (tâche 3, 2026-10-10) — compatibilité rôle ↔ profil

Périmètre : **code uniquement** (aucune migration, aucune donnée). Écart corrigé :
la règle « un profil n'est ouvert qu'aux rôles de base listés dans `allowed_roles` »
(§3.3), déjà **bloquante** sur le reconcile automatique et l'affectation de
responsabilité, était **absente** sur deux chemins d'attribution **manuelle** —
qui pouvaient donc attribuer un profil à un rôle non autorisé (écart documenté
`inventaire-verifications.md` §1).

| Élément | Détail |
|---|---|
| Décision ajoutée | `profileRoleAssignmentGate({ profileKey, cid?, role? })` — `services/authorization/profileCatalog.js` : compose le **même** `buildProfileRoleGap` + `profileRoleGateDecision` que les deux points de contrôle existants. Une seule règle, un seul commutateur (`PROFILE_ROLE_ENFORCEMENT = "block"`). |
| Chemin 1 — registre | `src/app/api/engineering/permissions/profile-assignments/route.js` (POST) → **409** + `profile_role_gap` avant toute écriture ; le rôle est lu par `cid`. |
| Chemin 2 — override | `src/app/api/engineering/permissions/profile-override/route.js` (PUT) → **409** + `profile_role_gap` avant l'écriture ; le rôle est déjà lu (aucune lecture supplémentaire). |
| Tests | `profile-assignments-phase-c.test.js` (+1 cas bloqué, fixtures rendues réalistes avec `allowed_roles`/rôle de base) ; `profile-override-api.test.js` (+2 : bloqué / autorisé). |
| Validation | suite complète **388 suites / 7446 tests** verts ; lint **0 erreur** sur les fichiers touchés. |
| Retour arrière | retirer les deux appels `profileRoleAssignmentGate` (et l'export) ; les tests ajoutés deviennent rouges (signal attendu). Aucune donnée. |

**Note de séquencement** : tâche de la Phase 8 réalisée **hors** de l'ordre du plan
(Phase 5 bloquée par les opérations), traitée comme **mesure de confinement** d'un
écart d'autorisation documenté. Le reste de la Phase 8 (migrations) reste à planifier.
