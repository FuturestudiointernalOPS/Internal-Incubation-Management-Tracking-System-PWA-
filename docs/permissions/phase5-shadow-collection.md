# Phase 5 c3b — Collecte en mode ombre : résultats de la première mesure

> **Mesure en LECTURE SEULE** sur la base accessible via `.env.local`
> (staging, 2026-10-10). Aucune écriture, aucune migration, aucune configuration.
> Outil : `node scripts/phase5-shadow-collect.mjs`.
> **Aucune bascule n'est engagée** par ce document.

## 1. Méthode

Le script compare, pour chaque personne ayant une relation, les deux verdicts
qu'oppose le mode ombre :

- **ad hoc** (ce que `decide` utilise aujourd'hui) : `resolveContextAssignment`
  — `src/models/authorization/contextAssignmentReads.js` ;
- **moteur** (la policy visée) : `isWithinScope`
  — `src/models/authorization/scopeReads.js`.

Les statements sont copiés **au mot près** des deux modèles (colonnes :
`v2_program_staff`, `contact_roles`, `participant_programs`, `venture_members`,
`venture_staff_assignments`).

## 2. Résultat

```
peopleProbed : 6
total        : 3 divergences
  program:program_assigned  count 1  legacyAllowEngineDeny 0  legacyDenyEngineAllow 1
  venture:venture_own        count 2  legacyAllowEngineDeny 0  legacyDenyEngineAllow 2
```

Les 3 divergences vont **toutes dans le même sens** : le contrôle ad hoc
**refuse** là où le moteur **autorise**.

| # | Couple | Personne | Ressource | Interprétation |
|---|---|---|---|---|
| 1 | `program_assigned` | `alexisassogba53@gmail.com` | programme `b700f1a8-…` | La personne est **participante** (`participant_programs`) : le moteur l'inclut, l'ad hoc non. |
| 2 | `venture_own` | `USR_E7D5C835B2A1` | venture `VNT-651CED8E` | La personne est **staff de venture** (`venture_staff_assignments` active) mais pas `venture_members` : le moteur l'inclut, l'ad hoc non. |
| 3 | `venture_own` | `USR_58C499684A4B` | venture `VNT-651CED8E` | Idem. |

**Cause racine** : la policy du moteur couvre des sources que le résolveur ad hoc
ignore —
- `program_assigned` = `v2_program_staff` **∪ `participant_programs`** ; l'ad hoc = `v2_program_staff` ∪ `contact_roles` (pas de participants) ;
- `venture_own` = `venture_members` **∪ `venture_staff_assignments`** ; l'ad hoc = `venture_members` seulement.

Chaque divergence est donc **expliquée** : ce n'est pas un aléa, c'est une
**différence de périmètre** décidée dans le moteur.

## 3. Ce que la bascule changerait (à ne pas subir)

Migrer ces 3 couples vers le moteur **élargirait** l'accès (participants d'un
programme ; staff d'un venture). Le protocole interdit d'élargir un accès pour
« faire passer » une migration : il faut **décider** du périmètre voulu.

## 4. Réserve technique majeure (à corriger AVANT de conclure)

Le mode ombre de `decide` compare la policy **`program_assigned`** pour les
programmes (`src/services/authorization/scopedAccess.js`, `SHADOW_SCOPE_POLICY`),
alors que les **gardes de route en vigueur** appliquent **`program_staffed`**
(`src/lib/programScopedAccess.js:111` → `isWithinScope("program_staffed", …)`).
Le mode ombre ne compare donc pas, pour les programmes, la policy que les routes
exécutent réellement. Pour le venture, les deux utilisent bien `venture_own`
(`src/lib/ventureScopedAccess.js:85`) — la comparaison y est fidèle.

**Conséquence** : avant d'utiliser la collecte pour trancher la migration des
programmes, il faut **aligner** `SHADOW_SCOPE_POLICY.program` sur la policy que
la route applique (`program_staffed`), sinon les divergences mesurées opposent
deux grandeurs différentes.

## 5. Réserve d'échantillon

Le jeu de données staging est **minuscule** (`contacts` = 10 ; `contact_roles` = 3 ;
`participant_programs` = 1 ; `venture_members` = 1 ; `venture_staff_assignments` = 2).
La mesure **valide la mécanique** mais **n'est pas représentative** : la campagne
doit tourner sur un environnement peuplé (copie de production ou staging réaliste).

## 6. Décisions requises (bloquantes)

| # | Décision | Options |
|---|---|---|
| S1 | Policy de portée PROGRAMME | `program_staffed` (gardes actuelles) **ou** `program_assigned` (mode ombre `decide`) — il faut une seule source de vérité et aligner le mode ombre. |
| S2 | Périmètre VENTURE | Le staff de venture (`venture_staff_assignments`) fait-il partie de `venture_own` ? Le moteur dit oui, l'ad hoc non. |
| S3 | Périmètre PROGRAMME, participants | Un participant (`participant_programs`) est-il « assigné » au programme pour les ressources scoped ? Le moteur dit oui, l'ad hoc non. |

## 7. État et suite

- ✅ Mécanique de collecte opérationnelle (`scripts/phase5-shadow-collect.mjs`), read-only.
- ⛔ **Bascule NON engagée** : divergences expliquées mais non tranchées, + réserve §4.
- **Prochaine action minimale** : trancher S1–S3, puis aligner `SHADOW_SCOPE_POLICY.program` (§4), puis re-mesurer sur un environnement représentatif.
