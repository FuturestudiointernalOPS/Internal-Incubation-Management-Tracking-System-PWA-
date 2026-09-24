# Contribuer à ImpactOS

Ce guide s'adresse à toute personne qui rejoint le développement d'ImpactOS.
Lis-le en entier avant ta première modification : il t'évitera de casser des
choses que tu ne soupçonnes pas, et de refaire des erreurs déjà commises.

ImpactOS est une application **Next.js 16 (App Router) + React 19 + PostgreSQL**,
en JavaScript (ES modules, pas de TypeScript). Environ 1 200 fichiers source,
180 écrans, 400 points d'entrée serveur. C'est une grosse application : la
discipline décrite ici n'est pas du zèle, c'est ce qui la rend encore modifiable.

---

## 1. Ordre de lecture obligatoire

| # | Document | Ce qu'il t'apprend |
|---|---|---|
| 1 | `OVERVIEW.md` | La vue d'ensemble : produit, rôles, domaines, modèle de droits, vocabulaire |
| 2 | `AGENTS.md` | Règles non négociables : traduction, composants, compilation |
| 3 | `.ai/STANDARDS.md` | Conventions de code réellement appliquées |
| 4 | `DESIGN_SYSTEM.md` | Jetons de couleur, composants réutilisables, styles |
| 5 | `.ai/PROJECT.md` | Architecture, modules par domaine, règles métier |
| 6 | `docs/MVC_REFACTOR.md` + `docs/SERVER_LAYERS.md` | Où doit vivre chaque morceau de code |
| 7 | `.ai/MEMORY.md` | Décisions durables et dette technique connue |
| 8 | ce document | Comment travailler au quotidien |

Pour tout ce qui touche aux droits et permissions, ajoute
`docs/AUTHZ_CURRENT_STATE.md`. Pour tout ce qui touche à la sécurité, ajoute
`docs/SECURITY_AUDIT_REGISTER.md`.

---

## 2. Mise en route locale

### Prérequis

- **Node.js ≥ 22** (`package.json` refuse en dessous ; la machine de référence
  tourne sur Node 26)
- **npm**
- les valeurs des variables d'environnement — demande-les à un membre de l'équipe
  (elles ne sont **pas** dans le dépôt, c'est volontaire)

### Installation

```bash
npm install
npm run dev          # http://localhost:3000
```

### Variables d'environnement — lis attentivement

Le fichier `.env.local` (non versionné — ne le commite jamais) porte au minimum :

| Variable | Usage |
|---|---|
| `DATABASE_URL` | la base Postgres |
| `NEXT_PUBLIC_SUPABASE_URL` | stockage de fichiers |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique navigateur |
| `SUPABASE_SERVICE_ROLE_KEY` | clé serveur — **jamais** côté navigateur |

D'autres clés sont attendues selon ce que tu lances (envoi d'e-mails, URL de
l'application, etc.) — `README.md` en liste les principales.

> ### ⚠️ Trois avertissements qui coûtent cher
>
> 1. **Sur le poste de référence, `.env.local` pointe vers la base d'essais
>    partagée.** Tout ce que tu écris en local s'écrit dans les données que
>    d'autres consultent. Vérifie toujours la cible avant d'exécuter un script
>    qui écrit.
> 2. **Ne pointe jamais ton poste vers la production.** Les fichiers
>    d'environnement de production ne servent qu'aux procédures de mise en
>    production, jamais au développement.
> 3. **Les scripts de maintenance ne lisent pas tous le même fichier
>    d'environnement.** Certains lisent `.env.local` en premier (donc la base
>    partagée). D'autres — par exemple
>    `node scripts/db-audit/apply-migrations.mjs` — visent la **production** par
>    défaut et n'écrivent que si tu leur donnes explicitement un fichier.
>    **Ouvre le script et regarde quelle base il vise avant de le lancer.**

### Comptes de test

Les comptes d'essai prêts à l'emploi sont listés dans `README.md`
(section « Test accounts (staging) »). Ils ne fonctionnent **que** contre la base
d'essais.

---

## 3. Où va le code

```
src/
├── app/                    Écrans (App Router) + points d'entrée serveur
│   ├── admin/ staff/ pm/ participant/ facilitator/ investor/…
│   │                       Une arborescence par type d'utilisateur
│   └── api/**/route.js     Les contrôleurs (auth, validation, orchestration)
├── models/                 L'ACCÈS AUX DONNÉES : tout le SQL vit ici
├── server/
│   ├── auth/               « Qui appelle ? »
│   └── authz/              « A-t-il le droit, sur cette ressource ? »
├── components/
│   ├── layout/             Coquille (barre latérale + en-tête)
│   └── ui/                 Composants réutilisables du design system
├── lib/                    Infrastructure : base, sessions, traduction,
│                           e-mails, stockage, hooks, intégrations
└── locales/{en,fr}/        Textes traduits
```

### Les couches, et ce qu'elles n'ont pas le droit de faire

| Couche | Emplacement | Interdiction |
|---|---|---|
| **Modèle** | `src/models/**` | Ne connaît ni HTTP ni React |
| **Contrôleur** | `src/app/api/**/route.js` | **Aucun SQL en direct** |
| **Vue** | écrans + `src/components/**` | **Ne touche jamais la base** |

Corollaires pratiques :

- **Une requête = une fonction nommée dans `src/models/<domaine>.js`.** Le SQL
  passe par `db.execute({ sql, args })` avec des `?` comme marqueurs.
- **Ne fusionne pas la question d'identité et la question de droit.** « Qui
  appelle » se traite dans `server/auth`, « a-t-il le droit » dans `server/authz`.
- **N'écris jamais dans une colonne d'identifiant technique** en la générant
  toi-même : la base s'en charge.
- La séparation entre **identité, permission et accès aux données** est
  **vérifiée par des tests** qui échouent si tu la franchis. En revanche, la règle
  « aucun SQL dans un point d'entrée » est encore en cours d'application : il
  reste une trentaine de fichiers concernés. **N'en ajoute pas un de plus** —
  écris ta requête dans la couche modèle.

Tu peux t'inspirer du patron déjà en place pour les points d'entrée récents :
`src/lib/api/createHandler.js` évite de répéter l'authentification et la gestion
d'erreurs à la main.

---

## 4. Règles non négociables

### 4.1 Traduction — la plus importante

**Chaque texte visible par un utilisateur passe par `t()`.** Pas d'exception,
pas d'anglais en dur.

- Les deux langues doivent exister : `src/locales/en/…` **et** `src/locales/fr/…`,
  avec la même structure de clés.
- Une clé anglaise manquante affiche **le nom de la clé** à l'écran. Ce n'est pas
  un bug du moteur : c'est un signal, et il est voulu.
- Les fichiers sont fragiles : après chaque édition, valide le JSON.

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/fr/mon-fichier.json','utf8'))"
npm run i18n:parity      # « Missing » doit valoir 0
```

> Le contrôle de parité signale aussi des chaînes « identiques » entre l'anglais
> et le français. C'est normal et attendu pour environ 480 d'entre elles : ce sont
> des mots qui s'écrivent pareil dans les deux langues (« Session », « Backlog »,
> « Total »…). Ce n'est pas une alerte à corriger.

### 4.2 Design system

- **Toutes les couleurs passent par des variables CSS** :
  `var(--text-primary)`, `var(--surface-1)`, `var(--border-primary)`…
- **Pas de couleur écrite en dur** dans le JSX, pas de `#fff`.
- **Pas de variantes automatiques de thème** (`dark:`) : elles réagissent aux
  préférences du système, pas au thème de l'application. Utilise les variables.
- **Pas de classes de couleur neutres** (`text-slate-*`, `bg-white`,
  `text-black`) pour du texte ou un fond thémés.
- Les couleurs de statut (vert/rouge/orange/indigo) ne servent **que** pour un
  statut, jamais pour l'habillage général.
- **Réutilise avant de créer.** Les composants partagés sont dans
  `src/components/ui/` (`AppCard`, `AppButton`, `AppInput`, `AppSelect`,
  `AppModal`, `AppTable`, `AppBadge`, `AppStatusBadge`, `AppTabs`,
  `AppEmptyState`, `AppPagination`, `AppErrorBoundary`, `Skeleton`).
- **Nouveau composant réutilisable →** `src/components/ui/` **et** mise à jour de
  `DESIGN_SYSTEM.md` dans la même modification.

### 4.3 Fenêtres de confirmation, de saisie et de notification

N'utilise **jamais** `window.confirm`, `window.prompt` ou `window.alert` : ils
ignorent le thème et figent l'onglet.

```jsx
const { confirm, prompt, alert } = useDialogs();

if (!(await confirm({ message: t("…"), tone: "danger" }))) return;
const valeur = await prompt({ message: t("…"), defaultValue: valeurActuelle });
await alert({ message: t("…") });
```

### 4.4 Pages et rendu

- Les coquilles de section (barre latérale + en-tête) sont rendues **une fois**
  par la mise en page de section. **N'enveloppe jamais un écran dedans toi-même** ;
  un écran retourne uniquement son contenu.
- Certaines sections interdisent la mise en cache statique (`force-dynamic`
  déclaré dans leur mise en page). **Ne le retire jamais** : le contenu dépend de
  la session connectée.
- **Nouvel écran hors de ces sections** utilisant des fonctions du navigateur
  (traduction, thème, navigation, stockage local) : déclare toi-même
  `export const dynamic = "force-dynamic"`.

### 4.5 Sécurité

Le registre d'audit a traité quinze lots de corrections. Ne défais pas ce travail.

- **Tout point d'entrée serveur vérifie l'identité avant d'accéder aux données.**
  Ne fais jamais confiance à un rôle envoyé par le client.
- **Tout ce qui dépend d'une ressource précise** (un projet, un programme, une
  équipe) passe par une vérification de périmètre — et **refuse par défaut** en
  cas de doute.
- **La clé serveur de stockage ne se met jamais dans du code navigateur.**
- **Ne supprime jamais une vérification de sécurité parce qu'elle paraît
  redondante.** Remplace d'abord sa source de décision par le moteur officiel,
  prouve que le comportement est identique par un test, **ensuite** retire-la.
- **Toute correction de sécurité arrive avec le test qui l'aurait attrapée.**
- Les droits effectifs sont le résultat de plusieurs couches qui s'additionnent,
  et un blocage explicite l'emporte toujours sur une autorisation. **Cette règle
  ne doit jamais régresser** : elle est verrouillée par un test.

### 4.6 Base de données et migrations

- **Les nouvelles évolutions de schéma vont dans `supabase/migrations/`**, avec un
  préfixe de date `AAAAMMJJ_description.sql`.
- **N'ajoute pas de fichier dans `src/migrations/`** : ce dossier est historique.
- Style attendu : **rejouable sans danger** (`IF NOT EXISTS` / `IF EXISTS`),
  identifiants générés par la base, horodatages avec fuseau, décimales pour
  l'argent et les notes.
- **Tout changement destructeur** (suppression de table ou de données) exige un
  accord explicite. Préfère un marqueur de suppression à une suppression réelle.
- **Après un changement de schéma**, cherche partout le nom de la table ou de la
  colonne touchée et corrige les requêtes restées sur l'ancienne forme.
- **Garde en tête qu'il y a plusieurs dossiers de migrations** (historique
  éclaté) : `src/migrations/`, `migrations/` à la racine, `supabase/migrations/`
  et des scripts dans `scripts/migrations/`. Le schéma de référence est la base
  d'essais vivante.

### 4.7 Méthode produit

Ces règles viennent de la direction produit et ne sont pas négociables :

- **Ne reconstruis pas.** Comprends l'existant, puis étends ou corrige.
- **Ne redessine pas l'interface** sans qu'une règle métier ou un défaut
  d'usage ne l'exige. Aucun changement de goût personnel.
- **Réutilise avant de dupliquer** : écrans, composants, points d'entrée, tables,
  utilitaires.
- **Préserve la compatibilité** : aucun parcours existant ne doit cesser de
  fonctionner.
- **Toute nouvelle fonctionnalité doit servir au moins un des cinq piliers**
  (visibilité opérationnelle, développement des startups, exécution des
  programmes, préparation à l'investissement, décision des investisseurs). Sinon,
  elle ne doit pas être développée.

---

## 5. Méthode de travail

Le projet impose un déroulé en **six phases**, dans cet ordre :

1. **Compréhension** — explore, comprends le parcours métier. Ne code pas avant
   de maîtriser.
2. **Test fonctionnel** — teste comme un utilisateur final. Note les défauts.
3. **Analyse** — compare au modèle opérationnel validé. Ce qui marche reste.
4. **Implémentation** — la plus petite modification qui répond au besoin.
5. **Validation** — re-teste, vérifie l'absence de régression et les droits.
6. **Soumission** — accepté seulement si tout est vérifié.

Le dossier `.ai/` contient des fiches de méthode réutilisables qui décrivent ce
déroulé par type de travail : nouvelle fonctionnalité, correction de bug,
changement de base, analyse approfondie. Les rapports attendus en fin de
travail ont des modèles prêts à remplir dans `.ai/templates/`.

---

## 6. Écrire des tests

Les tests vivent dans `src/__tests__/`.

```bash
npm test                                    # tout (186 fichiers, ~30 s)
npx jest src/__tests__/mon-test.test.js     # un seul fichier
```

- **Environnement par défaut : serveur (`node`).** Les services, contrôleurs et
  modules purs s'y testent en simulant la base, l'authentification et
  l'autorisation. Un interpréteur de base en mémoire est fourni dans
  `src/__tests__/helpers/fakeLmsDb.js`.
- **Les tests d'interface demandent l'environnement navigateur** via une
  annotation en toute première ligne, suivie d'une ligne vide :

  ```js
  /**
   * @jest-environment jsdom
   *
   * …
   */
  ```

- **Conventions d'interface** (`@testing-library/react`) :
  - on simule le **réseau**, jamais le composant : on vérifie la requête émise
    et le résultat affiché ;
  - les icônes sont rendues pour de vrai (déjà configuré) ;
  - on simule les animations avec des composants **stables** — un type de
    composant recréé à chaque rendu détache les nœuds que tes assertions tiennent ;
  - hors fournisseur de traduction, `useI18n()` renvoie la clé : affirmer une clé
    prouve à la fois le texte **et** le passage par `t()` ;
  - avant interaction, rien ne doit se charger tout seul : c'est une partie du
    contrat à vérifier.

**Règle d'or :** toute nouvelle fonctionnalité arrive avec ses tests ; toute
correction arrive avec le test qui l'aurait attrapée. Un test déjà rouge avant
ton passage se **signale**, il ne se corrige pas en silence.

---

## 7. Définition de fini — avant chaque envoi

À exécuter, dans cet ordre, et les quatre doivent passer :

```bash
npm run i18n:parity      # « Missing » doit valoir 0
npm run lint             # 0 erreur
npm test                 # tout au vert
npm run build            # doit compiler
```

Puis vérifie à la main ce que les tests ne couvrent pas :

- [ ] j'ai testé le parcours comme un utilisateur final, sur la base d'essais
- [ ] aucun texte anglais en dur ; les deux langues sont complètes
- [ ] aucun changement d'interface sans raison métier ou d'usage
- [ ] si j'ai touché aux droits : un test prouve la restriction
- [ ] si j'ai touché au schéma : les requêtes utilisant la table sont à jour
- [ ] aucun secret, aucune valeur d'environnement, aucun fichier `.env` commité

Trois utilitaires de contrôle existent pour les zones sensibles :

```bash
npm run verify:alignment                      # alignement fonctionnalités / droits
node scripts/authz-venture-coverage.mjs       # couverture des accès
node scripts/audit-phase10-safety.mjs         # droits attribués à tort
```

---

## 8. Branches et intégration

### Topologie telle que vérifiée dans le dépôt

| Branche | Rôle | État observé |
|---|---|---|
| `main` | **Production** | référence par défaut du dépôt |
| `G` | **Essais** (staging) | active |
| `Ventures` | **Jumeau de `G`** — doit rester identique, octet pour octet | active |
| `A` | Ligne de travail la plus récente | contient `main` et `G` |
| `dev` | Ancienne branche d'essais | **abandonnée** (plus de mouvement depuis le 20/08) |

### Règles

- **Ne commite jamais directement sur `main`.** La production ne reçoit qu'une
  promotion.
- **Ne force jamais un envoi** (`git push --force`). **Ne résous jamais un
  conflit à la main sans demander** : demande.
- **Nomme ta branche comme le fait déjà l'équipe** : le nom de la personne, ou le
  lot de travail (`Sprint-2-Track-3`, `fix/carryover-phase1`…). Les branches sont
  fusionnées en écrasant l'historique (un « squash ») — c'est ce que suggèrent les
  branches de sauvegarde laissées dans le dépôt.
- **Envoie ton travail sur la branche d'intégration dès qu'il est fini**, et
  préviens l'équipe : rien n'est partagé tant que ce n'est pas poussé.
- **`git fetch` d'abord, lecture ensuite.** Lire l'état des branches distantes
  avant d'avoir récupéré les nouveautés produit des analyses fausses — c'est déjà
  arrivé, avec 25 commits invisibles.

### Promotion vers la production

Faire passer `G` (et son jumeau `Ventures`) vers `main` **n'est pas** une
opération git ordinaire : c'est une procédure manuelle, point par point, décrite
dans `docs/PRODUCTION_TEST.md`. Ce document **est** la définition du « test de
production ».

> **Production et essais ne sont pas seulement deux codes, ce sont deux bases de
> données.** C'est pour cela qu'une compilation verte ne prouve rien : « ça marche
> sur les essais » n'est pas une preuve que ça marchera en production. Il faut
> rejouer les étapes de données prévues.

### Deux points à confirmer avec le responsable du dépôt

Ces deux décisions ne sont pas écrites clairement dans le dépôt, et une nouvelle
recrue ne peut pas les deviner. À trancher avant d'ouvrir la contribution :

1. **Sur quelle branche se base une nouvelle branche de travail ?** Aujourd'hui
   `A` est la ligne la plus récente et contient tout ; `G` est la branche
   d'essais officielle. Les deux candidats circulent dans la documentation.
2. **Une relecture par un pair est-elle obligatoire avant de fusionner ?** Aucune
   procédure de relecture n'est actuellement documentée.

---

## 9. Pièges connus — chacun a déjà coûté du temps

### Autour des droits du module Venture

- **Six mécanismes différents** peuvent décider d'une autorisation aujourd'hui.
  **N'en ajoute pas un septième.** Le patron officiel est : une case de la
  matrice → le point d'entrée la lit → l'écran la restitue → un test de parité
  verrouille les deux.
- **Une vérification trop large** admet le personnel et les chefs de programme
  là où il ne faudrait que l'acteur concerné.
- La matrice des droits **ne se remplit que si elle est vide** : corriger une
  valeur par défaut n'atteint pas une base déjà remplie.
- Les droits par défaut des facilitateurs **héritent** de ceux des coachs :
  corriger les coachs seuls **élargit** silencieusement les facilitateurs.

### Autour du schéma

- **Deux générations de la table des ventures coexistent** : l'une nomme la
  colonne `company_name`, l'autre `name`. Interroge avant de supposer.
- Le code de venture est tantôt un **texte court**, tantôt un **identifiant
  technique**, selon la table. Une conversion est prévue pour ça ; l'oublier
  refuse silencieusement l'accès aux responsables délégués.
- Le type d'identifiant des jalons n'est **pas tranché** : le code se protège en
  comparant du texte.
- Il existe une **dérive historique** entre le code et le schéma réel. Vérifie
  contre la base vivante avant de toucher aux domaines anciens.
- Certaines requêtes sont **construites dynamiquement** et ne peuvent pas être
  validées automatiquement : elles demandent une relecture humaine.

### Autour de l'outillage

- `npm install` **retire des métadonnées** de `package-lock.json` (binaires
  Linux). C'est inoffensif : **annule ce changement**, ne le commite pas.
- Le fichier d'environnement d'essais porte un **mot de passe périmé** : une
  connexion depuis un script échoue.
- **Valide le JSON des traductions** après chaque édition (voir §4.1).

---

## 10. Où trouver quoi

| Sujet | Document |
|---|---|
| Vue d'ensemble du projet | `OVERVIEW.md` |
| Règles pour les agents et les humains | `AGENTS.md` |
| Conventions de code appliquées | `.ai/STANDARDS.md` |
| Architecture et modules par domaine | `.ai/PROJECT.md` |
| Décisions durables et dette connue | `.ai/MEMORY.md` |
| Design system et composants | `DESIGN_SYSTEM.md` |
| Référence produit, piliers, règles métier | `PRODUCT.md` |
| Où va le code (couches) | `docs/MVC_REFACTOR.md`, `docs/SERVER_LAYERS.md` |
| Droits et permissions | `docs/AUTHZ_CURRENT_STATE.md` |
| Sécurité : corrections et points ouverts | `docs/SECURITY_AUDIT_REGISTER.md` |
| Mise en production | `docs/PRODUCTION_TEST.md` |
| Passation du module Venture | `docs/HANDOVER_VENTURES.md` |
| Liste des points d'entrée serveur | `docs/API.md` |

---

## En résumé

Comprends avant de modifier. Traduis tout, dans les deux langues. Réutilise
avant de créer. Ne touche pas à une vérification de sécurité sans preuve.
Vérifie sur quelle base tu écris. Et ne fais pas passer quoi que ce soit en
production sans dérouler la procédure de production.
