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

## 3. La bascule de priorité (faite)

La résolution du niveau effectif applique désormais **le profil d'abord, et
seulement lui** :

1. le profil de l'affectation, ou celui que son **rôle** désigne quand la clé
   manque (une affectation « facilitateur » créée après la migration résout donc
   le profil `facilitator` sans dépendre de la colonne) ;
2. la grille par défaut du programme ;
3. sinon 0.

Les cases cochées **ne décident plus**. Elles restent lues uniquement quand le
mode ombre est actif, pour que la règle remplacée reste visible.

Deux précautions d'ordre de démarrage : la garde facilitateur ne passe pas par
le résolveur d'autorisation, qui est le point où les migrations one-shot sont
attendues. Elle attend donc elle-même les migrations mémorisées du processus
avant de lire le profil — ce qui évite qu'une instance froide décide avant que
la graine n'existe. Après le premier appel, l'attente est gratuite.

Une fois le profil en place, la bascule ne déplace **aucun droit réel** : les
7 capacités vérifiées sont dans le profil au même niveau que les cases.

---

## 4. Compteurs

| Indicateur | Avant 3.4 | Après 3.4 |
|---|---:|---:|
| Sources qui décident | 2 (cases prioritaires) | **1** (profil) |
| Capacités du profil `facilitator` | 0 | **7** (semées, insert-only) |
| Affectations portant la clé de profil | 0 | **1** (à la prochaine exécution) |
| Règle mesurée en ombre | la cible (profil) | **la règle remplacée** (cases) |
| Divergence de comportement attendue | — | **0** |

---

## 5. Tests

- `facilitator-rights-source` : la case ignorée (objet et chaîne JSON), la clé
  dérivée du rôle, la clé explicite prioritaire, le zéro explicite, le repli sur
  la grille du programme, et la mesure en ombre (divergence journalisée, issue
  inchangée).
- `server/authz-boundaries` aligné : la case ne gagne plus, le profil décide.
  Les migrations y sont neutralisées (elles ne sont pas le sujet des gardes).
- `authorization-model`, `phase8-automatic-triggers`, `program-assignment-resolver`
  verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- Périmètre élargi → **4195 tests verts** (hors la suite de compatibilité
  `server/auth-boundaries`, dont l'échec préexiste sur `HEAD`).
- `npm run lint` → 0 erreur.

---

## 6. Retour arrière

- Le code : `git revert`. La priorité des cases revient avec lui.
- Les migrations sont insert-only et n'ont rien supprimé : les annuler n'est pas
  nécessaire pour revenir au comportement précédent.
- La mesure en ombre disparaît avec le drapeau (`AUTHZ_SHADOW_MODE`).

---

## 7. Compte rendu

```
LOT 3 — Un seul périmètre programme — étape 3.4
Fait :
  - mesure des deux sources (1 affectation, 1 case cochée, 0 clé de profil)
  - profil facilitator semé (7 capacités, insert-only)
  - clé de profil posée sur les affectations (migration dédiée)
  - bascule de priorité : le profil décide, les cases sont mesurées en ombre
  - profil dérivé du rôle quand la clé manque (affectations futures)
  - la garde attend les migrations mémorisées (instance froide)
Compteurs :
  - sources qui décident : 2 -> 1
  - capacités du profil : 0 -> 7
  - clés de profil : 0 -> 1
  - divergence de comportement : 0
Tests ajoutés / passants : 10 tests dédiés ; 4195 verts.
Décisions requises : aucune.
Retour arrière : git revert (les migrations insert-only n'ont rien supprimé).
Prochaine étape : étape 3.5 (réduire les 7 politiques de périmètre), puis Lot 4.
```
