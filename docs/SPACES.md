# Les trois espaces — décision et migration

Statut : **les trois espaces sont en place** (branche `views`). Les trois ont
leurs adresses — `/member`, `/staff`, `/admin` — et leurs composants :
contexte par contexte pour staff et membre, par domaine pour l'admin. Reste :
brancher les manifestes de contextes sur la navigation, et passer les
redirections en permanentes après validation.

## Décision

L'application est organisée en trois **espaces** exclusifs :

| Espace | Pour qui | Adresse de l'espace | Coquille |
| --- | --- | --- | --- |
| `member` | une personne dans ses propres programmes, ventures et apprentissages | `/workspaces` (entrée) | une par espace |
| `staff` | une fonction interne | `/staff` | une par espace |
| `admin` | le propriétaire de la plateforme | `/admin` | une par espace |

À l'intérieur d'un espace, un **contexte** décrit ce que la personne est ou fait :
fondateur, apprenant, membre de venture, participant à un programme, facilitateur,
investisseur (membre) ; opérations, chef de programme, lead manager, finance, CRM,
création (staff) ; domaines fonctionnels (admin).

Deux règles portent tout le reste :

1. **Un contexte est cumulable, un espace ne l'est pas.** Une personne peut être
   fondatrice *et* apprenante *et* membre d'une venture : chaque contexte ajoute
   ses écrans et ses portes. Un identifiant appartient en revanche à un seul
   espace.
2. **Une seule coquille par espace.** La barre latérale et l'en-tête sont montés
   une fois par le layout de l'espace. Un contexte déplacé sous un espace ne
   remonte jamais sa propre coquille.

## Source unique

`src/spaces/registry.js` répond à deux questions et à elles seules :

- à quel espace appartient cette identité (`spaceForRole`) ;
- quelles identités sont refusées dans un espace opérationnel
  (`isDeniedInOperatingSpace`).

Le garde d'entrée, la navigation et les redirections lisent cette source. Aucun
d'entre eux ne conserve sa propre liste.

## Structure cible

```text
src/
├── app/
│   ├── member/            → /member/...           (participant, founder, investor…)
│   ├── staff/             → /staff/...            (pilote en cours)
│   ├── admin/             → /admin/...            (déjà en place)
│   └── api/               ← partagé, non découpé par espace
└── spaces/
    ├── registry.js
    ├── member/{context}/  → écrans + composants du contexte
    ├── staff/{context}/
    └── admin/{domain}/
```

Un fichier de page reste un **point d'entrée mince** : il va chercher son écran
dans `src/spaces/<espace>/<contexte>/`.

## Où vit un composant

Trois couches, et une seule question à se poser : **combien d'espaces
l'utilisent ?**

| Couche | Emplacement | Règle |
|---|---|---|
| Primitives neutres | `src/components/ui/` | cartes, tableaux, boutons, badges — aucune logique métier |
| Composant d'un contexte | `src/spaces/<espace>/<contexte>/components/` | utilisé par **un seul** contexte |
| Composant partagé | `src/components/shared/<domaine>/` | utilisé par **deux espaces ou plus** — une seule copie |

Un composant partagé n'importe jamais un espace (`@/spaces/**`) : il ne doit pas
dépendre de l'écran qui l'utilise en premier. Vérifié par le test de frontière.

Les fonctions pures d'une ligne n'ont qu'un seul domicile. La jonction de classes
est `@/lib/cn` : elle était recopiée dans neuf écrans, et ces copies forçaient des
modules partagés à importer un espace juste pour l'atteindre.

Domaines déjà partagés :

| Dossier | Utilisé par |
|---|---|
| `shared/calendar/` | tableau de bord staff + tableau de bord admin |
| `shared/dashboard/` | membre, staff, admin |
| `shared/ventures/console/` | admin, staff, membre |
| `shared/ventures/workspace/` | membre, staff |
| `shared/lms/` | membre, staff, admin |
| `shared/messaging/` | membre, staff, admin |
| `shared/tasks/` | staff, admin |
| `shared/create/` | membre, staff, admin |
| `shared/contacts/`, `shared/crm/`, `shared/membership/` | CRM admin + CRM staff |
| `shared/integrations/` | la coquille globale + le tableau de bord admin |
| `shared/platform/`, `shared/public/` | le form runner admin + le formulaire public |
| `shared/kit/staff.css` | tous les rôles (le kit `stf-*`, chargé une fois) |
| `shared/notify.js` | partout où l'on affiche un toast |

## Correspondance des adresses

| Ancienne adresse | Nouvelle adresse | État |
| --- | --- | --- |
| `/pm/**` | `/staff/program-manager/**` | ✅ routes + composants, redirection temporaire |
| `/finance/**` | `/staff/finance/**` | ✅ routes, redirection temporaire |
| `/create/**` | `/staff/create/**` | ✅ routes, redirection temporaire |
| `/crm/**` | `/staff/crm/**` | ✅ routes + composants partagés, redirection temporaire |
| `/participant/**` | `/member/participant/**` | ✅ routes, redirection temporaire |
| `/founder/**` | `/member/founder/**` | ✅ routes, redirection temporaire |
| `/investor/**` | `/member/investor/**` | ✅ routes + composants |
| `/facilitator/**` | `/member/facilitator/**` | ✅ routes + composants |
| `/team/**` | `/member/team/**` | ✅ routes + composants |
| `/workspaces` | `/member` | ✅ hub de l'espace |
| `/founder/ventures/**` | `/member/participant/ventures/**` | ✅ redirection |
| `/admin/**`, `/platform/**` | inchangé | ✅ |

Les redirections sont temporaires (307) tant que la migration n'est pas validée
en production ; elles passent en permanentes à la fin.

## Ajouter un contexte

1. Créer `src/spaces/<espace>/<contexte>/` avec ses écrans et ses composants.
2. Décrire le contexte dans le manifeste de son espace (condition de détection,
   accueil, portes) — pas dans la navigation.
3. Ajouter les libellés dans `src/locales/en/` **et** `src/locales/fr/`.
4. Ajouter au moins un test : la condition de détection, et le fait que les
   écrans du contexte ne sont proposés qu'à lui.

## Frontières vérifiées automatiquement

`src/__tests__/spaces-boundaries.test.js` vérifie que :

- chaque identité appartient à un seul espace ;
- `src/spaces/member` n'importe jamais `staff` ou `admin` (et réciproquement) ;
- aucun espace n'importe la couche base de données ;
- les contextes staff vivent sous `src/app/staff/` ;
- le garde d'entrée lit le registre au lieu de garder sa propre liste.

## Validation

Après chaque lot : `npm run lint`, `npm run test`, `npm run build`, puis
`npm run i18n:parity` si des libellés ont été ajoutés. La promotion vers `main`
reste soumise à `docs/PRODUCTION_TEST.md`.
