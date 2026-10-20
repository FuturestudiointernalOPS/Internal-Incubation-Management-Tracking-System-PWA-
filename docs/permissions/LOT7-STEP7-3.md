# Lot 7 — étape 7.3 : le périmètre programme projeté à l'écran

> Date : 2026-10-20. L'espace de travail d'un programme ne déduit plus ses
> affordances d'écriture : le serveur lui renvoie la décision qu'il appliquera,
> et l'écran la rend. La règle locale (affectation, équipe, profil) disparaît.

---

## 1. Le problème

`selectProgramAccess` décidait `canEdit` à partir de trois faits locaux :
`assigned_pm_id`, l'appartenance à l'équipe du programme, ou le rôle. Or le
serveur n'autorise une écriture de programme que sur **une** règle :

```
programs.edit  ET  program_managed   (le profil program_manager sur CE programme)
```

Deux conséquences :

1. un **assistant/associé** (`assigned_assistant_id`) voyait les boutons
   d'écriture alors que le serveur les refuse — aucune migration ne lui donne le
   profil `program_manager` ;
2. un gestionnaire dont le profil ne couvre pas ce programme voyait les mêmes
   boutons.

L'écran promettait donc plus que le serveur n'accordait.

## 2. La projection

`src/services/authorization/programAccessProjection.js` interroge la **décision
unifiée** (`decide`, D-3) — la même que les routes d'écriture — et renvoie :

```json
{ "edit": true, "publish": false, "reason": "granted" }
```

`publish` n'est demandé que si `edit` est accordé (niveau plus strict de la même
capacité), ce qui garde la page en lecture seule à une seule lecture de
périmètre.

`GET /api/pm/full-state` ajoute `access` à son bundle. Le contrôleur reste mince :
la décision est dans le service, la route ne fait que l'attacher à la réponse.

## 3. L'écran

- la page mémorise `serverAccess` (`null` tant que le serveur n'a pas répondu) et
  le passe au sélecteur ;
- `selectProgramAccess` répond **uniquement** `Boolean(serverAccess.edit)` :
  aucune règle locale ne peut plus diverger de la décision ;
- sans réponse serveur, l'espace est en lecture seule (refus par défaut) ; en
  pratique la page affiche son chargement jusqu'au bundle, donc aucun clignotement.

Les drapeaux `isAssignedPm` / `isTeamMember` restent : ils décident de la
**visibilité des onglets**, pas d'un droit d'écriture.

## 4. Ce que ce changement rend visible

Un assistant/associé perd les boutons d'écriture qu'il voyait. Ce n'est pas une
régression : le serveur les refusait déjà (`program_managed` ne lui donne pas le
profil). Si le produit veut qu'un assistant édite un programme, la décision est
de **lui donner le profil** (`program_manager` sur ce programme), pas de
rétablir une seconde règle dans l'écran.

## 5. Compteurs

| Indicateur | Avant 7.3 | Après 7.3 |
|---|---:|---:|
| Comparaisons de rôle hors moteur | 299 | **299** |
| Exceptions figées du garde-fou rôles | 186 | **186** |
| Actions en dette | 60 | 60 |

Le point d'entrée unifié gagne son premier consommateur réel (une projection
d'affichage) ; le compteur « actions » du §3 ne le voit pas, puisqu'aucune route
n'appelle `requireScopedAccess` directement.

## 6. Tests

- `program-access-projection.test.js` — **6 tests** : la composition (quelles
  questions, dans quel ordre), le court-circuit de `publish`, et les trois états
  de l'écran (accordé, refusé malgré l'affectation, pas encore de réponse).
- `program-workspace-wiring` vert.
- `services-boundaries` / couche : **875 tests** verts.
- `npm run test:authz` → 7 suites / 57 tests verts ; cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

Les échecs préexistants restent identiques (vérifiés sur `HEAD` propre) :
`permissions-characterization`, `identity-gate-bridge`, `reminders-routes` et les
sept suites venture déjà connues.

## 7. Retour arrière

`git revert`. `access` est un champ additif : un client qui l'ignore retrouve
seulement l'ancien calcul local. Aucune écriture en base.

## 8. Compte rendu

```
LOT 7 — Une seule projection pour l'interface — étape 7.3
Fait :
  - projectProgramAccess compose la décision unifiée pour un programme
  - /api/pm/full-state renvoie access { edit, publish, reason }
  - l'espace de travail n'affiche que ce que le serveur accordera
Compteurs : inchangés (299 comparaisons, 186 exceptions, 60 actions en dette).
Divergences : les assistants/associés perdent des boutons que le serveur
  refusait ; la décision produit est de leur donner le profil, pas une règle UI.
Tests : 6 ajoutés + 875 de couche + 57 authz, verts. Lint 0 erreur.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : Lot 8 — preuve de trafic pour les routes retirées, migration
  des identités contextuelles legacy, puis suppression éventuelle de la sonde de
  `decide` (redondante avec le garde-fou de route depuis 8.1).
```
