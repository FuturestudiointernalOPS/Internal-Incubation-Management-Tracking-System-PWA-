# Lot 2 — étape 2.4 : le point d'entrée unifié, adopté pour sa forme

> Date : 2026-10-20. Décision D-3 : **adopter la forme, garder le périmètre
> actuel**. Aucun changement de réponse.

---

## 1. Ce qui décidait avant

Quatre portes coexistaient :

| Porte | Question | Volume |
|---|---|---:|
| Contrôle de capacité global | « ce droit, quelque part ? » | ~177 fichiers |
| Périmètre programme | « staffée sur ce programme ? » | ~25 fichiers |
| Périmètre venture | « cette venture est-elle la sienne ? » | ~38 fichiers |
| Listes de rôles en dur | décide sans capacité ni périmètre | ~177 occurrences |

Le droit et le périmètre étaient donc décidés à deux endroits, et c'était la
route qui choisissait d'appeler les deux — d'où **0 des 31** appels de périmètre
programme qui vérifiaient aussi la capacité.

---

## 2. Ce que vise le point d'entrée unifié

Une seule question : « cette personne peut-elle faire **ceci**, sur **cet
enregistrement** ? » Il reçoit le droit, le type de ressource et son identifiant,
enchaîne le droit global puis le périmètre, et rend **une décision** avec une
raison stable (`granted`, `super_admin`, `missing_permission`, `out_of_scope`,
`missing_resource`, `unauthenticated`, `system_failure`).

---

## 3. Pourquoi il n'a pas été adopté tel quel

Son calcul de périmètre n'était pas celui des gardes en vigueur :

| Ressource | Garde en vigueur | Ancien point d'entrée | Effet d'une adoption directe |
|---|---|---|---|
| Programme | personnel affecté **ou** gestionnaire enregistré | personnel affecté **ou** rôle de contact | élargit l'accès aux porteurs d'un rôle de contact |
| Venture | adhésion **ou** personnel délégué | adhésion **seule** | retire l'accès aux personnels délégués |

C'était un changement de règle déguisé en refactor.

---

## 4. Ce qui a été fait

Le point d'entrée applique maintenant **les politiques déjà en vigueur** :

| Ressource | Politique appliquée | Politique mesurée en ombre |
|---|---|---|
| Programme | `program_staffed` | `program_managed` (profil — cible Lot 3) |
| Venture | `venture_own` | — (c'est déjà la cible) |
| Projet | adhésion au projet (aucune politique déclarée) | — |

Le mode ombre compare toujours la règle appliquée à la règle qui la remplacera
(le profil `program_manager`), sans jamais changer l'issue. La mesure qui
justifiera la bascule du Lot 3 est donc conservée.

Pour une venture, l'identifiant est normalisé (code ou identifiant interne)
avant la comparaison, comme le faisait déjà la garde.

---

## 5. Ce qui reste

Le point d'entrée n'a encore **aucun appelant** : son adoption par les routes
est le Lot 3 (coupler capacité et périmètre, par lots de 10, avec mesure ombre).
L'ancien résolveur d'affectation reste exporté : il n'est plus sur le chemin de
décision et son retrait est un candidat du Lot 8, une fois la preuve d'inutilité
établie.

---

## 6. Compteurs

| Indicateur | Avant 2.4 | Après 2.4 |
|---|---:|---:|
| Politiques de périmètre appliquées par la décision unifiée | ad hoc (lecture directe) | **déclarées** (`program_staffed`, `venture_own`) |
| Divergence de comportement attendue | — | **0** |
| Mesure ombre conservée pour la bascule profil | oui | **oui** |
| Appelants du point d'entrée | 0 | 0 (migration = Lot 3) |

---

## 7. Tests

- `permissions-scope-shadow` réécrit : la politique appliquée est
  `program_staffed`, la politique mesurée `program_managed`, l'issue ne change
  jamais.
- `permissions-scoped-reason` et `context-access` alignés sur les politiques
  déclarées.
- `npm run test:authz` → 7 suites / 54 tests verts.
- Périmètre élargi → **1318 tests verts** ; `npm run lint` → 0 erreur.

---

## 8. Retour arrière

`git revert` du commit. Aucune écriture en base.

---

## 9. Compte rendu

```
LOT 2 — Une seule décision, une seule forme de refus — étape 2.4
Fait :
  - le point d'entrée unifié applique les politiques des gardes existantes
  - mesure ombre conservée vers le profil program_manager
  - identifiant venture normalisé avant comparaison
  - tests d'alignement réécrits
Compteurs :
  - divergence de comportement : 0
  - politiques appliquées : déclarées au lieu d'ad hoc
  - appelants : 0 (migration prévue au Lot 3)
Tests ajoutés / passants : suites d'alignement vertes ; 1318 verts au total.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : Lot 3 — coupler capacité et périmètre, migrer les 31 appels
  par lots de 10, puis D-4 (périmètre programme = profil).
```
