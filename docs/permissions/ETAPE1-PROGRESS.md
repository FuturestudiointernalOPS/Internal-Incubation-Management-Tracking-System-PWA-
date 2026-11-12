# Étape 1 — premier lot (terminé)

Statut : **premier lot terminé le 2026-11-12**. Aucune décision d'accès n'a
changé.

Objectif de l'étape : plus aucune valeur « qui a le droit » n'est lue à
l'exécution depuis le code. Ce premier lot supprime le dernier repli runtime et
ajoute les contrôles qui empêchent la régression. Les données de seed restent,
pour l'instant, dans des modules de migration ; leur déplacement vers un
fichier de données versionné est le lot suivant.

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

---

## Ce qui ne change pas

- Les décisions d'autorisation, l'éligibilité, les profils, les menus et les
  adresses d'arrivée sont identiques.
- Le contournement du propriétaire est intact (étape 2, après la photographie
  de production).
- Les valeurs de seed restent dans les modules de migration. Elles ne sont plus
  lues à l'exécution.

---

## Validation

| Vérification | Résultat |
|---|---|
| `npm run authz:doctor` sur staging | AVERTISSEMENTS |
| Suites ciblées (6) | 85 tests passés |
| Garde statique + modèle | 22 tests passés |
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

## Lot suivant (étape 1, suite)

1. Déplacer les données de seed (profils, droits de profil, profil par défaut
   de rôle, éligibilités, responsabilités) vers un **fichier de données
   versionné** appliqué comme migration, puis supprimer les constantes lues par
   les fonctions de seed.
2. Faire du diagnostic `authz:doctor` une étape obligatoire du déploiement.
3. Après la photographie de production : accorder ou retirer explicitement les
   15 droits du propriétaire, puis seulement envisager l'étape 2.
