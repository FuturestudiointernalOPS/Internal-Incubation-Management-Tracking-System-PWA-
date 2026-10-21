# Lot 4 — étape 4.8 : des capacités dédiées, sans retirer d'accès

> Date : 2026-10-20. Décision produit du groupe A : **garder les accès tels
> quels**, mais donner à chaque famille sa capacité, attribuée aux profils qui
> la détenaient déjà par une liste de rôles.

---

## 1. Le principe

Une liste de rôles disait « le personnel peut ». Une capacité dit « ce profil
peut ». Pour ne rien retirer, la capacité est **accordée au profil** qui
correspond au rôle admis :

- `staff_default` reçoit les capacités que le personnel exerçait ;
- `program_manager` reçoit celles que le gestionnaire exerçait ;
- le propriétaire de la plateforme reste exempté et n'a besoin d'aucune ligne.

Sur une base existante, le catalogue n'est semé qu'une fois : ajouter une
capacité au code ne suffit pas. Une migration `profile-capability-defaults-v1`
écrit donc les mêmes lignes, **en insertion seule** (un niveau choisi par un
administrateur n'est jamais écrasé).

## 2. Le mapping

| Action | Avant | Capacité | Profils qui gardent l'accès |
|---|---|---|---|
| Collections (lecture) | propriétaire + personnel | `collections.view` | personnel |
| Collections (écriture) | propriétaire seulement | `collections.manage` | personne (le propriétaire passe) |
| Taxonomies venture (options) | propriétaire + personnel | `ventures.setup` | personnel |
| Playbooks venture | propriétaire + personnel | `ventures.setup` | personnel |
| Catalogue KPI venture (écriture) | personnel + gestionnaire | `ventures.kpis` | personnel + gestionnaire |
| Types de périmètre venture (lecture) | propriétaire + personnel | `ventures.permissions_view` | personnel |
| Groupes de programme | propriétaire + personnel + gestionnaire | `programs.groups` | personnel + gestionnaire |

Deux remarques sur les modules :

- `collections` est un **nouveau module** sous la section « communication » :
  le droit de lire une collection n'est pas celui de modifier un formulaire.
- `ventures.setup`, `ventures.kpis` et `ventures.permissions_view` sont de
  nouvelles capacités du module `ventures`. Le commentaire du fichier des
  options annonçait déjà `ventures.setup`.

## 3. La conséquence assumée

Le droit vient du **profil**, plus du libellé de rôle. Un membre du personnel
dont le profil a été remplacé par un profil plus étroit (opérations, chef de
projet…) ne reçoit pas ces capacités automatiquement : il faut les lui accorder.
C'est le principe « le profil est la seule source des droits de base », pas une
régression. La requête de vérification signale ces personnes (`contacts.profile_key`
non vide et différent de `staff_default`).

Le gestionnaire de programme reçoit `ventures.kpis` uniquement : c'est un droit
de **configuration du catalogue** (règle métier 49), jamais l'accès aux données
d'une venture. Le profil reste « programme seulement » pour tout le reste.

## 4. Production

1. **Avant de déployer** — rien à lancer en écriture.
2. **Déployer.** Le premier démarrage applique `profile-capability-defaults-v1`
   et l'inscrit dans `authz_migrations`.
3. **Après** — coller `scripts/db-audit/capability-defaults-verification.sql` :
   les 7 lignes doivent valoir `1` ; la dernière ligne signale, sans corriger,
   le personnel porteur d'un profil explicite.

## 5. Compteurs

| Indicateur | Avant 4.8 | Après 4.8 |
|---|---:|---:|
| Actions « à protéger » | 11 | **5** |
| Liste de travail totale | 47 | **41** |
| Actions non déclarées (dette) | 11 | **5** |
| Compteur d'audit strict | 77 | **71** |
| Fichiers avec le contrôle central | 228 | **234** |
| Listes de rôles en dur dans les actions | 47 | **40** |
| Comparaisons de rôle hors moteur | 242 | **232** |
| Exceptions figées du garde-fou rôles | 154 | **150** |

## 6. Tests

- `profile-catalogue-seed` → 5 tests, dont le backfill des 7 lignes et
  l'exception `ventures.kpis` du profil gestionnaire.
- `capability-source-consistency`, `permissions-catalog-sync`,
  `authorization-model`, `permissions-static-guards` → verts.
- `responsibility-grants` → la section « communication » compte désormais le
  module `collections` (un droit de lecture de plus pour cette responsabilité).
- `npm run test:authz` → **12 suites / 79 tests** verts.
- Balayage large → **431 suites vertes**, les **17 échecs préexistants** seuls.
- `npm run lint` → 0 erreur.

## 7. Retour arrière

`git revert`. En base, supprimer les 7 lignes de `profile_capabilities` et le
marqueur `profile-capability-defaults-v1` si l'on veut rejouer la migration.

## 8. Compte rendu

```
LOT 4 — Registre déclaratif — étape 4.8
Fait : 7 capacités dédiées, accordées aux profils qui avaient l'accès ;
  nouveau module collections ; migration d'attribution en insertion seule.
Compteurs : à protéger 11 -> 5 ; liste de travail 47 -> 41 ;
  dette 11 -> 5 ; listes de rôles 47 -> 40 ; comparaisons 242 -> 232 ;
  exceptions 154 -> 150.
Divergences : aucune pour les profils par défaut ; un profil plus étroit
  doit recevoir la capacité explicitement (signalé, jamais corrigé).
Tests : 12 suites / 79 tests authz verts ; 431 suites vertes.
Décisions requises : les 5 actions restantes (groupe B).
Retour arrière : git revert + suppression des lignes et du marqueur.
Prochaine étape : groupe B — invitation de familles, portefeuille de
  rapports, listes « mes ventures », démarrage OAuth.
```
