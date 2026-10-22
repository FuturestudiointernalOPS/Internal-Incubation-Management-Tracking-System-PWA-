# Lot 4 — étape 4.6 : les décisions venture entrent au registre

> Date : 2026-10-20. Vingt-trois actions de venture dont la décision vivait
> déjà dans un service nommé sont déclarées `delegated`. Aucune règle n'est
> modifiée.

---

## 1. Ce que ces routes faisaient déjà

Chacune appelle un helper qui répond « qui peut, sur cette venture, pour cette
action ? » :

| Helper | Ce qu'il lit |
|---|---|
| `resolvePlanAccess` / `allowsPlanAction` | l'affectation active **et** la capacité venture |
| `canManageFounders` | l'autorité sur les fondateurs de cette venture |
| `canManageVentureDocumentTypes` | la gestion des types de document de cette venture |
| `canAccessVerification` / `canManageVerification` | membre actif, affectation active, ou propriétaire |
| `canReadStartupProfile` / `canEditStartupProfile` | qui porte la venture |
| `hasVentureCapability` | la capacité venture, pour les notes internes |
| `isStaffActorForVenture` | l'acteur du personnel de cette venture |

Le fichier de route n'a donc **pas** de capacité littérale : c'est normal, la
décision a besoin de la relation avec la cible. Le registre accepte cette forme
depuis l'étape 4.3 ; il manquait seulement les entrées.

## 2. Le point qui compte : `journey/delete`

La suppression définitive d'un parcours n'est **pas** une gestion ordinaire.
`allowsPlanAction(access, "delete")` répond oui au seul propriétaire de la
plateforme ; tout autre archive. La déclaration nomme cette règle, pour qu'un
relecteur ne la confonde pas avec un simple « edit ».

## 3. Le registre est régénéré, pas édité à la main

La liste de dette (`actionDebt.js`) est produite par
`node scripts/authz-action-debt.mjs --write`. Les 35 entrées devenues déclarées
en sortent d'elles-mêmes — aucune suppression devinée.

## 4. Compteurs

| Indicateur | Avant 4.6 | Après 4.6 |
|---|---:|---:|
| Actions « à protéger » | 44 | **21** |
| Liste de travail totale | 79 | **56** |
| Actions non déclarées (dette) | 56 | **21** |
| Compteur d'audit strict | 82 | **82** |
| Listes de rôles en dur dans les actions | 55 | **55** |
| Exceptions figées du garde-fou rôles | 157 | **157** |

Le compteur d'audit strict ne bouge pas : ces fichiers n'appellent toujours pas
la capacité centrale dans leur propre fichier. C'est leur définition, et la
route le dit maintenant au registre.

## 5. Tests

- `action-declarations` → **12 tests** verts, dont « aucune action n'est à la
  fois déclarée et en dette » et « chaque déclaration déléguée nomme son service
  et sa règle ».
- `npm run test:authz` → **12 suites / 79 tests** verts.
- `npm run lint` → 0 erreur.

## 6. Retour arrière

`git revert`. Aucune écriture en base, aucune règle modifiée.

## 7. Compte rendu

```
LOT 4 — Registre déclaratif — étape 4.6
Fait : 23 décisions venture déclarées déléguées (service + règle nommés).
Compteurs : à protéger 44 -> 21 ; liste de travail 79 -> 56 ;
  dette non déclarée 56 -> 21.
Divergences : aucune (déclarations seules).
Tests : 12 tests de registre verts ; 12 suites / 79 tests authz verts.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : les 21 actions restantes « à protéger », en commençant par
  les écritures (invitations, campagnes, groupes, rôles programme).
```
