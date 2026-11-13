# Étape 5 — l'espace et ses portes viennent des données

Statut : **implémenté le 2026-11-12, vérifié en staging**. Aucune décision
d'accès serveur n'a changé ; les surfaces qui offraient une porte déjà morte la
perdent.

## Le principe

Un **espace** est un cadre structurel : une personne travaille dans son espace
personnel, dans l'espace du personnel interne, ou dans celui du propriétaire.
Il n'y a **que trois espaces** ; ce n'est pas une permission, c'est une adresse.

Ce qui décide de l'espace est donc **le rôle de la personne**, et ce rôle est
déjà une donnée : il vit dans la base (`contacts.role`, puis dans la session).
Le code ne garde que le **vocabulaire fermé** — les trois espaces et la liste des
identités que chacun accepte (`src/spaces/registry.js`) — exactement comme il
garde le catalogue des droits : il dit *ce qui existe*, jamais *qui y a droit*.

Règle appliquée : **un seul tableau identité → espace**, lu par les gardes, la
navigation et le calcul d'arrivée. Aucun composant ne garde sa propre liste.

## Ce qui change

### 1. Le garde de `/admin` lit le registre

`src/app/admin/layout.js` comparait `role === "super_admin"` et gardait sa propre
table de redirection (`staff`, `program_manager`, `participant`). Il demande
maintenant `spaceForRole(role) === "admin"` et renvoie les autres vers la même
destination que la connexion (`roleHomeHref`, puis l'accueil de l'espace). Une
personne ne peut plus recevoir deux adresses différentes selon qu'elle arrive par
la connexion ou par une visite directe de `/admin`.

### 2. La navigation ne teste plus de nom de rôle

`src/lib/masterNavigation/builders.js` utilisait `role === "super_admin"` pour
savoir s'il fallait laisser passer les adresses `/admin`. Il demande maintenant
`spaceForRole(role) === "admin"`. Comportement identique pour toutes les
identités connues ; la dernière décision d'espace « par nom de rôle » du menu a
disparu (l'entrée `#M3` correspondante du garde statique a donc été retirée du
ratchet).

### 3. Les portes de la plateforme viennent des droits

Chaque module de `src/models/platform/registry.js` déclare désormais le **droit
que son API exige déjà** :

| Module | Adresse | Droit | API qui le vérifie |
|---|---|---|---|
| Dashboard | `/platform` | `runs.view` | `form-runs?dashboard=true` |
| Forms | `/platform/forms` | `forms.view` | `platform/forms` |
| Runs | `/platform/runs` | `runs.view` | `platform/form-runs` |
| Historical Import | `/admin/platform/import` | `settings.edit` | `platform/import/*` |
| Identity Review | `/admin/platform/import/review` | `settings.edit` | `platform/import/review-flags` |
| Scores | `/admin/platform/scores` | `runs.view` | `platform/ai/evaluation-scores` |

La barre latérale de la plateforme et la page « Modules » n'affichent un module
que si le droit est détenu. La liste de rôles (`permissions`) survit **uniquement**
pour les écrans de catalogue qui n'offrent aucun lien ; elle n'est plus une porte.

Conséquence, identique à la décision de l'étape 3 pour Forms : le profil par
défaut du personnel ne détient ni `runs.view`, ni `forms.view`, ni
`settings.edit`. Le personnel ne voyait donc dans `/platform` que des portes dont
l'API refusait déjà l'accès ; elles disparaissent. Le propriétaire détient tous
les droits du catalogue : rien ne change pour lui.

## Ce qui reste dans le code, volontairement

- **Les trois espaces et leur vocabulaire.** Ajouter un quatrième espace est une
  décision produit, pas une décision d'administrateur : cela change l'ossature de
  l'application, pas l'accès d'une personne.
- **Le tableau identité → espace.** Il traduit le rôle en adresse ; le rôle lui-même
  est une donnée de la base.

Tout le reste — éligibilité, profils, droits, arrivée, portes — est déjà une
donnée, et le reste du plan le rend administrable depuis la base.

## Validation

- `spaces-boundaries.test.js` : **31 tests passés** (dont les nouvelles règles
  « le garde admin lit le registre », « la navigation ne compare plus le rôle »,
  « aucune porte de plateforme sans droit détenu »).
- `navigation-from-rights.test.js`, `navigation.test.js`,
  `member-contexts.test.js`, `permissions-static-guards.test.js` : passés ;
  le ratchet a **perdu une exception**.
- `npm run test:authz` : **101 tests passés**.
- Photographie de référence : **0 changement**, 0 régression, sur la base de
  staging.
- ESLint : **0 erreur**.

## Reste à faire

1. Étendre la même règle aux derniers écrans de catalogue (`/platform/settings`
   affiche la table de rôles à titre documentaire — ce n'est pas une porte).
2. Après activation des drapeaux et vérification en production, retirer les
   tables de rôle restantes (étape 6).
