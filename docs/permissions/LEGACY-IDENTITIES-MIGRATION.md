# Migration des identités legacy — mode d'emploi

> Date : 2026-10-20. Mesuré sur la base réellement utilisée par l'équipe.
> La migration est écrite, répétable et **simulée par défaut**.

---

## 1. La population mesurée

| Ancien nom | Personnes | Relation active | Ont la fonction | Sessions |
|---|---:|---:|---:|---:|
| `participant` | 563 | 563 | **0** | 0 |
| `facilitator` | 5 | **0** | **0** | 1 |
| `founder` | 1 | 1 | **0** | 2 |
| `investor` | 0 | — | — | — |

### Le cas des 5 facilitateurs

Leurs affectations existent : une ligne chacune, intitulé `facilitator`, sur le
programme `a988c6cd-…`. Mais **ce programme s'est terminé le 2026-09-11** et nous
sommes le 2026-10-20. L'application compare la date de fin à aujourd'hui : elle
considère déjà ces affectations comme terminées.

Il n'y a donc **aucune fonction active à attribuer**. Ces 5 personnes ne
tiendront pas de carte et deviennent membres. Elles ne perdent rien : leur rôle
actuel n'a aucun profil par défaut, donc aucun droit de base.

Un détail d'hygiène, séparé : l'une d'elles (Morgane Chrisnaud) porte encore 13
droits appliqués, vestige du programme terminé. Le mécanisme les retire à sa
prochaine connexion ; la migration ne les touche pas, pour ne pas mélanger deux
décisions (changer une identité et retirer un droit).

Les 563 participants ont tous une relation de programme (aucun n'est « sans
relation »). Le problème n'est donc pas la relation : c'est la **fonction**.

### Pourquoi la fonction manque

Le garde-fou profil ↔ rôle n'autorise chaque fonction que pour les identités de
base :

| Fonction | Identités autorisées |
|---|---|
| participant | membre |
| facilitateur | personnel, membre |
| fondateur | membre |
| investisseur | membre |

Un compte encore étiqueté `participant`, `facilitator` ou `founder` n'est donc pas
compatible avec la fonction qu'il devrait porter : le mécanisme refuse de la
créer. C'est volontaire, et c'est exactement ce que ce lot corrige.

### Ce que ces personnes ont aujourd'hui

| Ancien nom | Profil par défaut du rôle | Droits appliqués par contexte |
|---|---|---|
| `participant` | participant | aucun (0 personne) |
| `founder` | fondateur | **5 personnes**, 10 droits |
| `facilitator` | **aucun** | **1 personne**, 13 droits |

Deux constats qui comptent :

- **5 personnes ont des droits de fondateur** alors qu'une seule porte le nom :
  le mécanisme par relation fonctionne déjà pour les quatre autres ;
- **4 des 5 facilitateurs n'ont ni profil ni droits appliqués**. La migration les
  **répare** au lieu de simplement les maintenir. C'est un gain, pas une perte.

## 2. La migration

Fichier : `src/models/authorization/legacyIdentityStore.js` (SQL + transaction)
Service : `src/services/authorization/legacyIdentityMigration.js`
Branchement : `src/services/authorization/contextBootstrap.js`

### Elle s'exécute toute seule, une fois par base

Le mécanisme `runAuthzMigration(name, fn)` exécute la correction **une seule
fois par base**, au premier démarrage (ou à la première lecture d'autorisation
après déploiement), et inscrit le nom `legacy-identities-normalization-v1` dans
`authz_migrations`. Les démarrages suivants la sautent.

Si elle échoue, **rien n'est inscrit** : la transaction est annulée et elle sera
retentée au démarrage suivant. C'est le comportement voulu — une base à moitié
migrée est pire qu'une base non migrée.

Le contrôle est **dans la transaction** : une ancienne étiquette qui subsiste,
ou une relation active sans carte, lève une erreur et annule tout.

### L'ordre, et pourquoi il est imposé

1. créer la carte de fonction pour chaque relation réelle ;
2. **puis** ramener l'identité à `member`.

L'ordre inverse laisserait un intervalle pendant lequel la personne n'a plus son
profil par défaut et pas encore sa fonction. Les deux écritures sont dans **une
seule transaction** : soit tout passe, soit rien.

La carte est écrite par la migration elle-même, sans passer par le garde-fou
profil ↔ rôle — c'est le seul endroit où c'est nécessaire, puisque le garde-fou
refuse précisément la combinaison que l'on est en train de supprimer. L'ordre et
les contrôles garantissent le résultat.

### Les relations utilisées

| Famille | Relation | Fin de la carte |
|---|---|---|
| participant | une ligne d'inscription au programme | aucune |
| facilitateur | une affectation de programme (tolérante à l'email) | date de fin du programme |
| fondateur | une appartenance de venture de type fondateur, non retirée | aucune |

Ce sont **les mêmes sources** que le mécanisme automatique, pour qu'un prochain
passage ne défasse pas ce que la migration a écrit.

### Les contrôles avant validation

La transaction est annulée si l'un de ces contrôles échoue :

| Contrôle | Attendu |
|---|---|
| aucun ancien nom ne subsiste | 0 |
| **une relation active sans carte** | **0** |
| personnes migrées sans carte (aucune relation) | signalé, non bloquant |
| sessions encore ouvertes sous un ancien nom | **signalé**, non modifié |

La règle est donc : **relation active → carte obligatoire ; aucune relation →
membre sans carte**. Le second cas n'existe aujourd'hui que pour les 5
facilitateurs dont le programme est terminé.

## 3. Comment la suivre

### Avant le déploiement — simulation en lecture seule

Colle `scripts/db-audit/legacy-identity-simulation.sql` dans l'éditeur SQL de
Supabase. Un seul tableau, aucun écrit. Attendu :

| Famille | Personnes | Relations actives | Cartes à créer | Actives sans carte |
|---|---:|---:|---:|---:|
| participant | 563 | 563 | 563 | **0** |
| facilitateur | 5 | 0 | 0 | **0** |
| fondateur | 1 | 1 | 1 | **0** |

**Tables optionnelles.** La migration sonde chaque famille et ignore celle dont
la table est absente. C'est le cas mesuré en production pour `investor_profiles`
: le script principal ne la référence donc pas — une requête SQL ne peut pas
nommer une table qui n'existe pas, même derrière un `IF`. Il affiche à la place
la ligne « investisseur · table investor_profiles présente » (0 ou 1).

- si elle vaut **0** : rien à faire, la famille investisseur est ignorée et ses
  éventuels libellés deviennent `member` sans carte (mesuré : 0 personne) ;
- si elle vaut **1** : colle aussi
  `scripts/db-audit/legacy-identity-simulation-investor.sql`.

Un module absent ne bloque donc jamais la correction des trois familles
principales.

### Après le déploiement — vérification

Colle `scripts/db-audit/legacy-identity-verification.sql`. Attendu : migration
enregistrée = 1, anciens rôles = 0, cartes ≈ 564, sessions = 3 (signalées).

### Où voir le résultat de l'exécution automatique

Le service journalise une ligne quand il a réellement changé quelque chose :

```
[authz] legacy identities normalized { updated: 569, cards: 564, withoutRelationship: 5 }
```

Si une famille a été ignorée faute de table et que des personnes portaient son
libellé, une seconde ligne le dit explicitement (jamais en silence) :

```
[authz] legacy identities: famille(s) ignorée(s), table absente — leur libellé devient membre sans carte [ 'investor' ]
```

### Pourquoi une migration n'a pas tourné

Un échec annule sa transaction et n'écrit pas son marqueur — c'est voulu. La
raison est désormais **enregistrée en base**, pas seulement dans le journal du
serveur :

```sql
SELECT * FROM authz_migration_failures;
```

ou, avec les marqueurs utiles : `scripts/db-audit/authz-migration-status.sql`.
Une ligne décrit le dernier échec de chaque migration (elle est effacée au
prochain succès).

Absence de ligne = rien à faire (déjà migré, ou aucune étiquette legacy).

### Le lancement manuel n'existe plus

Le script SQL et le lanceur manuels ont été **supprimés à dessein** : ils
dupliquaient la règle et pouvaient diverger. Une seule implémentation, testée
(`legacy-identity-migration.test.js`), s'exécute automatiquement.

Si le contrôle « relation sans carte » échoue, la migration ne s'inscrit pas et
est retentée au démarrage suivant. Ce sont les participants rattachés à un
programme **sans ligne d'inscription** : ils demandent une décision explicite
(créer l'inscription, ou reconnaître le lien direct comme relation).

Les 5 facilitateurs, eux, ne bloquent pas : leur programme est terminé, donc ils
n'ont pas de relation active et deviennent membres sans carte.

## 4. Après la migration

Le même déploiement porte la **bascule du vocabulaire** : les quatre noms ne sont
plus produits à la connexion, le rôle par défaut est `member`, et les listes
d'autorisation des routes nomment `member` au lieu des anciennes étiquettes.

Ce qui reste à faire, une fois le déploiement en place :

1. **Purger les 3 sessions ouvertes** (2 fondateur, 1 facilitateur) pour qu'elles
   se reconnectent avec la nouvelle identité.
2. Vérifier le résultat avec `scripts/db-audit/legacy-identity-verification.sql`.
3. Contrôler les deux conséquences visibles, assumées et documentées :
   - une inscription personnelle reste **en attente** (un membre est `pending`,
     comme l'était un participant) ;
   - un membre dont le profil est incomplet atterrit sur **son profil**, comme
     l'ancien participant.

## 5. Retour arrière

- Si la migration échoue : rien n'est écrit, elle retente au démarrage suivant.
- Après validation : la migration est idempotente et additive ; revenir en
  arrière consiste à remettre les rôles d'origine **et** à fermer les cartes
  créées (`source = 'automatic'`, `notes = 'legacy-identity-migration'`), dans une
  transaction. Aucune relation n'est supprimée par ce lot.
