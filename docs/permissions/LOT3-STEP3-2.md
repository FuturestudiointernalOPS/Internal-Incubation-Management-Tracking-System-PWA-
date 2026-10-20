# Lot 3 — étape 3.2 : capacité et périmètre décidés ensemble

> Date : 2026-10-20. Objectif : chaque appel de périmètre programme nomme le
> droit qu'il exige, au lieu de laisser la route le vérifier ailleurs — ou nulle
> part.

---

## 1. Inventaire des 31 appels

| Où le droit était vérifié | Appels | Traitement |
|---|---:|---|
| Capacité déjà contrôlée dans le même gestionnaire | 19 | capacité passée à l'appel de périmètre |
| Liste de rôles seulement | 12 | capacité `programs.edit` ajoutée |
| Droit différent selon le camp (scoring) | 1 | laissé tel quel — décision de conception requise |
| Couplé via un paramètre de helper | 1 | couplé, mais invisible au compteur textuel |

Après l'étape : **29 des 31** appels nomment leur capacité ; les deux autres sont
expliqués ci-dessous.

---

## 2. Lot 1 — 19 appels sans changement de comportement

La route vérifiait déjà le droit avant d'arriver au périmètre. La capacité est
maintenant portée par l'appel lui-même, pour que les deux décisions ne puissent
plus se séparer si le contrôle antérieur bouge.

| Domaine | Appels | Capacité |
|---|---:|---|
| Groupes (création, mise à jour, suppression) | 3 | `permissions.assign_capabilities` |
| Curriculum programme | 3 | `programs.edit` |
| Export programme | 1 | `reports.export` |
| Programmes (édition, suppression) | 2 | `programs.edit` / `programs.delete` |
| Équipes programme | 3 | `programs.edit` |
| Rapports programme | 1 | `programs.edit` |
| Tâches d'équipe | 1 (helper) | `tasks.view/create/edit/delete` selon la méthode |
| Exigences LMS de programme | 4 | `lms.view` (lecture) / `lms.edit` (écriture) |
| File de coaching LMS | 1 | `lms.view` |

---

## 3. Lot 2 — 12 appels dont le droit n'était vérifié nulle part

Ces routes n'avaient qu'une liste de rôles (`staff`, `super_admin`,
`program_manager`) puis un contrôle de périmètre. Le droit écrit n'était donc
jamais demandé.

Elles exigent maintenant **`programs.edit`**, la capacité que porte le profil
`program_manager` (D-1, D-4) :

| Surface | Appels |
|---|---:|
| Invitation groupée de facilitateurs | 1 |
| Ajout d'un participant à une équipe | 1 |
| Indicateurs (création, mise à jour, suppression) | 3 |
| Inscription en masse à un programme | 1 |
| Mise à jour de la fiche programme | 1 |
| Équipes (création, mise à jour, suppression) | 3 |
| Affectation / retrait d'un participant (service) | 2 |

### Changement de comportement — assumé et mesuré

- **Avant** : un membre du personnel **affecté** au programme mais **sans le
  profil de gestionnaire** pouvait écrire (indicateurs, équipes, inscription,
  invitations, fiche programme).
- **Après** : il lui faut `programs.edit`. Le profil `staff` par défaut ne porte
  que `programs.view` ; le profil `program_manager` porte `programs.edit`.
- **Qui garde l'accès** : le gestionnaire de programme assigné, et le
  propriétaire de la plateforme (contournement).
- **Qui le perd** : un facilitateur affecté au programme qui n'est pas son
  gestionnaire. C'est la conséquence directe de D-4 : la gestion d'un programme
  est une fonction, pas un effet secondaire de l'affectation.

Si le produit veut qu'un facilitateur inscrive des participants ou crée des
équipes, la bonne réponse est une capacité dédiée (par exemple
`facilitator.participants.manage`), pas l'élargissement de `programs.edit`.

---

## 4. Les deux appels restants

| Appel | Pourquoi | Suite |
|---|---|---|
| `PUT /api/submissions` (écriture d'une note) | le droit diffère selon le camp : `assignments.grade` pour un facilitateur, `programs.edit` pour l'encadrement. Un seul appel ne peut pas exprimer « l'un ou l'autre ». | décision de conception : ajouter la capacité au catalogue, ou faire deux appels selon le chemin |
| Tâches d'équipe (helper) | le helper reçoit `module` et `capability` en paramètres ; chaque méthode en fournit un, mais la ligne de l'appel ne contient pas le mot `capability` | couplé ; le compteur textuel le sous-estime |

Aucun autre appel ne laisse le droit dans le vide.

---

## 5. Garde-fou

Nouveau test dans `program-scoped-access.test.js` : un appel de périmètre
programme qui ne nomme pas de capacité fait échouer la suite, sauf les deux
entrées documentées ci-dessus. La liste ne peut que rétrécir.

---

## 6. Compteurs

| Indicateur | Avant 3.2 | Après 3.2 |
|---|---:|---:|
| Appels de périmètre programme | 31 | **31** |
| dont vérifiant aussi la capacité | 0 | **29** |
| dont couplés mais invisibles au compteur | 0 | **1** |
| dont en attente d'une décision de conception | 0 | **1** |

---

## 7. Tests

- `npm run test:authz` → 7 suites / 54 tests verts.
- Périmètre élargi (tâches, ventures, sécurité lots 1→14, phases, groupes,
  équipes, programmes, KPI, soumissions, LMS, facilitateur) → **1992 tests
  verts**.
- Les 7 suites venture en échec le sont **déjà sur `HEAD`** (mocks de requêtes).
- `npm run lint` → 0 erreur.
- Cliquet des permissions respecté (le compteur de couverture monte).

---

## 8. Retour arrière

`git revert` du commit. Aucune écriture en base. Le changement de comportement
de la section 3 disparaît avec le revert.

---

## 9. Compte rendu

```
LOT 3 — Un seul périmètre programme — étape 3.2
Fait :
  - 19 appels passent la capacité déjà vérifiée par la route
  - 12 appels sans droit écrit exigent désormais programs.edit
  - garde-fou : un nouvel appel sans capacité échoue
  - un appel de scoring laissé ouvert, décision de conception documentée
Compteurs :
  - appels de périmètre programme avec capacité : 0/31 -> 29/31
  - 1 couplé via paramètre, 1 en attente de décision
Divergences en mode ombre : sans objet (pas de bascule de règle de périmètre).
Tests ajoutés / passants : 1 garde-fou ; 1992 verts sur le périmètre élargi.
Décisions requises : droit du scoring (PUT submissions) ; éventuelle capacité
  dédiée pour l'inscription/les équipes côté facilitateur.
Retour arrière : git revert, aucun impact base.
Prochaine étape : étape 3.1 — basculer le périmètre programme sur le profil
  `program_manager` (D-4 confirmée), mesuré en ombre.
```
