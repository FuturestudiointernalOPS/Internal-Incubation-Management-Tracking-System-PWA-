# Lot 4 — étape 4.5 : le tableau de bord lit le registre des déclarations

> Date : 2026-10-20. Correction d'une incohérence mesurée : 27 actions déjà
> déclarées « décision déléguée » étaient encore comptées comme « à protéger ».

---

## 1. Le défaut

Le registre `actionDeclarations.js` connaît quatre formes :

| Forme | Sens |
|---|---|
| `capability` | la route appelle elle-même la décision |
| `delegated` | la décision vit dans un **service nommé** (service + règle) |
| `self` | ouverte à toute personne connectée, portée = soi-même |
| `open` | publique, secrète, hub ou brouillon assumé |

Le calcul du tableau de bord ne lisait que deux des quatre listes : les routes
« soi-même » et les routes « ouvertes assumées ». Les routes **déléguées**
tombaient donc dans la catégorie « à protéger » — c'est-à-dire qu'on demandait
de protéger des décisions déjà prises, ailleurs.

La conséquence n'était pas cosmétique : 27 des 73 actions dites « à protéger »
n'en étaient pas. Le chiffre de dette était faux, donc le plan qui s'appuie
dessus l'était aussi.

## 2. Ce qui a changé

Le calcul exclut maintenant une route déclarée `delegated`, exactement comme il
exclut déjà une route retirée ou déclarée « soi-même ». La règle est celle du
registre : **une déclaration nommée quitte la dette**.

Une route déléguée reste comptée par le compteur d'audit strict (« appelle la
garde de session, pas la capacité centrale ») : c'est vrai, et il doit rester
vrai. Ce que l'on corrige, c'est de l'appeler un trou.

## 3. Les 27 actions reclassées

Décisions qui vivent dans un service nommé, désormais hors de la liste de
travail (liste non exhaustive, la source est le registre) :

- blocages et discussions ;
- objectifs (intents) et leurs tâches ;
- notifications, y compris par venture ;
- tâches : liste, assignations, reports, commentaires, journaux, ressources,
  duplication, réconciliation, action d'assignation ;
- projets : assignations, invitations, réponse à une invitation ;
- rituels : standups et rétros courants ;
- état complet du participant et ses soumissions ;
- téléversement (la qualification vit dans le service d'accès) ;
- calendrier, suivis, courriels alternatifs.

## 4. Compteurs

| Indicateur | Avant 4.5 | Après 4.5 |
|---|---:|---:|
| Actions « à protéger » | 73 | **44** |
| Actions « à vérifier — décision déléguée » | 3 | **0** |
| Liste de travail totale | 111 | **79** |
| Compteur d'audit strict | 84 | **82** |
| Fichiers avec le contrôle central | 222 | **224** |
| Listes de rôles en dur dans les actions | 57 | **55** |
| Comparaisons de rôle hors moteur | 252 | **250** |
| Exceptions figées du garde-fou rôles | 159 | **157** |

Le compteur d'audit strict ne baisse pas de 27 : une route déléguée continue de
n'appeler que la garde de session dans son propre fichier. C'est la définition du
compteur, pas une dette. Les 27 sortent de la liste de travail, pas de l'audit.

## 5. Tests

- `npm run test:authz` → **12 suites / 79 tests** verts, cliquet respecté.
- Le garde-fou signale ses deux dernières exceptions périmées (les deux routes
  du propriétaire converties) ; elles sont retirées.
- `npm run lint` → 0 erreur.

## 6. Retour arrière

`git revert`. Aucune écriture en base, aucune règle modifiée : seule la
classification change.

## 7. Compte rendu

```
LOT 4 — Registre déclaratif — étape 4.5
Fait :
  - deux dernières routes du propriétaire converties en capacité
  - le tableau de bord lit DELEGATED_DECISIONS (27 routes reclassées)
Compteurs : à protéger 73 -> 44 ; liste de travail 111 -> 79 ;
  déléguées 3 -> 0 ; listes de rôles 57 -> 55 ; comparaisons 252 -> 250 ;
  exceptions 159 -> 157.
Divergences : aucune règle modifiée ; le compteur d'audit strict reste à 82.
Tests : 12 suites / 79 tests authz verts.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : les 44 actions restantes « à protéger » (écritures et
  données personnelles d'abord), puis les 21 exceptions étendues.
```
