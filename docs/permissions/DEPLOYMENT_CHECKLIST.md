# Checklist de déploiement — autorisation

À exécuter avant et après tout déploiement qui touche les droits, les profils,
l'éligibilité ou le menu. **Lecture seule** sauf l'étape d'application des
données de seed, qui est explicite.

---

## 0. Verrou du code (sans base de données)

```bash
npm run test:authz
```

- Attendu : **28 suites / 320 tests passés**.
- Vérifie la frontière données / vocabulaire : rôles, profils, fonctionnalités,
  capacités, adresses d'arrivée et portes de plateforme.
- Exécuté par la CI à chaque pull request (`.github/workflows/authz-ratchet.yml`).
- Détail : `docs/permissions/ETAPE6-LOCK.md`.

---

## 1. Avant le déploiement — complétude de la base

```bash
npm run authz:doctor -- --strict
```

- Verdict attendu : **OK**.
- `CRITIQUE` : ne pas déployer. La base n'a pas les profils, les droits ou les
  éligibilités nécessaires ; l'application refuserait tout le monde.
- `AVERTISSEMENTS` : relire chaque ligne. Sont notamment signalés :
  - les droits du catalogue absents du profil du propriétaire ;
  - les responsabilités sans configuration ;
  - les rôles stockés hors du vocabulaire de base.

Pour cibler une base précise :

```bash
npm run authz:doctor -- --env .env.prod-verify --allow-production --strict
```

Le script affiche le projet (`postgres.<ref>`) sans jamais exposer le mot de
passe. `--allow-production` est obligatoire.

---

## 2. Données de seed — simuler, puis appliquer

La configuration initiale vit dans `src/models/authorization/seedData.js`.
L'application est **insert-only** : aucune ligne existante n'est écrasée.

```bash
# 1. Simulation (transaction annulée)
npm run authz:apply-defaults -- --details

# 2. Écriture réelle, après revue du détail
npm run authz:apply-defaults -- --apply
```

Règles :

- Ne jamais appliquer sur la production sans avoir relu le détail ligne par
  ligne.
- Une ligne « capability … » est un **droit ajouté**. Une ligne
  « eligibility … » est une **fonctionnalité ouverte** à une identité.
- Les métadonnées des responsabilités peuvent être mises à jour sans changer
  qui y a accès.

---

## 2 bis. Propriétaire — mode « même chemin »

Le mode est **désactivé par défaut**. Ne l'activer qu'après les contrôles
suivants :

1. `authz:doctor --strict` sur la cible : **OK** ;
2. photographie de production disponible ;
3. compte du propriétaire **actif** ;
4. profil par défaut du propriétaire complet (0 droit manquant).

Activation :

```bash
AUTHZ_OWNER_THROUGH_ENGINE=true
```

Après activation, relancer la photographie et comparer. Attendu : **0
régression**, et pour seuls changements les éligibilités du propriétaire qui
passent de « contournée » à explicite. Retour arrière : retirer le drapeau.

Le drapeau change aussi l'**interface** : les écrans cessent de court-circuiter
les droits du propriétaire (`/api/me/permissions` publie `ownerThroughEngine`).
Comme le profil par défaut du propriétaire contient tout le catalogue, rien ne
disparaît ; un droit retiré cesse simplement de s'afficher.

Détail : `docs/permissions/ETAPE2-OWNER-THROUGH-ENGINE.md`.

---

## 2 ter. Arrivée — « depuis les droits »

Le drapeau est **désactivé par défaut**. Ne l'activer qu'après avoir relu la
comparaison `AUTHZ_LANDING_FROM_RIGHTS=true` : les seuls changements attendus
sont des **arrivées**, jamais des droits.

```bash
AUTHZ_LANDING_FROM_RIGHTS=true
```

- En staging, les 3 changements attendus sont `/member` → `/member/founder`
  (fondateurs de plusieurs ventures) ; **0 régression**.
- Retour arrière immédiat : retirer le drapeau.

Détail : `docs/permissions/ETAPE4-LANDING-FROM-RIGHTS.md`.

---

## 2 quater. Portes — menu, espaces et plateforme

Deux surfaces ne sont pas derrière un drapeau : elles suivent les droits dès le
déploiement.

1. **L'espace** est une propriété du rôle, qui est une donnée de la base. Le
   tableau identité → espace vit dans `src/spaces/registry.js` et nulle part
   ailleurs. Rien à configurer.
2. **Les modules de la plateforme** (`/platform`) déclarent chacun le droit que
   leur API exige ; une porte sans droit n'apparaît pas.

Perte attendue, à ne pas « réparer » : le profil par défaut du personnel ne
détient ni `runs.view` ni `forms.view`, donc **Dashboard et Forms disparaissent
de `/platform` pour le personnel**. Les API de ces deux écrans refusaient déjà.
Le propriétaire détient tout le catalogue : aucune perte pour lui.

Détail : `docs/permissions/ETAPE5-SPACE-MEMBERSHIP.md`.

---

## 3. Après le déploiement — parité

```bash
# Nouvelle photographie + comparaison avec la référence
npm run authz:snapshot -- --compare scratch/authz-reference/<référence>.json
```

- Cible : **0 régression** (aucun droit retiré, aucune porte de menu perdue),
  à l'exception des pertes décidées et listées ci-dessus (Forms à l'étape 3,
  Dashboard et Forms de `/platform` à l'étape 5).
- **Étape 10 — `tasks.create`** : les droits ajoutés apparaissent comme des
  **ouvertures** (`tasks.create` accordé au personnel interne). Un compte dont
  `contacts.status` n'est pas `active` sera refusé par le moteur
  (`account_not_active`) là où l'ancienne liste de rôles le laissait passer :
  c'est la porte du compte qui s'applique, pas une perte légitime. Réactiver le
  contact est la correction.
- Les **ouvertures** doivent être exactement celles décidées à l'étape 2.
- En production, ajouter `--env .env.prod-verify --allow-production`.

---

## 4. En cas de refus inattendu

1. `npm run authz:doctor` pour vérifier que la base est complète.
2. `npm run authz:snapshot -- --cid <identifiant>` pour la personne concernée.
3. Vérifier la source du refus : éligibilité, droit absent, blocage explicite,
   ou compte non actif.
4. Ne jamais « réparer » en ajoutant un rôle ou un cas particulier dans le code :
   la correction est une donnée, dans la base.
