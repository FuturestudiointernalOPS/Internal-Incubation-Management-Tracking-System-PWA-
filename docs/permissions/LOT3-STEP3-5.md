# Lot 3 — étape 3.5 : un jeu de politiques lisible

> Date : 2026-10-20. Objectif : nommer le rôle de chaque politique de périmètre,
> rendre une redondance visible, et ne supprimer qu'après la mesure.

---

## 1. Les 7 politiques et leur rôle

Le catalogue porte désormais un champ `purpose` explicite, et un test le fige.

| Politique | Rôle | Ce qu'elle répond | Sites (hors tests) |
|---|---|---|---:|
| `venture_own` | **refus** | « cette venture est-elle la sienne » (adhésion ou personnel délégué) | 15 |
| `program_managed` | **refus** | « gère-t-elle ce programme » (profil de gestionnaire) | 10 |
| `program_assigned` | **affichage** | « quels programmes lui sont attachés » (affectation ou inscription) | 5 |
| `learning_own` | **affichage** | « quels cours suit-elle » (inscriptions actives) | 5 |
| `venture_managed_history` | **historique** | ce qu'elle a géré, en lecture seule | 4 |
| `program_managed_history` | **historique** | idem, côté programme | 4 |
| `program_staffed` | **ombre** | la règle que D-4 a remplacée | 6 |

Deux portent l'essentiel des refus, deux servent l'affichage, deux la lecture
historique, une la comparaison. C'est exactement la répartition attendue : il
n'y a pas deux politiques qui répondent à la même question.

---

## 2. La seule redondance, et pourquoi elle reste

`program_staffed` ne protège plus rien : D-4 l'a remplacée par le profil. Elle
ne survit que pour le **rapport d'ombre** — la preuve, en production, que la
bascule n'a rien déplacé.

La supprimer maintenant supprimerait cette preuve. Sa condition de retrait est
écrite dans le catalogue : un rapport d'ombre propre sur une période complète.
Elle est donc marquée `shadow`, et le test échoue si elle réapparaît comme
politique appliquée.

---

## 3. Le garde-fou

`scope-policies.test.js` fige quatre choses :

1. la liste des clés et le catalogue ne divergent pas ;
2. chaque politique a un rôle, et la répartition est 2 / 2 / 2 / 1 ;
3. la décision applique **exactement** les politiques marquées `enforced` ;
4. la règle remplacée reste en ombre et n'est jamais appliquée.

Ajouter une politique, en retirer une ou changer son rôle fait donc échouer la
suite : le jeu ne peut plus dériver en silence.

---

## 4. Compteurs

| Indicateur | Avant 3.5 | Après 3.5 |
|---|---:|---:|
| Politiques déclarées | 7 | **7** |
| Politiques **appliquées** | 3 implicites | **2** explicites (`venture_own`, `program_managed`) |
| Politiques d'affichage | 2 | **2** nommées |
| Politiques historiques | 2 | **2** nommées |
| Politiques en ombre | 1 implicite | **1** nommée, avec condition de retrait |
| Politiques sans rôle déclaré | 7 | **0** |

Aucune réponse ne change : cette étape rend le jeu lisible, elle ne déplace
aucun droit.

---

## 5. Tests

- `scope-policies` (nouveau) : dérive, classification, application, ombre.
- `authorization-model` vert.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run lint` → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 3 — Un seul périmètre programme — étape 3.5
Fait :
  - rôle explicite pour chacune des 7 politiques (refus / affichage / historique / ombre)
  - test qui fige la répartition et interdit qu'une politique remplacée redevienne appliquée
  - condition de retrait écrite pour la règle en ombre
Compteurs :
  - politiques appliquées : 3 implicites -> 2 explicites
  - politiques sans rôle : 7 -> 0
  - changement de comportement : 0
Tests ajoutés / passants : 4 tests de garde.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : Lot 4 — registre déclaratif des actions (supprimer les 282
  exceptions du garde-fou).
```
