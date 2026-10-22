# Lot 4 — étape 4.2, lot 3/7 : annuaire, calendrier et programme

> Date : 2026-10-20. Dix-neuf routes quittent la liste de travail : treize
> passent à une capacité explicite, cinq déclarent une **décision déléguée**
> (le service porte la règle), une déclare une portée **personnelle**.

---

## 1. Les actions migrées

| Action | Avant | Après |
|---|---|---|
| `GET /api/activity` | `staff`, `super_admin` | `programs.view` |
| `POST /api/activity` | `staff`, `super_admin` | `programs.edit` |
| `GET /api/categories` | session seule | `projects.view` |
| `GET /api/dashboard?summary=true` | `super_admin` | `programs.view` |
| `GET /api/dashboard` | session seule | **déléguée** à `buildDashboardOverview` |
| `GET /api/data` | `super_admin` | `settings.view` |
| `POST /api/data` | `super_admin` | `settings.edit` |
| `POST /api/deliverables` | `staff`, `super_admin` | `programs.edit` |
| `GET /api/documents` | `staff`, `super_admin` | `programs.view` |
| `POST /api/documents` | `staff`, `super_admin` | `programs.edit` |
| `GET /api/evaluation` | `staff`, `super_admin`, `program_manager` | `programs.view` |
| `PUT /api/evaluation` | idem | `programs.edit` |
| `POST /api/evaluation` | `staff`, `super_admin` | `programs.edit` |
| `GET /api/events` | `staff`, `super_admin` | `programs.view` |
| `POST /api/events` | `staff`, `super_admin`, `program_manager` | `programs.edit` |
| `GET /api/feedback` | liste de rôles en ligne | `programs.view` |
| `POST /api/feedback` | liste de rôles en ligne | `can(programs.edit)` → sinon `session.cid` |
| `GET /api/intelligence/metrics` | `super_admin` | `knowledge.view` |
| `GET /api/progress` | `staff`, `super_admin` | `programs.view` |
| `GET /api/program-types` | session seule | `programs.view` |
| `POST /api/program-types` | `super_admin` | `settings.edit` |
| `GET/POST/PUT/DELETE /api/program-staff` | `super_admin` | `permissions.assign_groups` |
| `GET/POST/PATCH /api/followups` | listes de rôles | **déléguée** à `followups.js` |
| `GET/POST/PATCH /api/notifications` | session seule | **déléguée** à `inboxNotifications.js` |
| `GET/POST /api/notifications/venture` | session seule | **déléguée** à `ventureNotifications.js` |
| `GET /api/calendar` | session seule | **déléguée** à `workspace/calendar.js` |
| `POST /api/upload` | liste de rôles en ligne | **déléguée** à `authorization/uploadAccess.js` |
| `GET /api/workspaces` | session seule | **personnelle** (`session.cid`) |

### Pourquoi « déléguée » et non « capacité »

Ces routes ne peuvent pas s'exprimer par une capacité : la réponse dépend de la
**relation avec la cible**, pas seulement de qui appelle.

- `calendar` : le périmètre est calculé requête par requête à partir des
  programmes gérés/affectés et des ventures dont la personne est membre.
- `followups` : créer exige la relation avec le participant (gestionnaire du
  programme, ou facilitateur dans son périmètre d'équipe) ; lire est borné par
  le créateur du suivi.
- `notifications` / `notifications/venture` : la cible est la boîte du
  destinataire, avec une exception d'administration.
- `upload` : « interne, compte équipe, personne d'une venture, ou participant
  inscrit » est une **qualification**, pas une capacité de la matrice.

Chacune est nommée dans `actionDeclarations.DELEGATED_DECISIONS` avec son
service et sa règle, donc auditable.

---

## 2. Effet sur les accès

### Aucun accès retiré à une personne réelle

Le profil **Staff Default** porte `programs.view`, `programs.edit`,
`projects.view`, `ventures.view`, `reports.view`, `contacts.view` et
`messaging.*` ; le profil **Program Manager** porte tout `programs.*` et le bloc
`facilitator.*`. Le propriétaire de la plateforme contourne la décision.

Une lecture seule de la production confirme qu'aucun contact ne porte encore un
libellé contextuel (`team`, `participant`, `facilitator`, `program_manager`) :
tous sont alignés sur les trois identités. Les entrées de rôle de ces routes
étaient donc déjà partiellement mortes.

### Gains assumés (D-4)

Le profil gestionnaire gagne, comme prévu par D-4 (« le gestionnaire gère son
programme ») :

- créer un livrable (`deliverables` POST) ;
- lire et écrire les exigences documentaires d'un programme (`documents`) ;
- lire les événements (`events` GET), la progression, l'activité ;
- lire les catégories de travail ? **Non** : son profil ne porte pas
  `projects.view`, l'accès reste donc inchangé.

### Pertes assumées, sans consommateur

- `GET /api/program-types` et `GET /api/categories` demandent désormais une
  capacité de section : un participant ou un compte équipe ne les lit plus.
  Aucun écran ne les appelle hors de l'administration et du formulaire de tâche.

### Divergences signalées (décision produit à confirmer)

1. **`GET /api/followups`** : la règle du modèle rend les suivis historiques
   (`created_by IS NULL`) visibles à tout compte non-participant, y compris un
   simple membre. Avant, la liste de rôles l'arrêtait. La règle du service est
   conservée telle quelle ; si ce n'est pas voulu, c'est une correction du
   modèle, pas de la route.
2. **`POST /api/followups`** : un facilitateur dont la session porte l'identité
   de base `member` était refusé par la liste de rôles (`facilitator` n'est plus
   produit qu'en valeur contextuelle legacy). Il passe maintenant par la
   décision prévue (`evaluateFollowupParticipantAccess`), donc **dans son seul
   périmètre d'équipe**.

---

## 3. Cas laissé en dette, à dessein

`GET /api/deliverables` **reste sur sa liste de rôles** : le compte **équipe**
est une identité d'entité (role `team`) sans profil, donc aucune capacité ne
peut l'exprimer, et l'espace de travail d'équipe lit cette liste. Le `POST` de
la même route est migré ; la lecture attend une capacité « lecteur de
programme » qui couvre aussi les comptes d'entité.

Ces routes sont contrôlées par capacité mais **pas encore couplées à un
périmètre** : `documents`, `deliverables`, `evaluation`, `progress`. Coupler
`programs.edit` à `requireProgramScope` refuserait un staff qui ne gère aucun
programme (il n'a pas de profil gestionnaire) — c'est un changement de règle,
pas une déclaration, et il appartient au lot périmètre.

---

## 4. Compteurs

| Indicateur | Avant le lot 3 | Après le lot 3 |
|---|---:|---:|
| Actions en dette | 141 | **122** |
| Actions sans capacité (liste de travail) | 176 | **163** |
| dont à protéger | 120 | **106** |
| Listes de rôles en dur dans les actions | 154 | **134** |
| Comparaisons de rôle hors moteur (lignes) | 439 | **416** |
| Exceptions figées du garde-fou rôles | 264 | **251** |
| Exceptions figées du garde-fou étendu | 50 | **49** |
| Nouvelles occurrences non listées | 0 | **0** |
| Exceptions périmées | 0 | **0** |

---

## 5. Tests

- `action-declarations` : six déclarations déléguées + une personnelle
  acceptées, aucune action déclarée sous deux formes.
- `permissions-static-guards` : treize exceptions devenues périmées retirées
  par le cliquet.
- `permissions-role-gates-extended` : l'exception `const ROLE` de
  `program-staff` retirée.
- Suites ciblées : `dashboard-api`, `followups-scope`,
  `deliverable-upload-access`, `notifications-service`,
  `notification-hardening`, `program-scope-coverage`, `security-lot3-admin-authz`,
  `security-lot6-hardening`, `authz-endpoint-hardening`, `workspace-calendar`,
  `workspace-navigation`, `phase6-self-scope-calendar`, `program-progress`,
  `platform-evaluation-api`, `authz-scope-enforcement`,
  `deliverable-update-sql` → 16 suites / 186 tests verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base, aucune migration.

---

## 7. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 3/7
Fait :
  - 13 routes passent d'une liste de rôles à une capacité explicite
  - 5 actions déclarent une décision déléguée (calendar, followups,
    notifications, notifications/venture, upload)
  - 1 action déclare une portée personnelle (workspaces)
  - la qualification d'upload quitte la route pour un service
  - 13 exceptions du garde-fou rôles + 1 exception étendue retirées
Compteurs :
  - dette : 141 -> 122
  - liste de travail : 176 -> 163 (à protéger 120 -> 106)
  - listes de rôles : 154 -> 134
  - comparaisons de rôle : 439 -> 416
  - exceptions figées : 264 -> 251 (étendues 50 -> 49)
  - accès retirés pour une personne réelle : 0
Divergences en mode ombre : sans objet (aucune règle remplacée, seule la
  porte change) ; 2 divergences de comportement signalées pour décision.
Tests ajoutés / passants : 16 suites ciblées (186 tests) + 54 tests authz.
Décisions requises : visibilité des suivis historiques (created_by NULL) ;
  capacité « lecteur de programme » pour les comptes d'entité.
Retour arrière : git revert.
Prochaine étape : lot 4/7 — contacts et CRM (annuaire), puis les surfaces
  venture restantes.
```
