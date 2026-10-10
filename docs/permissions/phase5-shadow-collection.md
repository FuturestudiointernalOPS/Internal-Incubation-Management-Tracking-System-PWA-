# Phase 5 c3b — Collecte en mode ombre : résultats et décision

> **Mesure en LECTURE SEULE** sur la base accessible via `.env.local`
> (staging, 2026-10-10). Aucune écriture, aucune migration, aucune configuration.
> Outil : `node scripts/phase5-shadow-collect.mjs`.
> **Aucune bascule n'est engagée** par ce document.

## 1. Objet de la décision

Le périmètre PROGRAMME est aujourd'hui exprimé par **deux policies de tables** :

| Policy | Source | Usage |
|---|---|---|
| `program_assigned` | `v2_program_staff` ∪ `participant_programs` | lecture |
| `program_staffed` | `v2_program_staff` ∪ `v2_programs.assigned_pm_id` | **écriture** (garde `programScopedAccess`, ~18 routes) |

La direction retenue : remplacer ces deux policies par **une seule base
PROFIL** — `program_managed` = « la personne détient le profil `program_manager`
pour ce programme ». Un staff assigné à un programme reçoit ce profil ; le même
profil peut être attribué à quelqu'un d'autre.

## 2. Mesure (ad hoc vs cible profil)

```
peopleProbed : 7
program:ad_hoc_vs_managed  2 divergences  (1 adhoc-allow/cible-deny, 1 adhoc-deny/cible-allow)
venture:venture_own        2 divergences  (2 adhoc-deny/moteur-allow)

switchImpact (garde actuelle program_staffed  →  cible program_managed)
  programLosesWrite : 1
  programGainsWrite : 0
```

Détail du **seul** effet de bascule identifié :

| Perte d'écriture | Personne | Programme | Pourquoi |
|---|---|---|---|
| 1 | `christelle.fagbehouro@epitech.eu` | `b700f1a8-…` | Présente dans `v2_program_staff` (facilitatrice) mais **sans profil `program_manager`** → sous la base profil, elle n'a plus la portée d'écriture. |

À l'inverse, `USR_2342F36BA5F0` (détenteur du profil `program_manager`) est
aujourd'hui **non reconnu** par l'ad hoc et par `program_assigned`, et **gagnerait**
la portée sous la base profil.

## 3. Ce que dit la mesure

1. La base PROFIL **reconnaît bien** le manager (`USR_2342F36BA5F0`).
2. La bascule **retire** la portée d'écriture à un **facilitateur** de
   `v2_program_staff` qui n'a pas le profil `program_manager`.
3. La bascule **n'accorde rien de nouveau** sur cet échantillon (`gainsWrite = 0`).

## 4. Décision à prendre (S1) — c'est LE point bloquant de la Phase 5

**Adopter la base profil `program_manager` comme seule portée programme ?**

- **Oui** → supprimer `program_assigned` et `program_staffed` ; la garde
  `programScopedAccess` passe de `program_staffed` à `program_managed`. **Effet
  connu** : tout membre de `v2_program_staff` **sans** profil `program_manager`
  (facilitateurs, assistants) perd la portée d'écriture sur les ~18 routes
  protégées. Il faut donc, **avant** la bascule :
  - confirmer que **seul le manager écrit** sur un programme (ou attribuer le
    profil aux facilitateurs qui doivent continuer), et
  - **vérifier le remplissage** du registre `profile_assignments` pour les
    programmes existants (backfill) — sinon des managers historiques perdent
    aussi l'accès.
- **Non** → garder `program_staffed` pour l'écriture et réserver `program_managed`
  à un usage plus étroit (ex. une action « pilotage » distincte).

**Défaut recommandé** : **Oui, mais après backfill et validation**, car la
contraction de l'écriture est un incident opérationnel (facilitateurs bloqués),
pas un gain de sécurité.

## 5. Décisions liées

- **S2** — venture : `venture_own` inclut `venture_staff_assignments` (le staff de
  venture) que l'ad hoc ignore → bascule `decide` **retirerait** l'accès au staff
  de venture. Confirmer le périmètre voulu.
- **S3** — participants : `program_assigned` (lecture) inclut l'inscription ; le
  retrait de cette policy change l'affichage des contextes. À trancher.

## 6. Réserve d'échantillon

Staging est **minuscule** (`contacts` = 10 ; `profile_assignments` = 4). La mesure
prouve la mécanique et **chiffre l'effet de bascule**, mais la décision S1 doit
être confirmée sur un environnement peuplé.

## 7. État

- ✅ Prédicat PROFIL livré (`program_managed` : reader + catalogue + moteur), **additif** — la garde reste `program_staffed` (aucune bascule).
- ✅ Mode ombre pointé sur la cible (`SHADOW_SCOPE_POLICY.program = program_managed`).
- ✅ Collecte re-mesurée (ci-dessus).
- ⛔ **Suppression des deux policies NON exécutée** : c'est la bascule, elle
  contracte l'écriture de ~18 routes et dépend du remplissage du registre —
  protocole « mesurer avant de changer ».
