# Lot 4 — étape 4.7 : campagnes retirées, décisions nommées, deux refus assumés

> Date : 2026-10-20. Dix actions sortent de la liste de travail : deux
> chemins morts deviennent des routes retirées, trois déclarations nomment un
> service, une route est déclarée « soi-même », quatre actions du propriétaire
> passent à la capacité. **Une conversion a été annulée** parce qu'elle
> élargissait un accès.

---

## 1. Les deux chemins morts

`/api/campaigns` et `/api/campaigns/[id]` répondaient déjà `403` à tout le
monde (la fonctionnalité est retirée), mais par une réponse locale et derrière
une liste de rôles. Elles utilisent maintenant le refus partagé
(`retiredRouteResponse`) et sont déclarées dans `RETIRED_ROUTES` :

- même forme de refus que les quatre autres routes retirées ;
- **un journal par appel** (`[retired-route] … was called`), qui est la seule
  preuve permettant de les supprimer plus tard ;
- plus aucune liste de rôles : un chemin retiré refuse toute identité
  connectée de la même façon.

## 2. Les déclarations `delegated`

| Route | Service | Règle nommée |
|---|---|---|
| `v2/program-staff` | `services/programs/programStaff.js` | les quatre opérations reçoivent la session et décident |
| `venture-plan-templates/apply` | `services/ventures/operatingPlans.js` | `resolvePlanAccess / allowsPlanAction` |
| `venture-plan-templates` | `services/ventures/operatingPlans.js` | gestion de la venture du plan (POST) |

Une route est déclarée **« soi-même »** : `platform/notifications` lit et écrit
`session.cid`.

`integrations/google-calendar/connect` **reste** dans la liste de travail. La
déclaration « soi-même » exige que la route résolve sa cible depuis
`session.cid` ; le démarrage OAuth ne lit aucune donnée propre, il pose un
cookie `state` propre au navigateur. Le déclarer « soi-même » aurait menti sur
la forme. Il sera traité avec les routes « toute identité connectée ».

## 3. Les capacités (comportement inchangé)

| Route | Capacité |
|---|---|
| `POST / PUT /api/investor/campaigns` | `investor.create` / `investor.edit` |
| `POST /api/investor/approval` | `investor.edit` |
| `GET /api/venture-permissions/matrix` et `/responsibilities` | `permissions.view_matrix` |
| `POST / PATCH` des deux mêmes | `permissions.assign_responsibilities` |

Ces méthodes n'admettaient déjà que le propriétaire de la plateforme, qui est
exempté. `GET /api/investor/approval` garde sa liste (personnel + propriétaire) :
`investor.view` n'est pas dans le profil par défaut du personnel, la convertir
retirerait un accès.

## 4. La conversion annulée — et pourquoi

`/api/journey-reports` a d'abord été converti en `reports.view`. Le test de
caractérisation a immédiatement montré le problème :

- le profil par défaut du **personnel** contient `reports.view` ;
- la route était réservée au propriétaire de la plateforme ;
- la conversion **ouvrait donc le portefeuille inter-ventures au personnel**.

C'est exactement le genre d'écart que le plan interdit de franchir sans
décision. La route est revenue à sa liste de rôles, qui reste de la dette
mesurée. Deux issues possibles, à trancher :

1. une capacité dédiée qui n'est dans aucun profil par défaut (`reports.export`
   n'est pas dans `staff_default`) ;
2. assumer l'ouverture au personnel, auquel cas c'est un changement produit.

## 5. Compteurs

| Indicateur | Avant 4.7 | Après 4.7 |
|---|---:|---:|
| Actions « à protéger » | 21 | **11** |
| Liste de travail totale | 56 | **47** |
| Actions non déclarées (dette) | 21 | **11** |
| Compteur d'audit strict | 82 | **77** |
| Fichiers avec le contrôle central | 224 | **228** |
| Listes de rôles en dur dans les actions | 55 | **47** |
| Comparaisons de rôle hors moteur | 250 | **242** |
| Exceptions figées du garde-fou rôles | 157 | **154** |

## 6. Tests

- `npm run test:authz` → **12 suites / 79 tests** verts.
- Balayage ciblé (campagnes, notifications, portefeuille, permissions venture,
  investisseurs) → 22 suites vertes ; la seule en échec est
  `journey-report-deliverables`, préexistante.
- `action-declarations` → 12 tests verts (registre et cliquet de dette).
- `npm run lint` → 0 erreur.

## 7. Retour arrière

`git revert`. Aucune écriture en base. Le retour de `journey-reports` est déjà
dans ce lot.

## 8. Compte rendu

```
LOT 4 — Registre déclaratif — étape 4.7
Fait : campagnes déclarées retirées ; 3 décisions déléguées ; 2 routes
  « soi-même » ; 4 méthodes passées à la capacité ; 1 conversion annulée.
Compteurs : à protéger 21 -> 11 ; liste de travail 56 -> 47 ;
  dette 21 -> 11 ; listes de rôles 55 -> 47 ; comparaisons 250 -> 242 ;
  exceptions 157 -> 154.
Divergences : aucune en production ; une conversion aurait élargi
  `journey-reports` au personnel, elle est annulée.
Tests : 12 suites / 79 tests authz verts ; 22 suites du balayage vertes.
Décisions requises : le devenir de `journey-reports` (capacité dédiée ou
  ouverture au personnel assumée).
Retour arrière : git revert.
Prochaine étape : les 11 actions restantes, toutes bloquées par la même
  question — leur capacité n'est dans aucun profil par défaut du personnel.
```
