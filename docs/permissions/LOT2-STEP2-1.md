# Lot 2 — étape 2.1 : l'ordre de la décision

> Date : 2026-10-20. Objectif : figer l'ordre des questions posées par la
> décision centrale, et documenter les écarts avec l'ordre cible du plan.
>
> Aucun changement de comportement dans cette étape : elle mesure et documente.

---

## 1. Ordre observé

La décision unique est `explainAuthorization`, dans
`src/services/authorization/contextDecisions.js`. Elle répond dans cet ordre :

| # | Question | Raison renvoyée |
|---|---|---|
| 1 | Entrée valide ? (contexte, module, capacité) | `invalid_input` |
| 2 | Propriétaire de la plateforme ? | `super_admin` (ou `blocked` / niveau) |
| 3 | Compte actif ? | `account_not_active` |
| 4 | Identité éligible à la section ? | `not_eligible` |
| 5 | Restriction explicite ? | `blocked` |
| 6 | Niveau de capacité suffisant ? | `missing_permission` / `insufficient_level` |

`authorize` délègue à cette fonction : le booléen et la justification ne peuvent
pas diverger.

---

## 2. Écarts avec l'ordre cible

| Écart | Détail | Statut |
|---|---|---|
| Le compte est testé **après** le propriétaire de la plateforme | un propriétaire désactivé garde l'accès | **décision produit à prendre** (déjà notée dans `BACKLOG.md`) |
| Le périmètre n'est **pas** dans la décision centrale | `explainAuthorization` ne reçoit aucune ressource ; le périmètre est vérifié par les gardes de ressource | **Lot 3** (coupler capacité et périmètre) |
| La restriction est testée **avant** le niveau de capacité | l'ordre cible place la capacité avant la restriction | sans impact de sécurité : le refus est le même, seule la raison affichée change |

Ces écarts sont volontairement laissés tels quels : les corriger est un
changement de règle, pas un refactor. Ils seront traités avec la décision
produit correspondante.

---

## 3. Conséquence pour l'étape 2.2

La forme de la réponse peut être unifiée **sans** toucher à cet ordre. C'est ce
que fait l'étape 2.2 : un seul constructeur, un seul corps, des codes traduits.
