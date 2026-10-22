# Lot 0 — Faits mesurés et corrections du point de départ

> **Mise à jour Lot 1.1 (2026-10-19).** Les faits §2.1 (deux calculs de
> connexion divergents) et §2.2 (commentaire venture contre code) sont résolus :
> les deux connexions partagent le résolveur, et le commentaire de la liste des
> membres dit désormais la même chose que le code. Voir
> `docs/permissions/LOT1-STEP1-1.md`. Le reste de ce document reste l'instantané
> de départ du Lot 0.
>
> Date : 2026-10-19. Lecture seule : aucun comportement applicatif n'a été modifié.
> Script : `npm run authz:metrics` (tableau de bord), `npm run authz:metrics:check`
> (cliquet), `npm run test:authz` (suites de garde).
> Liste exacte des actions sans capacité : `docs/permissions/LOT0-ACTIONS-SANS-CAPACITE.md`.

---

## 1. Tableau de bord reproduit

| Indicateur | Audit | Mesuré | Statut |
|---|---:|---:|---|
| Fichiers d'actions serveur (`route.js`) | 435 (audit antérieur) | **442** | corrigé |
| Fichiers avec le contrôle central de capacité (tous fichiers sous `src/app/api`) | 169 | **169** | confirmé |
| dont fichiers `route.js` | — | **147** | précision |
| Fichiers `route.js` avec une capacité, gardes composées incluses | — | **201** | mesure ajoutée |
| Fichiers `route.js` avec `requireAuth` | 133 | **133** | confirmé |
| dont cumulant session + contrôle central | 27 | **27** | confirmé |
| `requireAuth` sans contrôle central | 106 | **106** | confirmé |
| Liste de travail « sans capacité » (toutes gardes) | — | **198** | mesure ajoutée |
| dont à protéger | — | **138** | mesure ajoutée |
| dont à vérifier — périmètre présent, capacité absente | — | **26** | mesure ajoutée |
| dont personnelle légitime (déclarée soi-même) | — | **32** | mesure ajoutée |
| dont ouverte assumée (hub/stub/déclarée) | — | **2** | mesure ajoutée |
| Listes de rôles en dur dans les actions | plus de 180 | **181** | confirmé |
| Comparaisons de rôle hors moteur (lignes) | ≈ 486 | **486** | confirmé |
| Exceptions figées du garde-fou rôles | 292 | **292** | confirmé |
| Nouvelles occurrences non listées | 0 attendu | **0** | confirmé |
| Exceptions périmées | 0 attendu | **0** | confirmé |
| Exceptions figées du garde-fou étendu | — | **50** (25 décision + 25 affichage) | le commentaire du fichier dit 26+25 : périmé |
| Actions réservées au gestionnaire de programme sans personnel | 4 | **5** | corrigé, voir §2 |
| Occurrences de « gestionnaire de programme » (lignes) | 227 | **227** | confirmé |
| Rôles proposés par l'écran d'accès historique | 10 | **10** | confirmé |
| Valeurs produites par le calcul de connexion `session-login` | 9 | **9** | confirmé |
| Valeurs produites par l'autre calcul de connexion | — | **8** | mesure ajoutée |
| Union des valeurs de rôle à la connexion | 9 | **9** | confirmé |
| Fonctions du catalogue de profils | 8 | **8** | confirmé |
| Politiques de périmètre déclarées | 7 | **7** | confirmé |
| Appels de périmètre programme dans les actions | 50 | **31** (dans 18 fichiers) | **corrigé** |
| dont vérifiant aussi la capacité | 0 | **0** | confirmé |
| Appels au contrôle venture complet | 66 | **66** | confirmé |
| Appels à l'ancien contrôle d'appartenance venture | 38 | **38** | confirmé |
| Actions utilisant le point d'entrée unifié capacité + périmètre | 0 | **0** | confirmé |

### Ce que les écarts changent dans le plan

1. **Périmètre programme** : la cible « 50/50 » devient **31/31**. La mesure de 50
   n'est pas reproduite sur les actions serveur ; elle comptait probablement des
   lignes de documentation, des services ou des tests.
2. **Actions « gestionnaire de programme seulement »** : il y en a **5**, pas 4
   (voir §2). La cible devient 0, avec une vérification sur les cinq.
3. **Garde-fou étendu** : il contient **50** exceptions, pas 51. Le commentaire
   d'en-tête du fichier de liste est à corriger lors d'un prochain lot.
4. **Fichiers d'action** : **442** aujourd'hui. Le chiffre 435 appartient à un
   audit antérieur ; les nouveaux fichiers ne changent pas la conclusion.
5. **Capacité centrale** : 169 fichiers incluent 22 handlers du hub
   `platform/form-runs`. Les fichiers `route.js` avec le contrôle central sont
   **147** ; avec toutes les gardes composées, **201**.
6. **Le « 106 » contient 106 fichiers, mais 98 seulement n'ont aucune capacité
   du tout.** Huit fichiers appellent une garde composée qui vérifie une
   capacité (périmètre venture ou affectation avec capacité) sans passer par le
   contrôle central littéral : `attendance`, `facilitator-reviews`,
   `investor/pipeline`, `investor/profile`, `investor/relationships`,
   `investor/relationships/meetings`, `participants`, `submissions`.
7. **Routes ouvertes assumées** : la liste de travail n'en contient que **2**
   (les deux chemins de connexion, qui lisent une session). Les autres routes
   ouvertes (intake public, cron, webhook, sonde) n'ont aucune garde de session
   et ne font donc pas partie du périmètre « session sans capacité » ; elles
   restent déclarées dans le registre d'actions ouvertes.

---

## 2. Faits du point 3

### 2.1 Deux chemins de connexion produisent des rôles différents

**Confirmé.**

- Le calcul canonique transforme le gestionnaire de programme en personnel
  interne : `program_manager` tombe dans la branche « staff-family » et la
  fonction renvoie `staff`.
- L'autre chemin de connexion conserve `program_manager` comme rôle final.
- L'écran de connexion actuel utilise le chemin qui conserve
  `program_manager`.

Conséquence : la même personne n'a pas le même rôle selon le chemin utilisé.
L'audit parlait de **quatre** actions réservées à « administrateur +
gestionnaire de programme » ; la mesure en trouve **cinq** :

| Fichier | Ligne | Forme | Rôles |
|---|---:|---|---|
| `src/app/api/platform/integrations/calendar/route.js` | 37 | `requireAuth` | administrateur, gestionnaire de programme |
| `src/app/api/security/login-history/route.js` | 6 | `roles` | administrateur, officier de sécurité, gestionnaire de programme |
| `src/app/api/v2/kpis/route.js` | 20 | `requireAuth` | administrateur, gestionnaire de programme |
| `src/app/api/v2/kpis/route.js` | 37 | `requireAuth` | administrateur, gestionnaire de programme |
| `src/app/api/v2/kpis/route.js` | 55 | `requireAuth` | administrateur, gestionnaire de programme |

Si le chemin qui normalise `program_manager` en `staff` était utilisé, ces cinq
actions deviendraient inaccessibles à un gestionnaire de programme, car aucune
liste n'admet `staff`.

### 2.2 Le commentaire sur la liste des membres d'une venture contredit le code

**Confirmé.**

- Le commentaire dit que le personnel global voit la liste des membres.
- Le code ne fait passer que l'administrateur de la plateforme ; ensuite, il
  faut être membre actif ou affecté au venture.

C'est une divergence de règle, pas seulement de commentaire : la question « qui
est privilégié sur une venture ? » a plusieurs réponses selon le fichier.

### 2.3 Les droits d'un facilitateur ont deux sources, lues par des portes différentes

**Confirmé.**

- Les gardes de livraison lisent, dans l'ordre : la liste de droits portée par
  l'affectation, puis les capacités du profil de l'affectation, puis le défaut
  du programme.
- Le réconciliateur de contexte écrit des droits personnels à partir de la même
  liste de cases cochées ; le calcul central lit ensuite ces droits personnels.
- Selon la porte utilisée, la réponse peut donc différer, notamment après une
  modification de la liste sans réconciliation, ou l'inverse.

### 2.4 Refus en anglais en dur et refus « ressource introuvable »

**Confirmé : 16 fichiers de services contiennent au moins une phrase de refus en
anglais.** Exemples :

- `src/services/authorization/resourceGuards.js` — `Project not found`
- `src/services/tasks/updateGuards.js` — `You do not have permission…`,
  `Only the task creator or assignee…`
- `src/services/tasks/query.js` — `You can only access your own tasks.`
- `src/services/tasks/approval.js`, `assignmentAction.js`, `blockers.js`,
  `carryover.js`, `comments.js`, `duplicate.js`, `logs.js`, `resources.js`,
  `update.js`
- `src/services/ventures/duplication.js`

**Masquage de refus :** l'ancien contrôle d'appartenance venture renvoie une
session vide pour un non-membre, et les routes répondent alors « ressource
introuvable ». Le contrôle venture complet, lui, répond un refus explicite
« hors périmètre ». Les deux comportements coexistent pour la même question.

La liste complète des fichiers concernés est produite par le tableau de bord
(`hardcodedEnglishRefusalSites`), et se met à jour à chaque exécution.

---

## 3. Cliquet vérifié

- `npm run test:authz` : **3 suites, 7 tests, verts**.
- `permissions-static-guards.test.js` : aucune occurrence nouvelle, aucune
  exception périmée.
- `permissions-role-gates-extended.test.js` : aucune nouvelle décision
  d'appartenance venture, aucun masque nouveau.
- `authz-metrics-ratchet.test.js` : les compteurs de dette ne remontent pas ; la
  couverture ne baisse pas.
- `npm run authz:metrics:check` : **cliquet respecté**.

Le test `authz-metrics-ratchet.test.js` fige aussi les faits ci-dessus. Le lot
qui corrigera un fait devra mettre ce test à jour **dans le même changement** :
c'est ce qui empêche une correction silencieuse de réintroduire l'ancien
comportement.

---

## 4. Décisions toujours bloquantes

Le Lot 0 ne tranche aucune règle. Les décisions D-1 à D-6 du prompt restent
nécessaires. Les deux premières bloquent le Lot 1 :

- **D-1** : le gestionnaire de programme doit-il être une identité de base
  (`staff`) avec un profil, ou garder un rôle propre ? Le défaut recommandé reste
  « identité de base + profil ».
- **D-2** : définition unique de « privilégié » par famille (archives, accès
  venture, gestion de programme, liste des participants).

Les décisions D-3 à D-6 bloquent les lots suivants et ne sont pas nécessaires
pour démarrer le Lot 1.

---

## 5. Compte rendu du lot

```
LOT 0 — Instrumenter et geler la dette — étapes 0.1 à 0.4
Fait :
  - collecteur de mesures partagé (CLI + test Jest)
  - tableau de bord publiable en CI (workflow dédié)
  - cliquet de dette + couverture dans le test
  - liste exacte des actions sans capacité, classée
  - vérification des cinq faits du point 3
Compteurs :
  - fichiers d'action : 442
  - contrôle central : 169 fichiers (147 route.js)
  - requireAuth sans contrôle central : 106 (dont 98 sans aucune capacité)
  - liste de travail : 198 (138 à protéger, 26 à vérifier, 32 soi-même, 2 ouvertes)
  - listes de rôles en dur : 181
  - comparaisons de rôle hors moteur : 486
  - exceptions rôles / étendues : 292 / 50 (0 nouvelle, 0 périmée)
  - périmètre programme : 31 appels, 0 avec capacité (audit disait 50)
  - venture : 66 contrôle complet / 38 ancien / 0 point d'entrée unifié
Divergences en mode ombre : aucune règle changée ; la comparaison ombre
  n'est pas encore active (elle appartient aux lots suivants).
Tests ajoutés / passants : 1 suite ajoutée ; 3 suites, 7 tests verts.
  - npm run lint : 0 erreur (261 avertissements, aucun dans les fichiers ajoutés ;
    lint ciblé des fichiers ajoutés : vert)
  - npm run authz:metrics:check : cliquet respecté
  - le cliquet a été prouvé en échec avec un fichier temporaire, puis vert
    après suppression.
Décisions requises : D-1 et D-2 pour démarrer le Lot 1 ; D-3 à D-6 pour la suite.
Retour arrière : supprimer les fichiers ajoutés (scripts, test, workflow, docs) ou
  git revert du commit ; aucune règle applicative n'a été modifiée.
Prochaine étape : Lot 1, étape 1.1, après validation de D-1.
```

## 6. Reproduire

```bash
npm run authz:metrics          # tableau de bord complet
npm run authz:metrics -- --list # la liste de travail dans le terminal
npm run authz:metrics:check    # échoue si un compteur de dette remonte
npm run test:authz             # cliquets Jest
node scripts/authz-metrics.js --write-docs # régénère la liste des actions
```
