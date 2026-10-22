# Lot 4 — étape 4.2, lot 4/7 : annuaire et CRM

> Date : 2026-10-20. Vingt-cinq routes de l'annuaire et du CRM avaient **deux
> portes** : une liste de rôles devant, une capacité derrière. La seconde
> décidait déjà ; la première ne servait qu'à répéter le vocabulaire des rôles.

---

## 1. Ce qui a changé

| Surface | Avant | Après |
|---|---|---|
| `/api/crm/*` (leads, opportunités, organisations, pipelines, segments, activités, automatisations) | `createHandler({ roles: [...] })` **puis** `requireAuthorization("crm", …)` | `requireAuthorization("crm", …)` seule |
| `/api/contacts/duplicates` | `requireAuth(["super_admin"])` **puis** `contacts.view` / `contacts.edit` | capacité seule, session exigée |
| `/api/contacts/merge` | `requireAuth(["super_admin"])` **puis** `contacts.delete` | capacité seule |
| `/api/contacts/merge/preview` | `requireAuth(["super_admin"])` **puis** `contacts.view` | capacité seule |

Quarante-cinq lignes `{ roles: [...] }` et quatre arguments `requireAuth([...])`
supprimés dans **25 fichiers**.

### Pourquoi c'était redondant, pas protecteur

`createHandler` exécute la liste de rôles **avant** le corps du handler, où la
capacité tranche ensuite. Une requête devait donc franchir les deux. La capacité
étant plus étroite dans tous les cas observés, la liste ne décidait jamais seule
— elle ne faisait que refuser plus tôt, avec le même code 403.

La supprimer ne change donc pas l'accès effectif ; elle rend la **capacité**
seule décisionnaire, ce qui est l'objectif du lot : le droit peut être accordé
sans toucher au code, et plus aucune action ne nomme un rôle.

---

## 2. Effet sur les accès

### Aucun accès retiré

| Camp | Capacités CRM | Effet |
|---|---|---|
| Propriétaire de la plateforme | contournement | inchangé |
| Staff | `contacts.view` seulement (aucun `crm.*`) | déjà refusé par la capacité sur `/api/crm/*`, inchangé |
| Profil gestionnaire | aucun `crm.*` | inchangé |

### Gain assumé (une seule famille)

`GET /api/contacts/duplicates` et `GET /api/contacts/merge/preview` demandaient
`super_admin` en plus de `contacts.view`. Le profil **Staff Default** porte
`contacts.view` : un staff peut désormais lire les doublons et l'aperçu de
fusion. C'est cohérent (il lit déjà l'annuaire) et c'est exactement ce que la
capacité prévoyait déjà ; la liste de rôles le bloquait.

La suppression des doublons et la fusion restent réservées : elles exigent
`contacts.edit` / `contacts.delete`, qu'aucun profil standard ne porte.

---

## 3. Cas laissés en dette, à dessein

`GET/POST /api/segments` et `POST /api/segments/run` sont **retirés** : le code
répond toujours `403 errors.featureRetired` (`const RETIRED = true`). Ils
gardent leur liste de rôles, mais aucune requête ne l'atteint. Ce sont des
chemins morts : ils appartiennent au lot 8 (suppression après preuve d'absence
de trafic), pas à celui-ci.

---

## 4. Compteurs

| Indicateur | Avant le lot 4 | Après le lot 4 |
|---|---:|---:|
| Actions en dette | 122 | **122** |
| Actions sans capacité (liste de travail) | 163 | **163** |
| Listes de rôles en dur dans les actions | 134 | **85** |
| Comparaisons de rôle hors moteur (lignes) | 416 | **367** |
| Exceptions figées du garde-fou rôles | 251 | **226** |
| Exceptions figées du garde-fou étendu | 49 | **49** |
| Nouvelles occurrences non listées | 0 | **0** |
| Exceptions périmées | 0 | **0** |

La liste de travail ne bouge pas : ces routes portaient déjà une capacité, elles
n'étaient donc pas comptées comme dettes. Ce lot supprime la **redondance**, pas
un trou de couverture.

---

## 5. Tests

- `crm-pipeline-events-api` : le faux `createHandler` ne connaissait que la
  forme `(options, handler)` ; il accepte désormais les deux formes, comme le
  vrai (`(handler)` ou `(options, handler)`).
- `permissions-characterization` : deux assertions qui figeaient la liste
  `super_admin` des suppressions CRM figent maintenant la capacité `crm.delete`
  et l'absence de liste.
- `permissions-static-guards` : vingt-cinq exceptions devenues périmées
  retirées par le cliquet.
- Suites ciblées : `contacts-role-audit`, `crm-lead-scoring`,
  `crm-pipeline-events-api`, `crm-workspace-management-ui`, `crm-workspace-ui`,
  `people-search`, `security-lot10-tasks-contacts`, `ui2-people`,
  `venture-people`, `route-catalog-contract`, `security-lot1-idor`,
  `security-lot3-admin-authz`, `permissions-characterization`,
  `authorization-model` → 14 suites / 153 tests verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base, aucune migration.

---

## 7. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 4/7
Fait :
  - 45 listes de rôles supprimées dans 25 routes CRM/annuaire
  - 4 requireAuth([...]) réduits à requireAuth()
  - la capacité devient la seule décision sur ces surfaces
  - un faux createHandler de test rendu fidèle (deux formes d'appel)
Compteurs :
  - listes de rôles : 134 -> 85
  - comparaisons de rôle : 416 -> 367
  - exceptions figées : 251 -> 226
  - dette et liste de travail : inchangées (122 / 163), ces routes
    portaient déjà une capacité
  - accès retirés pour une personne réelle : 0
Divergences : un gain assumé — un staff portant contacts.view lit désormais
  les doublons et l'aperçu de fusion (la capacité le prévoyait déjà).
Tests ajoutés / passants : 14 suites ciblées (153 tests) + 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : lot 5/7 — surfaces programme restantes (participants,
  soumissions, séances), puis les surfaces venture (Lot 5).
```
