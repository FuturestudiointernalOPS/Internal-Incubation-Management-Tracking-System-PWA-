# Phase 7 — D7 : retrait des six droits d'animation non consultés

> **Nature** : changement de **vocabulaire produit**, pas un correctif de
> sécurité. Aucun contrôle n'est retiré (les six droits n'étaient lus par
> **aucune** décision). Sens du changement = **rétrécissement**, jamais
> d'élargissement. Aucune donnée, aucune migration.

## 1. Origine — décision arbitrée

Arbitrage **D7** (voir `phase-1-decisions.md`, section « D7 — Droits d'animation
non consultés », statut final L417-425) :

- **Décidé** : retirer les **six droits d'animation accordés mais non consultés** —
  `participants.manage`, `assignments.review`, `sessions.record`, `progress.view`,
  `groups.view`, `groups.manage` ;
- **Conservé** : `reviews.submit` (réellement **consulté** par
  `api/facilitator-reviews`, POST) ;
- **Reporté (non traité ici)** : la portée « tout droit contenant `manage` » **au-delà
  de l'animation** (engineering, org_membership, crm). Les droits vivants
  (`engineering.manage_errors`, `org_membership.manage`, `crm.manage`) ne sont
  **pas** concernés.

**Pourquoi retirer plutôt que câbler ?** Ces six droits étaient accordés « sur le
papier » : leur **niveau n'était jamais consulté** par la décision (constat de
`docs/AUTHZ_CURRENT_STATE.md` §7, verrouillé par le test de contrat
`facilitator-capability-coverage.test.js`). Un droit qu'aucune route n'applique est
un droit **faux** ; la spec (§6.2) interdit qu'un `MANAGE` latent ouvre d'autres
actions. Les câbler exigerait de desserrer/ajouter des routes (décision produit) et
un backfill de niveaux — hors périmètre de ce lot.

## 2. Ce qui a changé (code, sans données)

Trois déclarations d'**un même vocabulaire**, normalement tenues en synchronie
exacte par le test de contrat :

| Fichier | Élément |
|---|---|
| `src/lib/facilitator-permissions.js` | `FACILITATOR_CAPABILITY_KEYS` |
| `src/server/authz/capabilities.js` | `PERMISSION_MODULES.facilitator.capabilities` |
| `src/models/authorization/capability-catalog.js` | `CAPABILITY_CATALOG.facilitator.capabilities` |

Deux listes d'**interface** (les cases à cocher d'un programme) :

| Fichier | Élément |
|---|---|
| `src/components/admin/programs/edit-modal/constants.js` | `FACILITATOR_CAPS` |
| `src/components/pm/facilitators-panel/capabilities.js` | `FACILITATOR_CAPS` (+ `FULL_FACILITATOR_PERMISSIONS` dérivé) |

**Effets automatiques (aucun code dédié) :**

- `buildFullFacilitatorPermissions()` dérive de `FACILITATOR_CAPABILITY_KEYS` :
  une affectation créée après ce lot ne reçoit plus les six droits.
- `deriveFacilitatorDesiredCaps()` dérive de la même liste : une ligne de
  tick-list **historique** qui porte encore une clé retirée n'est **plus
  « désirée »** ; le planificateur du réconciliateur la **révoque**
  (`planContextGrantChanges.toRevoke`). C'est le « nettoyage des droits déjà
  écrits » de D7, obtenu sans migration : il s'exécute au prochain passage du
  réconciliateur (connexion / balayage).

**Les clés de langue (`adminMisc`, `pmMisc`) sont laissées en place** (clés
inutilisées, sans effet) pour garder le lot minimal ; leur retrait est cosmétique.

## 3. Preuves de validation (réellement exécutées)

- Suites ciblées (**9** suites / **85** tests) : vertes —
  `facilitator-capability-coverage`, `route-catalog-contract`,
  `program-assignment-grants`, `program-assignment-grants.planning`,
  `authorization-resolver.core`, `phase7-d7-animation-rights` (**nouveau**),
  `permissions-catalog-sync`, `permissions-static-guards`,
  `permissions-role-gates-extended`.
- Balayage élargi vocabulaire/permissions (**38** suites / **443** tests) : vert.
- `eslint` sur les fichiers touchés : **0 erreur** (1 avertissement `no-unused-vars`
  **préexistant** dans `authorization-resolver.core.test.js`, hors de mes lignes).
- Suite complète : voir le compte rendu de phase (un échec **étranger** au lot a
  été constaté — `phase9-why-engine-reason.test.js` — documenté séparément).

## 4. Test de non-régression ajouté

`src/__tests__/phase7-d7-animation-rights.test.js` verrouille :

1. l'absence des six clés dans les trois déclarations et leur absence de tout
   usage par une route (`capability: "…"`) ;
2. le fait que le vocabulaire restant est **exactement** les sept droits consultés ;
3. l'**auto-nettoyage** : une tick-list historique portant une clé retirée ne la
   rend plus « désirée », et le planificateur la révoque.

## 5. Retour arrière

Retirer ce lot = réintroduire les six clés dans les trois déclarations et les deux
listes d'interface, et inverser les deux tests adaptés. **Aucune donnée, aucune
migration** : les octrois déjà retirés par le réconciliateur le resteraient
(comportement identique puisque ces droits n'étaient pas consultés). Le test
`phase7-d7-animation-rights.test.js` redevient rouge si un garde-fou est retiré —
signal attendu.

## 6. Points résiduels / ouverts

| Point | Nature | Destination |
|---|---|---|
| Nettoyage des octrois **manuels** (non écrits par le réconciliateur) portant une clé retirée | Données (opérationnel) | Un balayage dédié, hors agent ; ces lignes sont **inertes** en attendant |
| Portée « tout droit contenant `manage` » hors animation (engineering, org_membership, crm) | Décision produit | Reportée (voir D7 §statut final) |
| Clés i18n `capParticipantsManage`, `capAssignmentsReview`, `capSessionsRecord`, `capProgressView`, `capGroupsView`, `capGroupsManage` (adminMisc + pmMisc, EN/FR) | Cosmétique | À retirer lors d'un lot de vocabulaire |
