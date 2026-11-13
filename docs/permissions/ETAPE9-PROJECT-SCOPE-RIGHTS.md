# Étape 9 — la portée des projets devient un droit

Statut : **implémenté le 2026-11-13, vérifié en staging**. `projects.view_all`
ajouté au catalogue et appliqué en staging ; `authz:doctor` répond **OK**.

## Le problème

La portée des projets reposait sur `seesWholePortfolio(role)` (propriétaire,
personnel interne, gestionnaire de programme) à trois endroits :

- `projects/access.js` — faut-il exiger l'appartenance au projet avant de le
  modifier ?
- `projects/workspace.js` — quels projets une liste peut-elle retourner ?
- `projects/collaboration.js` — quelles affectations et invitations peut-on voir ?

Le rôle ne peut pas exprimer « voir tous les projets » : c'est un droit.

## Ce qui change

### Un droit, une cohorte inchangée

**`projects.view_all`** — « Voir tous les projets, pas seulement ceux qu'on
possède ou auxquels on appartient ».

Il est accordé au profil **personnel interne** (`staff_default`), qui couvre
aussi le gestionnaire de programme, et au propriétaire via son profil complet.
C'est exactement la cohorte d'avant, donc **le comportement ne change pas** ; un
administrateur peut désormais l'accorder ou le retirer.

### Le helper partagé ne lit plus de rôle

`src/services/authorization/listingScope.js` ne contient plus
`PORTFOLIO_ROLES` ni `seesWholePortfolio`. Il reçoit le **verdict**
(`seesAll`) et, s'il est absent, **ferme** le périmètre : une portée par défaut
« probablement le personnel » était précisément ce qu'on retire.

### Les trois surfaces

- `resolveProjectListFilter` transmet le verdict à la règle partagée ;
- `listProjects` le résout avec `resolveProjectPortfolio({ role, cid })` ;
- `needsProjectObjectCheck` devient asynchrone et demande le droit au moteur :
  sans `projects.view_all`, l'appartenance au projet est exigée, comme avant ;
- `listProjectAssignments` et `listProjectInvitations` font de même (et le menu
  déroulant « tous les projets actifs » n'est rempli que pour les détenteurs).

Le contexte est mis en cache par identité : ces services ne paient pas une
lecture par question. Un échec de résolution est une porte fermée.

## Vérification

- `authz:doctor` : **OK** (avant : `projects.view_all` manquant).
- Données appliquées en staging : **2 lignes**
  (`super_admin_default.projects.view_all`, `staff_default.projects.view_all`).
- Photographie de référence : **0 changement, 0 régression**.
- `npm run test:authz` : **28 suites / 319 tests** (les deux suites de
  collaboration ont été adaptées : leur faux moteur répond maintenant
  `projects.view_all` selon le scénario).
- ESLint : 0 erreur. `npm run build` : succès.

## Ce qui reste keyé sur l'identité

**Converti à l'étape 10** : les gardes d'écriture listées ici (annuler
l'invitation d'autrui, créer pour quelqu'un d'autre, réassigner/annuler une
affectation, les dérogations du propriétaire) passent par `projects.moderate`,
`tasks.create` et `tasks.moderate`. Voir `ETAPE10-WRITE-GUARDS.md`.

Il ne reste qu'une exception d'entité : un compte `team` (pas une personne, pas
de profil).
