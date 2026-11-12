# Étape 1 — premier et deuxième lots (terminés)

Statut : **les deux premiers lots sont terminés le 2026-11-12**. Aucune décision
d'accès n'a changé.

Objectif de l'étape : plus aucune valeur « qui a le droit » n'est lue à
l'exécution depuis le code. Le premier lot supprime le dernier repli runtime et
ajoute les contrôles qui empêchent la régression. Le deuxième centralise toutes
les données de seed dans un fichier inerte et fournit l'outil d'application
idempotent.

---

## Ce qui change

### 1. Plus de repli code pour l'avertissement d'incompatibilité

Un rôle assigné à une responsabilité pouvait être signalé « incompatible »
même quand la base n'avait jamais configuré cette responsabilité : le code
fournissait alors la liste par défaut. Ce repli est supprimé.

Désormais :

- responsabilité **non configurée** → aucun avertissement ;
- responsabilité configurée avec une liste → avertissement seulement si le
  rôle est absent ;
- liste vide explicite (« personne ») → avertissement pour tout le monde.

C'est un avertissement d'interface, pas une décision d'accès. Aucun droit n'est
accordé ou retiré par ce changement.

### 2. Diagnostic de complétude de la base

Nouveau : `npm run authz:doctor`.

Il vérifie, en lecture seule :

- la présence des profils, de leurs droits, des profils par défaut de rôle et
  des éligibilités ;
- les fonctionnalités sans aucune ligne d'éligibilité ;
- les responsabilités sans configuration ;
- les droits du catalogue absents du profil du propriétaire ;
- les rôles stockés hors du vocabulaire de base.

Il sort en erreur si la base est **critique**, et peut traiter les
avertissements comme bloquants avec `--strict`. C'est le contrôle à lancer
avant un déploiement.

### 3. Garde statique du moteur de décision

Un test interdit désormais aux fichiers du moteur de décision d'importer une
valeur de seed (`FEATURE_ELIGIBILITY_DEFAULTS`,
`FEATURE_ELIGIBILITY_PROFILE_DEFAULTS`, `PROGRAM_ASSIGNMENT_ROWS`,
`PROFILE_CATALOGUE_SEED`, `ROLE_PROFILE_DEFAULTS_SEED`,
`RESPONSIBILITY_FEATURE_ROLES`).

Ainsi, une future modification ne pourra pas réintroduire une décision d'accès
lue dans le code sans faire échouer la suite de tests.

### 4. Données de seed centralisées et inertes

Toute la configuration initiale (éligibilités, profils, droits de profil,
profils par défaut de rôle, catalogue des responsabilités) vit maintenant dans
**un seul fichier de données** : `src/models/authorization/seedData.js`.

Ce fichier ne contient ni import, ni accès base, ni fonction. Les anciens
points d'entrée le ré-exportent, donc aucun écran ni test ne change de chemin.
Un test vérifie qu'il reste inerte et qu'aucune copie ne réapparaît.

### 5. Outil d'application idempotent

Nouveau : `npm run authz:apply-defaults`.

Il copie les données versionnées dans une base, **sans jamais écraser une ligne
existante**. Il est en **simulation par défaut** : tout s'exécute dans une
transaction annulée, et les compteurs affichent exactement ce qui serait écrit.
`--apply` écrit réellement. `--details` liste chaque ligne concernée.

---

## Ce qui ne change pas

- Les décisions d'autorisation, l'éligibilité, les profils, les menus et les
  adresses d'arrivée sont identiques.
- Le contournement du propriétaire est intact (étape 2, après la photographie
  de production).
- Les valeurs de seed sont désormais centralisées dans un fichier inerte ; elles
  ne sont toujours pas lues par le moteur de décision.

---

## Validation

| Vérification | Résultat |
|---|---|
| `npm run authz:doctor` sur staging | AVERTISSEMENTS |
| Suites ciblées (7) | 59 tests passés |
| Données de seed + garde statique | 31 tests passés |
| Photographie avant / après | **0 changement, 0 régression, 0 ouverture** |

### Verdict du diagnostic sur staging

- 16 profils, 209 droits de profil, 8 profils par défaut, 56 lignes
  d'éligibilité, 22 responsabilités.
- **15 droits du catalogue manquent au profil du propriétaire** (CRM, doublons,
  import en masse, collections, groupes de programmes, portefeuille de
  rapports, gestion du schéma, invitation de familles).
- Deux rôles stockés hors vocabulaire de base (`investor`, `applicant`) : ils
  sont normalisés à la connexion, donc sans effet sur les décisions.
- Aucune responsabilité non configurée.

---

## Simulation d'application sur staging

`npm run authz:apply-defaults -- --details` (transaction annulée) annonce
**33 écritures** :

- 1 éligibilité manquante : `investors:member` ;
- 15 droits du propriétaire (CRM, doublons, import en masse, collections,
  groupes de programmes, portefeuille de rapports, gestion du schéma,
  invitation de familles) ;
- 5 droits de profils : `staff_default.ventures.view_all`,
  `program_manager.programs.edit`, `program_manager.programs.publish`,
  `course_manager.lms.view`, `course_manager.lms.edit` ;
- 12 mises à jour de métadonnées des responsabilités (déjà identiques).

Aucune de ces lignes n'est une perte d'accès : ce sont des compléments prévus
par les données de seed, absents de la base. **Elles ne sont pas encore
appliquées** : l'écriture réelle attend un accord explicite.

## Décision attendue

Appliquer ces 33 lignes maintenant (dont les 15 droits du propriétaire et les 6
compléments non-propriétaire), ou attendre la photographie de production ?

## Reste à faire

1. Appliquer — ou non — les données de seed en staging.
2. Faire de `authz:doctor` une étape obligatoire du déploiement.
3. Après la photographie de production : accorder ou retirer explicitement les
   15 droits du propriétaire, puis seulement envisager l'étape 2.
