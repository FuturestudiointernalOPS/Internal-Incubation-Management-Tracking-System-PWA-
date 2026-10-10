# Phase 7 — D4 : plafond « identité ∪ fonction »

> Décision arbitrée : `docs/permissions/phase-1-decisions.md` §D4 (spec §16.2 vs §5.3).
> Résolution retenue : **l'union est le verdict** ; le « non » d'une identité est un
> refus **par identité**, pas un veto global. Un **profil éligible ouvre** une section
> que le **rôle refuse explicitement** → **accès accordé AVEC un avertissement de
> SECTION** (jamais un refus).

## Ce qui change

| Fichier | Changement |
|---|---|
| `src/services/authorization/eligibility.js` | `evaluateEligibility` devient une **union** : un seul `eligible = 1` ouvre la section ; un `eligible = 0` ne neutralise plus l'allow d'une autre identité. Nouvelle fonction pure `explainEligibility` (même verdict + `openedByProfile`). |
| `src/services/authorization/contextResolver.js` | Le contexte expose `eligibilityWarnings` : la section ouverte par un profil **malgré le refus explicite du rôle** (`opened_by_profile`). |
| `src/services/authorization/contextDecisions.js` | `buildPermissionExplanation` (surface « pourquoi ») reporte `openedByProfile` à côté du verdict. |
| `src/components/permissions/permission-center/AccessExplanationPanel.js` | L'avertissement de SECTION est **affiché** dans le panneau « pourquoi » (clé i18n en/fr `eligibilityOpenedByProfile`). |
| Commentaires alignés | `models/authorization/eligibility.js`, `models/authorization/contextReads.js`, `models/authorization/featureKeyAlignmentStore.js` (référence à l'ancienne précédence corrigée). |

## Ce qui ne change PAS

- **Échec fermé** : aucune identité éligible → refus. Ligne absente → refus.
- **Super admin** : bypass d'éligibilité inchangé.
- **§12.3 — « droit sur un plafond fermé »** : reste une **alerte de configuration**
  (un `eligible = 0` documente l'intention ; il ne refuse plus à lui seul).
- **§3.3 — rattachement profil ↔ rôle** : l'union est **bornée en amont**, un profil
  incompatible avec le rôle de base est refusé à l'attribution. D4 = « b » (union
  bornée par le rôle) **rendu effectif par le rattachement**, la lecture souple « α »
  s'appliquant à la décision.

## Corollaire — lot SÉPARÉ

- `featureKeyAlignmentStore.mergeFeatureEligibilityKey` fusionne encore en « refus
  gagnant » (`MIN` / `LEAST`). Aligner ce merge sur l'union est un **changement de
  migration de données** : lot distinct, non mélangé à la décision.

## Tests

- **Nouveau** : `phase7-d4-eligibility-union.test.js` (8) — union, échec fermé,
  `explainEligibility`, câblage du résolveur (`eligibilityWarnings`).
- **Mis à jour (D4)** : `authorization-resolver.core.test.js` (« un allow ouvre la
  section »), `profile-eligibility-phase-d.test.js` (« un allow de rôle tient malgré
  le refus du profil »). Le test « aucune ligne → refus » reste inchangé (échec fermé).
- **Suite complète** : 404 suites / 7551 tests verts ; lint 0 erreur.

## Risque et mesure

- L'union **élargit** l'éligibilité dans le cas « rôle refuse explicitement + profil
  éligible ». Aucun accès n'est élargi **sans profil détenu** (le rattachement §3.3
  borne), mais la recommandation est de **mesurer en préproduction** les cas réels
  avant de compter sur la règle (mode ombre). Aucune donnée n'a été modifiée.
