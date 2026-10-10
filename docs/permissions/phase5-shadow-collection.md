# Phase 5 c3b — Collecte en mode ombre : résultats de la première mesure

> **Mesure en LECTURE SEULE** sur la base accessible via `.env.local`
> (staging, 2026-10-10). Aucune écriture, aucune migration, aucune configuration.
> Outil : `node scripts/phase5-shadow-collect.mjs`.
> **Aucune bascule n'est engagée** par ce document.
> Mise à jour : **policy program alignée** sur celle des gardes
> (`program_staffed`, voir §4) et re-mesure.

## 1. Méthode

Le script compare, pour chaque personne ayant une relation, les deux verdicts
qu'oppose le mode ombre :

- **ad hoc** (ce que `decide` utilise aujourd'hui) : `resolveContextAssignment`
  — `src/models/authorization/contextAssignmentReads.js` ;
- **moteur** (la policy que les **gardes de route** appliquent) : `isWithinScope`
  — `src/models/authorization/scopeReads.js` : `program_staffed` et
  `venture_own`.

Statements copiés **au mot près** des modèles (colonnes : `v2_program_staff`,
`v2_programs.assigned_pm_id`, `contact_roles`, `venture_members`,
`venture_staff_assignments`).

## 2. Résultat (après alignement de la policy)

```
peopleProbed : 6
total        : 3 divergences
  program:program_staffed  count 1  legacyAllowEngineDeny 0  legacyDenyEngineAllow 1
  venture:venture_own      count 2  legacyAllowEngineDeny 0  legacyDenyEngineAllow 2
```

Les 3 divergences vont **toutes dans le même sens** : le contrôle ad hoc
**refuse** là où le moteur (la garde de route) **autorise**.

| # | Policy | Personne | Ressource | Cause |
|---|---|---|---|---|
| 1 | `program_staffed` | `USR_2342F36BA5F0` | programme `b700f1a8-…` | La personne est le **manager nommé** (`v2_programs.assigned_pm_id`) mais l'ad hoc ne lit pas cette source. |
| 2 | `venture_own` | `USR_E7D5C835B2A1` | venture `VNT-651CED8E` | **Staff de venture** (`venture_staff_assignments`) non lu par l'ad hoc. |
| 3 | `venture_own` | `USR_58C499684A4B` | venture `VNT-651CED8E` | Idem. |

**Cause racine** : l'ad hoc (`resolveContextAssignment`) est **plus étroit** que
les policies des gardes —
- `program_staffed` = `v2_program_staff` **∪ `v2_programs.assigned_pm_id`** ; l'ad hoc = `v2_program_staff` ∪ `contact_roles` (pas de manager nommé) ;
- `venture_own` = `venture_members` **∪ `venture_staff_assignments`** ; l'ad hoc = `venture_members` seulement.

## 3. Ce que la bascule changerait (à ne pas subir)

Migrer ces couples vers le moteur **élargirait** l'accès ; mais ici c'est
l'inverse de la measure initiale : passer les routes sur **`decide` (ad hoc)**
**restreindrait** l'accès (le manager nommé et le staff de venture perdraient
leur programme/venture). Autrement dit, `decide`, tel qu'écrit, **n'est pas
équivalent** à la garde de route : il manque des sources.

## 4. Alignement du mode ombre (FAIT)

Le mode ombre de `decide` comparait la policy **`program_assigned`**, alors que
les gardes de route appliquent **`program_staffed`**
(`src/lib/programScopedAccess.js:111`). Le mode ombre comparait donc deux
grandeurs différentes pour les programmes.

**Correction** : `SHADOW_SCOPE_POLICY.program` passe à **`program_staffed`**
(`src/services/authorization/scopedAccess.js`), aligné sur le venture
(`venture_own`, déjà correct). Un test verrouille l'alignement
(`permissions-scope-shadow.test.js`).

Effet mesuré : la fausse divergence « participant » a disparu ; la vraie
divergence « manager nommé » est apparue.

## 5. Réserve d'échantillon

Le jeu de données staging est **minuscule** (`contacts` = 10 ; `contact_roles` = 3 ;
`participant_programs` = 1 ; `venture_members` = 1 ; `venture_staff_assignments` = 2).
La mesure **valide la mécanique** mais **n'est pas représentative** : la campagne
doit tourner sur un environnement peuplé.

## 6. Décisions requises (bloquantes)

| # | Décision | Défaut proposé |
|---|---|---|
| S1 | `decide` doit-il inclure le **manager nommé** (`assigned_pm_id`) et le **staff de venture** (`venture_staff_assignments`) pour être équivalent à la garde ? | **Oui** — sinon `decide` restreint l'accès à la bascule. |
| S2 | Le **staff de venture** est-il dans `venture_own` ? | **Oui** (le moteur/garde) — à confirmer. |
| S3 | Autres écarts ad hoc ↔ garde (participants, `contact_roles`) : lesquels sont voulus ? | À trancher |

## 7. État et suite

- ✅ Mécanique de collecte opérationnelle (`scripts/phase5-shadow-collect.mjs`), read-only.
- ✅ Mode ombre **aligné** sur la policy des gardes (§4).
- ⛔ **Bascule NON engagée** : divergences expliquées mais non tranchées (S1–S3).
- **Prochaine action minimale** : trancher S1–S3, puis étendre `decide`/l'ad hoc aux sources manquantes, puis re-mesurer sur un environnement représentatif.
