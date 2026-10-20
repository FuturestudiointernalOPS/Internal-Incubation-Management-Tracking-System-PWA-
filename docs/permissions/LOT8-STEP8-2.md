# Lot 8 — étape 8.2 : la dernière sonde de mesure supprimée

> Date : 2026-10-20. La décision unifiée ne calcule plus la règle qu'elle a
> remplacée. La sonde aurait été redondante avec celle retirée de la garde de
> route en 8.1, et elle aurait tourné sur un chemin d'affichage.

---

## 1. La preuve avant suppression

| Élément | Preuve |
|---|---|
| `SHADOW_SCOPE_POLICY` | **2 consommateurs** : `decide` et ses deux suites de test. Aucune route, aucun écran. |
| Le bloc de sonde | Placé dans `decide`, qui n'a **aucun appelant d'action** (le compteur « point d'entrée unifié » est à 0) ; depuis 8.1, la garde de route réelle (`requireProgramScope`) ne sonde plus. |
| La divergence mesurée | Une seule, expliquée : un facilitateur qui avait déjà perdu `programs.edit` à l'étape 3.2. La mesure reste reproductible par `scripts/db-audit/program-perimeter-compare.sql`. |

Depuis l'étape 7.3, `decide` a **un** appelant : la projection d'affichage. Une
sonde branchée sur un calcul d'écran ne protège rien et n'observe plus le trafic
des écritures.

## 2. Ce qui a été supprimé

- `SHADOW_SCOPE_POLICY` dans `src/services/authorization/scopedAccess.js` ;
- le bloc `if (shadowEnabled() …)` et l'import de `./shadow` ;
- `src/__tests__/permissions-scope-shadow.test.js`, remplacé par
  `permissions-scope-decision.test.js` (mêmes garanties sur la décision
  appliquée, sans sonde) ;
- les assertions de sonde dans `scope-policies.test.js`.

**`program_staffed` reste `purpose: "enforced"`** : ce n'est pas un vestige de la
sonde, c'est la règle assumée de la route de réparation du gestionnaire. La
classification des politiques est désormais : 3 appliquées, 2 d'affichage,
2 d'historique, **0 en ombre**.

## 3. Un garde-fou renforcé

`npm run test:authz` exécute maintenant aussi `scope-policies` et
`permissions-scope-decision`. `scope-policies` échouait depuis le changement de
`purpose` (il n'était pas dans la commande) : une politique classée « ombre »
alors qu'elle est appliquée peut désormais faire échouer la CI.

## 4. Compteurs

| Indicateur | Avant 8.2 | Après 8.2 |
|---|---:|---|
| Politiques de périmètre déclarées | 7 | 7 |
| Politiques classées « ombre » | 1 | **0** |
| Comparaisons de rôle hors moteur | 299 | 299 |
| Actions en dette | 60 | 60 |

## 5. Tests

- `test:authz` → **9 suites / 66 tests** verts (deux suites ajoutées).
- `scope-policies` → 5 tests ; `permissions-scope-decision` → 4 tests.
- `npm run lint` → 0 erreur.
- Les 17 suites en échec sont **toutes préexistantes** (vérifié par `git stash`
  sur `HEAD` propre) : 7 suites venture connues, `reminders-routes`,
  `identity-gate-bridge`, `permissions-characterization`, et 7 suites hors
  périmètre (`profile-role-rule-phase-b`, `responsibility-assign-decisions`,
  `verification-upload`, `journey-delete-super-admin`, `server/auth-boundaries`,
  `journey-report-deliverables`, `deliverable-upload-access`).

## 6. Ce qui reste bloqué, et pourquoi

**Routes retirées** (`/api/segments`, `/api/segments/run`, `/api/responses`,
`/api/responses/review`). Census refait : **0 appel** dans `src` (ni `fetch`, ni
lien, ni entrée de navigation). La moitié statique de la preuve est faite ; il
manque la moitié « trafic » (un intégrateur ou un script hors application). Tant
qu'elle manque, les fichiers restent : ils répondent `403` et ne protègent rien
de moins.

**Identités contextuelles legacy** (`participant`, `facilitator`, `investor`,
`founder`, plus `team` à la connexion). Leur retrait exige une **migration de
données** ; la session est en lecture seule sur la base, donc elle est préparée,
pas exécutée.

**Écart D-6** (404 « ressource absente » vs 403 « hors périmètre »). Toujours une
décision produit : anti-énumération assumée, ou raison honnête.

## 7. Retour arrière

`git revert`. Aucune écriture en base. La mesure reste disponible par le script
SQL, hors du chemin d'exécution.

## 8. Compte rendu

```
LOT 8 — Supprimer les chemins morts — étape 8.2
Fait :
  - SHADOW_SCOPE_POLICY et le bloc de sonde de `decide` supprimés
  - suite de test réécrite sur la décision seule (renommée)
  - scope-policies et la décision mis dans test:authz
Compteurs : politiques en ombre 1 -> 0 ; dette inchangée (60).
Divergences : aucune nouvelle. Les 17 suites en échec sont préexistantes.
Tests : 9 suites / 66 tests authz verts. Lint 0 erreur.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : preuve de trafic pour les 4 routes retirées, puis migration
  des identités contextuelles (à exécuter hors session en lecture seule).
```
