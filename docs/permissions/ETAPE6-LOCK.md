# Étape 6 — verrouiller la frontière données / vocabulaire

Statut : **implémenté le 2026-11-12**. Aucun comportement applicatif modifié.

Cette étape ne retire pas encore les anciennes tables de rôle : les drapeaux des
étapes 2, 3 et 4 restent désactivés par défaut et la photographie de production
n'est pas encore disponible. Elle **verrouille** ce qui a été construit, pour que
la frontière ne se dégrade pas en attendant l'activation.

## La frontière

| Côté | Contenu | Où |
|---|---|---|
| **Vocabulaire (code)** | les trois espaces, les fonctionnalités, les modules et leurs capacités, les profils du catalogue, les adresses | `src/spaces/registry.js`, `src/models/authorization/constants/*`, `src/models/authorization/seedData.js`, `src/models/authorization/landingData.js` |
| **Données (base)** | qui détient quel profil, qui est éligible à quelle fonctionnalité, quels droits sont accordés ou bloqués, quel profil est le défaut d'un rôle | tables d'autorisation, alimentées par le seed puis administrées |

Le code dit **ce qui existe** ; la base dit **qui y a droit**.

## Les nouveaux verrous (testables sans base)

`src/__tests__/authorization-data-coherence.test.js` — **10 tests** :

- chaque profil du catalogue a une clé unique et des capacités qui existent ;
- chaque défaut rôle → profil pointe sur un profil réel et un rôle connu ;
- chaque ligne d'éligibilité nomme une fonctionnalité et des identités réelles ;
- chaque ligne de droit délégué nomme un profil et un droit réels ;
- chaque module de capacité est rattaché à une fonctionnalité déclarée ;
- le fichier d'arrivée est **inerte** (aucun import, aucune base) ;
- chaque entrée d'arrivée nomme un espace, un profil, un rôle, une relation et un
  droit réels ;
- **chaque adresse d'arrivée résout vers une page existante** ;
- l'accueil de chaque espace existe ;
- chaque module de plateforme nomme un droit réel.

Le dernier point est celui qui attrape le plus tôt une dérive : renommer une
capacité, supprimer un profil ou déplacer une page fait échouer ce test au lieu
de casser une connexion.

## Le verrou existant, désormais dans la CI

`authorization-nav-data.test.js` vérifiait déjà que chaque destination du menu a
une proposition et que chaque capacité proposée existe — mais il ne tournait pas
dans le travail de CI. **Il y est désormais**, avec les suites des étapes 3 à 5.

`npm run test:authz` couvre maintenant **25 suites / 281 tests** :

| Sujet | Suites |
|---|---|
| moteur et modèle | `authorization-model`, `roles`, `scope-policies`, `permissions-scope-decision`, `profile-coherence`, `responsibility-grants`, `authz-program-manager-profile` |
| gardes statiques | `permissions-static-guards`, `permissions-role-gates-extended`, `authz-metrics-ratchet`, `messaging-mode`, `login-role-unification`, `legacy-identity-migration`, `retired-routes` |
| données | `authorization-data-coherence`, `authorization-nav-data` |
| arrivée | `landing-from-access`, `login-landing` |
| propriétaire | `authorization-owner-through-engine`, `owner-through-engine-ui` |
| CRM | `crm-next-action` |
| tâches (portée) | `tasks-access-rights` |
| espaces et menu | `navigation-from-rights`, `member-contexts`, `spaces-boundaries` |

`.github/workflows/authz-ratchet.yml` exécute déjà `npm run test:authz` : le
verrou s'applique donc à chaque pull request et à chaque poussée sur `G` et
`main`, sans base de données.

## Ce qui reste volontairement en place

Les anciennes tables restent tant que les drapeaux ne sont pas activés **et**
vérifiés en production :

| À retirer (étape finale) | Remplacé par | Condition |
|---|---|---|
| `OPERATING_DENIED` (liste d'identités) | l'espace du rôle déjà en base | après revue des gardes d'espace |
| `ROLE_HOME` + `resolveLanding` | `landingData.js` + `resolveLandingFromAccess` | `AUTHZ_LANDING_FROM_RIGHTS` vérifié en production |
| `ROLE_ACCESS` (menu par rôle) | l'arbre maître + les droits | `AUTHZ_NAV_FROM_RIGHTS` vérifié en production |
| `permissions` des modules de plateforme | le droit déclaré sur chaque module | déjà utilisé par la navigation ; la liste ne sert plus qu'aux tableaux de catalogue |

## Validation

- `npm run test:authz` : **25 suites, 281 tests passés**.
- `npm run lint` : **0 erreur**.
- `npm run build` : **succès**.
- Photographie de référence : **0 changement**.

## Prochaine étape

Dès que la photographie de production est disponible :

1. `npm run authz:doctor -- --env .env.prod-verify --allow-production --strict` ;
2. appliquer les données de seed (`authz:apply-defaults -- --apply`, après revue) ;
3. activer les trois drapeaux un par un, en comparant à chaque fois ;
4. retirer alors les tables de rôle listées ci-dessus.
