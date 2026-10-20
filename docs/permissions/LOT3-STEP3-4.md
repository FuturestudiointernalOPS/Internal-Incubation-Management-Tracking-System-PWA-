# Lot 3 — étape 3.4 : une seule source pour les droits du facilitateur (D-5)

> Date : 2026-10-20. Décision D-5 : le **profil** est la source unique. Les cases
> cochées de l'affectation deviennent dérivées, puis disparaissent.

---

## 1. La mesure avant la bascule

Audit en lecture seule (`scripts/db-audit/facilitator-rights-compare.sql`),
sur la base pointée par `.env.local` :

| Constat | Valeur |
|---|---:|
| Affectations de facilitateur | 1 |
| … avec une case cochée (source actuelle) | **1** |
| … avec une clé de profil | **0** |
| Droits portés par le profil `facilitator` | **0** (profil sans aucune capacité) |
| Droits portés par la grille du programme | `{}` |

Conclusion : aujourd'hui, **les cases cochées sont la seule source**. Basculer
directement aurait supprimé tous les droits du facilitateur, puisque le profil
ne porte rien et aucune affectation ne le référence.

C'est exactement le cas que la règle « remplir avant de basculer » existe pour
arrêter.

---

## 2. Ce qui a été fait — sans changer aucun droit

### a. Le profil `facilitateur` est semé

Le profil existait comme clé dans le catalogue mais n'avait **aucune capacité**,
et la graine du catalogue est enregistrée une fois par base : ajouter une entrée
ne suffit pas pour une base existante. Deux migrations dédiées ont été ajoutées :

| Migration | Effet |
|---|---|
| `facilitator-profile-seed-v1` | crée le profil et ses 7 capacités, insert-only |
| `facilitator-profile-key-v1` | donne la clé `facilitator` aux affectations de facilitateur qui n'en ont pas |

Les 7 capacités sont celles qui sont **réellement vérifiées** : consultation des
participants, présence (lecture et saisie), affectations (lecture et notation),
conduite de séance, revue. Niveau 2, comme les cases actuelles.

Les deux migrations sont insert-only : un choix d'administrateur n'est jamais
écrasé. Tant que les cases gardent la priorité, **poser la clé ne change aucune
réponse** — elle supprime seulement le trou de données qui aurait bloqué la
bascule.

### b. La source cible est mesurée en ombre

La résolution du niveau effectif calcule désormais, quand le mode ombre est
actif, ce que le **profil** répondrait, et journalise chaque divergence. La
décision reste celle des cases. Une erreur du sondage ne change rien.

### c. Une constatation utile

La case cochée de l'affectation porte 12 clés ; seules **7** sont vérifiées par
une route. Les 5 autres (`groups.*`, `progress.view`, `participants.manage`,
`sessions.record`, `assignments.review`) ne sont référencées nulle part dans le
code : ce sont des restes. Retirer la priorité des cases ne changera donc rien
pour les droits réellement appliqués.

---

## 3. Ce qui n'est PAS fait

La bascule elle-même — donner la priorité au profil — n'est pas faite. Elle
attend :

1. que les deux migrations aient tourné sur la base ciblée (à la première
   exécution après déploiement) ;
2. que le rapport d'ombre soit propre, ou que chaque divergence soit expliquée.

Une fois ces deux conditions réunies, la bascule est une inversion de priorité
dans la résolution du niveau, protégée par les tests de cette étape.

---

## 4. Compteurs

| Indicateur | Avant 3.4 | Après 3.4 |
|---|---:|---:|
| Sources lues par la garde facilitateur | 2 (cases, profil) | **2** (inchangé ; la cible est mesurée) |
| Capacités du profil `facilitator` | 0 | **7** (semées, insert-only) |
| Affectations portant la clé de profil | 0 | **1** (à la prochaine exécution) |
| Divergence de comportement attendue | — | **0** |

---

## 5. Tests

- `facilitator-rights-source` (nouveau) : ordre actuel (case → profil → défaut),
  zéro explicite dans le profil, et mesure en ombre sans changement d'issue.
- `authorization-model`, `phase8-automatic-triggers`, `program-assignment-resolver`
  verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run lint` → 0 erreur.

---

## 6. Retour arrière

- Les migrations sont insert-only et inertes : les annuler n'est pas nécessaire
  pour revenir au comportement actuel.
- La mesure en ombre disparaît avec le drapeau (`AUTHZ_SHADOW_MODE`).
- `git revert` pour le code.

---

## 7. Compte rendu

```
LOT 3 — Un seul périmètre programme — étape 3.4
Fait :
  - mesure des deux sources (1 affectation, 1 case cochée, 0 clé de profil)
  - profil facilitator semé (7 capacités, insert-only)
  - clé de profil posée sur les affectations (migration dédiée)
  - source cible mesurée en ombre, jamais appliquée
Compteurs :
  - capacités du profil : 0 -> 7
  - clés de profil : 0 -> 1
  - divergence de comportement : 0
Décisions requises : aucune ; la bascule de priorité est l'étape suivante,
  conditionnée au rapport d'ombre.
Retour arrière : rien à annuler en base (insert-only, inerte), git revert.
Prochaine étape : basculer la priorité (profil d'abord) après un rapport
  d'ombre propre, puis étape 3.5 (réduire les politiques de périmètre).
```
