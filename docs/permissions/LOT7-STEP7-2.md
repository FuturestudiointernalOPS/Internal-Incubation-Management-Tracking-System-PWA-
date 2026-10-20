# Lot 7 — étape 7.2 : les écrans lisent la décision du serveur

> Date : 2026-10-20. La coque applicative et les écrans de tableau de bord ne
> comparent plus de libellé de rôle : ils interrogent la couche d'identité et le
> profil que le serveur a résolu. Le serveur expose désormais ses profils
> contextuels, comme il exposait déjà sa matrice et ses raisons.

---

## 1. Le défaut que cette étape a révélé

D-1 a fait du gestionnaire de programme une identité `staff` portant le profil
`program_manager`. Les écrans continuaient à comparer `role === "program_manager"` :
ce libellé n'existe plus dans une session nouvelle. Quatre comportements étaient
donc devenus silencieusement faux :

| Comportement | Avant D-1 | Après D-1, sans correctif |
|---|---|---|
| sous-menu « programmes » de la barre latérale | lu pour un gestionnaire | jamais lu |
| badge des soumissions en attente | compté pour un gestionnaire | jamais compté |
| lien « profil » | `/pm/profile` | `/participant/profile` |
| onglet Configuration de l'espace programme | visible | masqué |

Aucun de ces points n'est une décision d'accès : ce sont des miroirs d'écran.
Le correctif n'invente pas de règle — il fait lire à l'écran **le profil que le
serveur a déjà résolu**.

## 2. La projection serveur (extension de 7.1)

`GET /api/me/permissions` renvoie maintenant aussi `profiles` :

```json
{
  "success": true,
  "role": "staff",
  "isSuperAdmin": false,
  "profiles": ["program_manager"],
  "effective": { "programs": { "view": 1, "edit": 3 } },
  "decisions": { "programs": { "view": { "allowed": true, "reason": "granted" } } }
}
```

`profiles` est `ctx.profiles`, la liste que le résolveur d'autorisation a
réellement utilisée. `PermissionProvider` la transporte à côté de la matrice et
la rend stable entre deux rendus.

Deux fonctions nommées complètent la couche d'identité :

- `holdsProfile(profiles, key)` — « cette personne porte-t-elle ce profil ? » ;
- `isMemberSurfaceRole(role)` — la famille personnelle (`participant`, `member`,
  `founder`), qui partage la coque et la copie du participant.

## 3. Surfaces migrées

| Fichier | Règle remplacée | Règle lue |
|---|---|---|
| `layout/DashboardLayout.js` | `role === "program_manager"` / `["staff","program_manager"]` | profil `program_manager`, `isPlatformOwnerRole`, `isInternalStaffRole` |
| `layout/shell/ShellHeader.js` | branches de destination des notifications | prédicats + `carriesContextualValue` |
| `layout/shell/SidebarContent.js` | table ternaire de section, listes personnelles | table de routage + `isMemberSurfaceRole` |
| `layout/shell/useDashboardBadges.js` | `role === "program_manager"` / `"super_admin"` | profil du gestionnaire, `isPlatformOwnerRole` |
| `layout/shell/useDashboardNavigation.js` | `["staff","program_manager"]`, `role === "super_admin"` | prédicats |
| `dashboard/UnifiedDashboard.js` | hiérarchie de rôles `hasMinRole` | capacité `programs.edit` |
| `dashboard/unified-dashboard/constants.js` | `ROLE_HIERARCHY` + `hasMinRole` | supprimés (0 appelant) |
| `pm/program-workspace/ConfigTab.js` | `role === "program_manager"` | `isPlatformOwnerRole` (la règle que le payload appliquait déjà) |
| `pm/program-workspace/ReportsTab.js` | `role === "program_manager"` | profil `program_manager` |
| `pm/program-workspace/StaffAssignmentModal.js` | `role !== "super_admin"` | `isPlatformOwnerRole` |
| `pm/programs/programWorkspaceSelectors.js` | `== "super_admin"`, `== "program_manager"`, `!= "investor"`, liste `["participant","program_manager"]` | prédicats + profil |
| `pm/programs/programWorkspacePayloads.js` | `== "super_admin"` | `isPlatformOwnerRole` |
| `app/crm/page.js` | trois branches de rôle pour la boîte de messages | une seule lecture de `me/permissions` (`role` + `profiles`) |
| `app/facilitator/layout.js` | `session.role !== "super_admin"` | `isPlatformOwnerRole` |
| `app/staff/op-report/readers.js` | `contact.role !== "super_admin"` | `isPlatformOwnerRole` |
| `app/pm/programs/[id]/actions/kpis.js` | `user.role !== "super_admin"` | `isPlatformOwnerRole` |
| `components/admin/projects/list/constants.js` | `contact.role !== "participant"` | `carriesContextualValue` |

Les comparaisons restantes dans les exceptions sont des **rôles qui ne sont pas
des identités** : rôle d'un membre de projet (`lead`), rôle d'un membre
d'organisation (`admin`), libellé historique d'une affectation (`teacher`,
`group_leader`), ou un filtre de contact (`applicant`, `student`). Elles ne
décident d'aucun accès et restent hors du vocabulaire d'identité.

## 4. Divergences et points ouverts

**D-8 (nouveau, décision produit requise).** Sous D-1, la cloche d'un
gestionnaire ouvre `/staff/messages`, alors que la page `/pm/messages` limite la
composition aux programmes qu'il gère. Les deux pages sont gardées par la même
capacité (`messaging.view`), et le répertoire est déjà lisible par tout le
personnel (`contacts.view` dans le profil Staff Default) : il n'y a donc pas
d'exposition nouvelle de données, mais le **périmètre de composition** du
client change. Option par défaut recommandée : la page de messages déduit le
mode « gestionnaire » du profil, pas de l'URL — à traiter dans une étape dédiée.

**Périmètre programme (D-4).** `selectProgramAccess` approuve l'édition d'un
programme sur la foi de `assigned_pm_id` ou d'une appartenance à l'équipe — un
fait d'affectation, pas le périmètre du profil. L'écran surestime donc ce que le
serveur appliquera ; il ne le fait jamais dans l'autre sens que la règle
« refuse par défaut » vise pour un accès. Le serveur reste autoritaire. Projeter
le périmètre (étape 7.3) permettra d'aligner l'affordance.

## 5. Compteurs

| Indicateur | Avant 7.2 | Après 7.2 |
|---|---:|---:|
| Comparaisons de rôle hors moteur | 334 | **299** |
| Exceptions figées du garde-fou rôles | 204 | **186** |
| Exceptions figées du garde-fou étendu | 22 | **21** |
| Actions en dette | 60 | 60 |

## 6. Tests

- `npm run test:authz` → 7 suites / **57 tests** verts (3 tests ajoutés pour la
  projection des profils).
- Coque, barre latérale, tableau de bord, espace programme, CRM, facilitateur,
  op-report : **79 tests** verts.
- `permissions-static-guards` : 7 entrées périmées retirées au premier lot,
  15 au second — jamais devinées, lues dans le rapport `stale` du garde-fou.
- `dashboard-shell-wiring` mis à jour : la coque passe désormais le profil du
  gestionnaire au hook des badges.
- `npm run lint` → 0 erreur, avertissements inchangés (261).

Trois tests venture échouent encore (`identity-gate-bridge`,
`permissions-characterization`) ; vérifié sur un `HEAD` propre : ils échouent
sans ces changements. Préexistants, hors périmètre.

## 7. Retour arrière

`git revert` des deux commits. Aucune écriture en base. `profiles` est un champ
additif : un client qui l'ignore continue de fonctionner.

## 8. Compte rendu

```
LOT 7 — Une seule projection pour l'interface — étape 7.2
Fait :
  - me/permissions expose les profils contextuels résolus
  - PermissionProvider transporte matrice + profils
  - coque, tableaux de bord et espace programme migrés vers des prédicats
  - hiérarchie de rôles de l'interface supprimée (0 appelant)
Compteurs : comparaisons 334 -> 299 ; exceptions 204 -> 186 ; étendues 22 -> 21.
Divergences : D-8 (boîte de messages du gestionnaire) documentée pour décision ;
  périmètre programme encore approché par l'affectation côté écran.
Tests : 57 authz + 79 écrans, verts. Lint 0 erreur.
Décisions requises : D-8.
Retour arrière : git revert.
Prochaine étape : 7.3 (projeter le périmètre programme), puis Lot 8.
```
