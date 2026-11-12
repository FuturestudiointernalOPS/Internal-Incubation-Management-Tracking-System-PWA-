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
| `npm run test:authz` | **14 suites, 101 tests passés** |
| Données de seed + garde statique | **31 tests passés** |
| `npm run authz:doctor` après application | AVERTISSEMENTS (1 : rôles stockés legacy) |
| Photographie avant application | 0 changement |
| Photographie après application | **0 régression, 19 ouvertures de droits, 17 ouvertures d'éligibilité, 9 entrées de menu ajoutées** |

### Application effectuée sur staging (2026-11-12)

`npm run authz:apply-defaults -- --apply` a écrit **33 lignes** :

- 1 éligibilité manquante : `investors:member` ;
- 15 droits du propriétaire (CRM, doublons, import en masse, collections,
  groupes de programmes, portefeuille de rapports, gestion du schéma,
  invitation de familles) ;
- 5 droits de profils : `staff_default.ventures.view_all`,
  `program_manager.programs.edit`, `program_manager.programs.publish`,
  `course_manager.lms.view`, `course_manager.lms.edit` ;
- 12 mises à jour de métadonnées des responsabilités.

Résultat du diagnostic :

- 16 profils, **229** droits de profil, 8 profils par défaut, **57** lignes
  d'éligibilité, 22 responsabilités ;
- **0 droit manquant** pour le propriétaire ;
- aucune responsabilité non configurée ;
- seuls les deux rôles stockés legacy (`investor`, `applicant`) restent
  signalés : ils sont normalisés à la connexion.

La comparaison ne montre **aucune régression** :

- 4 membres du personnel gagnent `ventures.view_all` ;
- le propriétaire gagne les 15 droits attendus et 9 entrées de menu CRM ;
- 17 personnes deviennent éligibles à la fonctionnalité « investisseurs » ;
- les droits ajoutés aux profils `program_manager` et `course_manager` ne
  changent aucune décision aujourd'hui : aucun compte n'a encore ces profils
  comme profil de base.

## Reste à faire

1. **Photographie de production** (`--env .env.prod-verify --allow-production`).
2. **Étape 2** : retirer le contournement du propriétaire, puis comparer.
3. Traiter les deux rôles stockés legacy (`investor`, `applicant`) si l'on veut
   un diagnostic sans avertissement.

La checklist de déploiement (`docs/permissions/DEPLOYMENT_CHECKLIST.md`) rend
`authz:doctor --strict` obligatoire avant et après chaque déploiement.
