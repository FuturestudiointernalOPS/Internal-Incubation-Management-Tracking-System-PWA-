# Lot 3 — étape 3.3 : un seul calcul d'affectation

> Date : 2026-10-20. Objectif : une seule réponse à la question « quelle
> affectation cette personne a-t-elle dans ce programme ? ».

---

## 1. Le doublon mesuré

Deux modules répondaient à la même question avec des règles différentes :

| Module | Table du personnel | Repli rôles de contact |
|---|---|---|
| Garde facilitateur | lignes `role = 'facilitator'` seulement | toute ligne courante |
| Décision de périmètre | **tout rôle** (facilitateur, gestionnaire, assistant…) | toute ligne courante |

Selon la porte qui demandait, la même personne pouvait donc avoir — ou ne pas
avoir — une affectation.

---

## 2. Ce qui a changé

Un seul service résout l'affectation :

1. la ligne de la table du personnel, éventuellement **restreinte à un rôle** ;
2. sinon, la couche généralisée des rôles de contact.

Le filtre de rôle s'applique à la table du personnel, exactement comme le faisait
la garde facilitateur ; la couche généralisée garde son comportement historique.

| Appelant | Demande | Résultat |
|---|---|---|
| Garde facilitateur | rôle `facilitator` | inchangé |
| Décision de périmètre unifiée | n'importe quel rôle | inchangé |
| Lecture générique (rapports, préparation) | n'importe quel rôle | inchangé |

Le modèle de lecture accepte désormais ce filtre, pour qu'une seule requête
serve les deux questions au lieu de deux requêtes dupliquées.

---

## 3. Point de conception découvert

La décision unifiée appliquait une seule politique de périmètre par ressource.
Or un programme a **deux intentions** :

- la **gestion** (écrire) → profil de gestionnaire (D-4) ;
- la **livraison** (animer : présence, séances, correction) → l'affectation.

Un seul appel ne pouvait pas les distinguer. La décision accepte donc
maintenant une politique de périmètre explicite, comme elle accepte déjà une
capacité explicite : l'appelant nomme l'intention, la décision l'applique. Sans
précision, la politique déclarée de la ressource s'applique.

Le mode ombre ne s'active que sur la politique par défaut : une politique
choisie par l'appelant ne fait pas partie de la bascule mesurée.

---

## 4. Compteurs

| Indicateur | Avant 3.3 | Après 3.3 |
|---|---:|---:|
| Implémentations du calcul d'affectation programme | 2 | **1** |
| Requêtes de lecture du personnel programme | 2 (rôle fixe + tout rôle) | **1** paramétrée |
| Intents de périmètre programme exprimables | 1 | **2** (gestion, livraison) |

---

## 5. Tests

- `program-assignment-resolver` (nouveau) : ordre, filtre de rôle, repli,
  refus de fabriquer une affectation, question inutilisable.
- `context-access` aligné sur les deux intentions.
- `npm run test:authz` → 7 suites / 54 tests verts.
- Périmètre élargi → **4194 tests verts** (hors la suite de compatibilité
  `server/auth-boundaries`, dont l'échec préexiste sur `HEAD` : son simulacre
  d'identité est incomplet).

---

## 6. Retour arrière

`git revert`. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 3 — Un seul périmètre programme — étape 3.3
Fait :
  - un seul calcul d'affectation, paramétré par rôle
  - garde facilitateur et décision unifiée partagent la même réponse
  - la décision unifiée accepte la politique de périmètre de l'appelant
Compteurs :
  - implémentations : 2 -> 1
  - requêtes de lecture : 2 -> 1 paramétrée
  - intentions exprimables : 1 -> 2
Tests ajoutés / passants : 1 suite dédiée ; 4194 verts.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : étape 3.4 — la source unique des droits du facilitateur (D-5).
```
