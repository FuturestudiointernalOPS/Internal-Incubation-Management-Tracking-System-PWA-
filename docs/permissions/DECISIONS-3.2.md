# Décisions produit héritées de l'étape 3.2

> Date : 2026-10-20. Deux points laissés ouverts pendant le lot 3, tranchés
> puis appliqués ici.

---

## 1. Droit de la notation

**Décision** : chaque droit vaut pour son détenteur. Un facilitateur note avec
son droit de correction ; un gestionnaire de programme note avec son droit
d'édition. Aucun des deux ne peut emprunter le droit de l'autre.

**Mise en œuvre** : le contrôle de périmètre accepte désormais une liste
« l'un ou l'autre » (`capabilities`). L'écriture d'une note déclare :

| Camp | Capacité exigée |
|---|---|
| Facilitateur | `facilitator.assignments.grade` |
| Gestionnaire de programme | `programs.edit` |

Le contrôle passe si **l'une** des capacités est détenue — et chaque capacité
n'est portée que par son propre camp, donc l'alternative ne mélange rien. La
réponse nomme les deux capacités quand elle refuse, pour que le refus reste
diagnostiquable.

**Accès** : inchangé pour les deux camps. Un facilitateur qui note garde son
droit ; un gestionnaire qui note garde le sien.

---

## 2. Équipes et affectation des facilitateurs

**Décision** : créer une équipe et affecter un facilitateur sont des opérations
de **plateforme** — réservées à l'administration.

**Mise en œuvre** : ces actions exigent `permissions.assign_groups` (module
sécurité, risque élevé). Aucun profil standard ne porte cette capacité : elle
est donc, par défaut, réservée au propriétaire de la plateforme, et attribuable
plus tard sans changer de code.

Routes concernées :

| Action | Capacité |
|---|---|
| Création / modification / suppression d'équipe (deux surfaces) | `permissions.assign_groups` |
| Invitation groupée de facilitateurs | `permissions.assign_groups` |
| Ajout d'un participant à une équipe | `permissions.assign_groups` |

**Accès** : un gestionnaire de programme **perd** la gestion des équipes et
l'invitation de facilitateurs ; il conserve l'édition du programme, les
indicateurs, l'inscription des participants et les invitations de participants.
Le propriétaire de la plateforme conserve tout.

C'est la première capacité qui n'est portée par aucun profil : elle exprime
« opération de plateforme » sans réintroduire un nom de rôle dans l'action.

---

## 3. Compteurs

| Indicateur | Avant | Après |
|---|---:|---:|
| Appels de périmètre programme avec capacité | 29 / 31 | **30 / 31** |
| Appels restants sans capacité littérale | 2 | **1** (le helper qui la reçoit en paramètre) |
| Capacités exprimées en « l'un ou l'autre » | 0 | **1** |

---

## 4. Tests

- `program-scoped-access` : le balayage n'admet plus qu'une exception (le
  helper) ; il reconnaît la liste « l'un ou l'autre ».
- `security-lot11-team-scope`, `security-lot12-submissions-lms` verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run lint` → 0 erreur.

---

## 5. Retour arrière

`git revert`. Aucune écriture en base.

---

## 6. Compte rendu

```
LOT 3 — décisions 3.2 appliquées
Fait :
  - notation : liste « l'un ou l'autre », chaque camp garde son droit
  - équipes et affectation de facilitateurs : capacité de plateforme
    (permissions.assign_groups), portée par aucun profil standard
Compteurs :
  - appels de périmètre avec capacité : 29/31 -> 30/31
  - accès retirés : gestion des équipes et invitation de facilitateurs pour
    un gestionnaire de programme (voulu) ; notation inchangée
Tests : suites de périmètre et de sécurité vertes ; 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
```
