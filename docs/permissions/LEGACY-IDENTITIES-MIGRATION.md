# Migration des identités legacy — mode d'emploi

> Date : 2026-10-20. Mesuré sur la base réellement utilisée par l'équipe.
> La migration est écrite, répétable et **simulée par défaut**.

---

## 1. La population mesurée

| Ancien nom | Personnes | Ont la fonction équivalente | Sessions ouvertes |
|---|---:|---:|---:|
| `participant` | 563 | **0** | 0 |
| `facilitator` | 5 | **0** | 1 |
| `founder` | 1 | **0** | 2 |
| `investor` | 0 | — | — |

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

Fichier : `migrations/legacy_identity_migration.sql`
Lanceur : `scripts/db-audit/apply-legacy-identity-migration.mjs`

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
| chaque personne ciblée a une carte active de sa fonction | 0 manquante |
| sessions encore ouvertes sous un ancien nom | **signalé**, non modifié |

## 3. Comment l'exécuter

```bash
# 1. Simulation : exécute tout, affiche le plan et les contrôles, puis ANNULE
node scripts/db-audit/apply-legacy-identity-migration.mjs .env.local

# 2. Écriture : valide seulement si tous les contrôles passent
node scripts/db-audit/apply-legacy-identity-migration.mjs --apply .env.local
```

La simulation emprunte **le même chemin** que l'écriture : seules les dernières
instructions changent (`ROLLBACK` au lieu de `COMMIT`). C'est la répétition
demandée par le plan, sans base de préparation séparée.

Si le contrôle « carte manquante » échoue, la transaction est annulée et le
nombre de personnes concernées est affiché. Ce sont les participants rattachés à
un programme **sans ligne d'inscription** : ils demandent une décision explicite
(créer l'inscription, ou reconnaître le lien direct comme relation).

## 4. Après la migration

1. **Purger les 3 sessions ouvertes** (2 fondateur, 1 facilitateur) pour qu'elles
   se reconnectent avec la nouvelle identité.
2. **Retirer les quatre noms de la connexion** et ramener le rôle par défaut à
   `member` — c'est le lot suivant, avec ses deux conséquences visibles :
   l'approbation à l'inscription et l'atterrissage quand le profil est incomplet.
3. Vérifier par la mesure que plus aucun code ne lit les anciens libellés
   (c'est déjà le cas hors du moteur).

## 5. Retour arrière

- Avant validation : rien n'est écrit (rollback).
- Après validation : la migration est idempotente et additive ; revenir en
  arrière consiste à remettre les rôles d'origine **et** à fermer les cartes
  créées (`source = 'automatic'`, `notes = 'legacy-identity-migration'`), dans une
  transaction. Aucune suppression de relation n'est faite par ce lot.
