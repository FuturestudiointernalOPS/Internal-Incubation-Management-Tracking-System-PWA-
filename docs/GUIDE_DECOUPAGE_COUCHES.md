# Guide — Découpage en couches

> **But de ce document.** Expliquer *pourquoi* nous découpons le code en couches,
> *ce que* chaque couche a le droit de faire, et *comment* réaliser le prochain
> morceau de découpage — pas à pas. Il est écrit pour qu'un interne qui arrive
> puisse comprendre la logique et poursuivre le chantier sans nous.

Ce guide est le **mode d'emploi**. Les documents de référence, eux, sont le
journal de bord et le plan :

| Document | Ce qu'il contient | Quand le lire |
|---|---|---|
| `docs/LAYER_SPLIT.md` | Le **journal** de chaque tranche déjà faite + le backlog | Avant de choisir une tranche |
| `docs/MVC_REFACTOR.md` | Le **plan par vagues** (SQL → modèles) | Pour comprendre l'historique |
| `docs/SERVER_LAYERS.md` | Le **chemin d'une requête** couche par couche | Pour savoir qui a le droit d'importer quoi |
| **ce document** | La **stratégie + la recette** en langage clair | Pour démarrer |

---

## 1. Le problème que l'on cherchait à résoudre

ImpactOS est une application Next.js unique : le serveur ce sont les routes de
`src/app/api/**`, l'interface ce sont les pages de `src/app/<role>/**`. Au début,
une même fonction faisait tout : elle lisait la base de données, **prenait une
décision métier** (« cette personne a-t-elle le droit ? », « que doit-il se
passer ensuite ? ») et fabriquait la réponse HTTP.

Conséquences concrètes :

- **Impossible de tester une règle sans base de données.** La règle était collée
  à la requête SQL, donc pour la vérifier il fallait brancher Postgres.
- **Un changement de règle obligeait à toucher plusieurs endroits.** La même
  décision était recopiée dans plusieurs routes.
- **On ne savait plus où habitait quoi.** Un fichier de 5 600 lignes, un autre de
  6 800 lignes… Le SQL était éparpillé dans les routes au lieu d'être regroupé.

Le découpage en couches répond à ces trois douleurs : isoler la **donnée**, la
**décision**, le **transport HTTP** et l'**affichage** pour que chacun puisse
vivre, changer et être testé séparément.

---

## 2. La cible : quatre couches, plus l'infrastructure

```text
Vue             src/app/<role>/**/page.js · src/components/**
   │            affiche, capture la saisie — ne touche JAMAIS la base
   ▼
Contrôleur      src/app/api/**/route.js
   │            authentifie, valide, met en forme la réponse — AUCUNE décision, AUCUN SQL
   ▼
Service         src/services/<domaine>/**     ← la couche NOUVELLE
   │            décide (« a-t-il le droit ? », « que faire ensuite ? ») — AUCUN SQL
   ▼
Dépôt           src/models/<domaine>/**
   │            une fonction par requête — AUCUNE décision, AUCUN HTTP
   ▼
Base            src/lib/db.js   (pool Postgres direct, pas d'ORM)
```

L'**infrastructure** (`src/lib/**` : moteur de base, i18n, e-mail, stockage,
journalisation) n'est *pas* une couche métier. Elle est à côté et sert tout le
monde.

### Ce que chaque couche a le droit de faire

| Couche | Où | Sa responsabilité | Interdit |
|---|---|---|---|
| **Vue** | `src/app/<role>/**`, `src/components/**` | Rendre l'UI, gérer la saisie ; récupérer les données **via une route API** | Importer `@/lib/db`, exécuter du SQL |
| **Contrôleur** | `src/app/api/**/route.js` | Authentifier, valider, orchestrer, mettre en forme la réponse | Prendre une décision métier, exécuter du SQL |
| **Service** | `src/services/<domaine>/**` | Décider, enchaîner les étapes, appliquer la politique métier | Exécuter du SQL, importer `next/server` |
| **Dépôt** (« modèle »/« store ») | `src/models/<domaine>/**` | Une fonction par requête, SQL à l'identique, mise en forme des lignes | Prendre une décision, importer `next/server` ou React |

### La règle qui rend le découpage rentable

> **Un service ne fait JAMAIS de SQL.**

Si un service exécutait une requête, sa décision ne pourrait pas être testée sans
base de données — exactement le problème que l'on cherche à éliminer. Cette règle
n'est pas une convention : elle est **vérifiée automatiquement** (voir §8).

`src/services/authorization/context.js` a été le premier module déplacé : c'était
la décision de permission.

---

## 3. Reconnaître à quelle couche appartient un morceau de code

Quand vous ouvrez une fonction et hésitez, posez-vous ces questions dans l'ordre :

1. **Est-ce que ça dessine quelque chose à l'écran ?** → Vue.
2. **Est-ce que ça transforme une entrée HTTP en réponse HTTP** (lire un
   paramètre d'URL, renvoyer un code d'erreur) ? → Contrôleur.
3. **Est-ce que ça répond à une question de type « a-t-il le droit ? », « que
   se passe-t-il ensuite ? », « est-ce dans le périmètre ? »** → Service.
4. **Est-ce que ça ne fait que lire ou écrire des données** (un `SELECT`, un
   `INSERT`, un `UPDATE`, un `DELETE`) ? → Dépôt.

Cas limite important : **choisir un filtre ou une clause SQL n'est pas une
décision.** Si une fonction se contente d'ajouter un `WHERE` ou de choisir une
colonne, elle reste dans le dépôt. C'est ce qu'on appelle la « mise en forme du
dépôt » (*repository shaping*), et c'est légitime dans `src/models/**`.

---

## 4. Le procédé de découpage — la recette pas à pas

C'est la procédure à suivre pour chaque morceau. On appelle un morceau de ce
travail une **tranche** (*slice*).

### Étape 0 — Choisir la tranche
On prend **un seul** module qui mélange décision et accès aux données, ou **une
seule** route qui fait de même. Jamais deux à la fois.

### Étape 1 — Écrire le test AVANT
On écrit ou on étend un test qui décrit **le comportement**, pas
l'implémentation : quels chemins de décision existent, quelles réponses en
sortent. Ce test devient le filet de sécurité : il doit passer **avant** et
**après** le déplacement.

### Étape 2 — Séparer mentalement les deux groupes
Dans le module à découper, on repère :
- les **requêtes** (tout ce qui parle à la base) ;
- les **décisions** (tout le reste de la logique métier).

### Étape 3 — Copier le SQL **à l'identique** dans le dépôt
On crée (ou on complète) un fichier dépôt, une fonction par requête, nommée
d'après **la donnée qu'elle renvoie** (`getActiveDataSourceById`,
`listBudgetLines`…). Règle absolue : **le SQL est déplacé sans être réécrit**. On
ne reformate pas, on ne réordonne pas, on n'« améliore » pas. Les tests
d'API reconnaissent le texte des requêtes : un SQL modifié casse le filet.

### Étape 4 — Déplacer la décision dans le service
On crée le service correspondant dans `src/services/<domaine>/`. Il importe les
lectures du dépôt, applique la logique métier, et **ne contient plus aucun SQL**.
On supprime ensuite le SQL d'origine.

### Étape 5 — Garder les anciens chemins d'import qui fonctionnent
Tout symbole public qui existait continue d'exister le temps d'une version, grâce
à une **façade** (voir §6). `grep` ne doit plus rien trouver avant de la
supprimer.

### Étape 6 — Vérifier
```sh
npm test                 # toutes les suites
npx eslint .             # 0 erreur
npm run build            # le build attrape les imports directs que les tests ratent
```
Le **build** est important : une route qui importerait un symbole déplacé
directement ne casse qu'à la compilation.

### Étape 7 — Journaliser
On met à jour `docs/LAYER_SPLIT.md` (le journal) : on décrit la tranche faite et
on coche le backlog. C'est ce qui permet à la personne suivante de reprendre.

### Étape 8 — Nettoyer plus tard
On supprime les façades une fois que plus personne ne les importe. C'est la toute
dernière étape, et elle est facultative tant que les façades sont en place (elles
ne coûtent rien).

---

## 5. Un exemple concret : le domaine finance

Avant, un seul module résolvait la source de données, **décidait** comment
agréger les chiffres **et** exécutait le SQL. Après découpage, on a trois pièces :

**Le dépôt** — `src/models/finance/queriesStore.js` : uniquement le SQL, une
fonction par requête, déplacé tel quel.

```js
/** Un data source actif par identifiant (ou aucun). */
export function getActiveDataSourceById(id) {
  return db.execute(
    "SELECT id, last_sync_at, fiscal_year FROM data_sources WHERE id = ? AND status = 'active'",
    [id],
  );
}
```

**Le service** — `src/services/finance/queries.js` : la décision et le calcul,
sans SQL.

```js
import { getPlannedBudgetTotal, getExpenseTotal /* … */ } from "@/models/finance/queriesStore";

export async function getSummary(dataSourceId, year) {
  const dataSource = await resolveDataSource(dataSourceId);   // décision : quelle source ?
  const planned = await getPlannedBudgetTotal(dataSource.id, fiscalYear);
  const spent   = await getExpenseTotal(dataSource.id);
  // … calcul de remainingBudget, executionRate …  ← décision métier
}
```

**La façade** — `src/models/finance/queries.js` : l'ancien chemin continue de
fonctionner.

```js
export * from "@/services/finance/queries";
```

Résultat : on peut tester `getSummary` en simulant les lectures, sans base de
données ; le SQL reste protégé ; et aucun appelant n'a eu besoin d'être modifié.

*(Les fichiers store/service portent souvent le mot `Store`, `Reads` ou
`Queries` : c'est une convention pour dire « ceci est le dépôt ».)*

---

## 6. Les façades : déplacer sans rien casser

Quand un symbole change de maison, les ~250 fichiers qui l'importaient doivent
continuer à compiler. On utilise deux dispositifs, **tous les deux temporaires** :

| Dispositif | Forme | Quand l'utiliser |
|---|---|---|
| **Façade de modèle** | `src/models/<…>.js` fait `export * from "@/services/…"` | Quand le **SQL et la décision** partent tous les deux du modèle |
| **Façade agrégante dans `lib`** | `src/lib/<…>.js` réexporte **et** le dépôt **et** le service | Quand **seul la décision** bouge et que le SQL reste dans `models` — **à préférer**, car elle ne crée aucune dépendance entre couches |

Exemples réels : `resolver`, `scope`, `context`, `contextGrants`,
`programAssignments` sont des façades de modèle ; `eligibility` et `membership`
sont des façades agrégantes.

**Règle :** une façade est supprimée uniquement quand `grep` ne trouve plus
aucun importateur. Tant que ce n'est pas le cas, on la laisse.

### Qui a le droit d'importer qui

| Couche | Peut importer | Ne doit jamais importer |
|---|---|---|
| `app/**` (pages, composants) | `server/**`, les modèles via les contrôleurs, `lib/**` | `lib/db` directement |
| `app/api/**/route.js` | `server/**`, `services/**`, `models/**`, `lib/api` | — (et toujours pas de SQL inline) |
| `services/**` | `models/**`, `server/auth/**`, `lib/**` (infra) | `lib/db`, `app/**`, `components/**` |
| `server/auth/**` | `lib/**`, `models/**` | `server/authz/**`, `app/**`, `components/**` |
| `models/**` | `lib/db`, d'autres modèles, des helpers purs | `next/server`, `NextResponse`, `server/**`, l'UI |

---

## 7. Les règles non négociables

Reprises de `docs/LAYER_SPLIT.md` (§5) et `docs/SERVER_LAYERS.md` :

1. **Les services décident ; les dépôts lisent/écrivent.** Pas de SQL hors de
   `src/models/**`.
2. **Un service ne fait jamais de SQL** — garde-fou automatique (§8).
3. **Un nouveau dépôt n'importe jamais HTTP.**
4. **Le comportement ne change pas.** Le SQL reste identique ; les compteurs
   d'allers-retours base restent identiques.
5. **Les surfaces publiques ne font que grandir.** On laisse une façade à
   l'ancien chemin ; on la supprime quand plus personne ne l'importe.
6. **Aucune nouvelle dépendance** n'est ajoutée juste pour atteindre une couche.
7. **Faire attention à la sémantique d'erreur.** Certaines vérifications
   échouent « ouvert » volontairement (ex. une vérification de conflit qui ne
   trouve rien = « pas de conflit », pour ne jamais bloquer une inscription) et
   d'autres « fermé » (un niveau de permission illisible vaut 0, jamais un
   accord). **On garde le commentaire qui dit laquelle, et pourquoi.**

---

## 8. Les garde-fous automatiques

Ces règles ne reposent pas sur la bonne volonté : des tests les vérifient.

| Garde-fou | Fichier | Échoue quand |
|---|---|---|
| Aucun SQL dans les services | `src/__tests__/server/services-boundaries.test.js` | un service contient `db.execute` ou importe le pool |
| Aucun HTTP dans les services | le même test | un service importe `next/server` ou `NextResponse` |
| Aucun HTTP dans les nouveaux dépôts | le même test | un store importe `next/server` |
| La surface de décision survit au déplacement | le même test | un export renommé/supprimé casse le baril du service ou la façade |
| La frontière HTTP possède les refus | le même test | les refus disparaissent de `@/server/authz` ou réapparaissent dans le service |
| Aucun SQL dans `server/authz` | `src/__tests__/server/authz-boundaries.test.js` | la politique d'autorisation exécute du SQL |
| Sens des imports auth/authz | `src/__tests__/server/auth-boundaries.test.js` | un import interdit apparaît |

### Audit rapide du SQL dans les contrôleurs

```sh
grep -rnE "\.(execute|transaction|batch)\(" src/app/api --include=route.js
grep -rnE "(runSafeQuery|runQuery|safeQuery)\(" src/app/api --include=route.js
grep -rlnE "(SELECT|INSERT INTO|UPDATE [a-z_]+ SET|DELETE FROM)" src/app/api --include=route.js
```

Les deux premières doivent être **vides**. La troisième peut encore signaler
quelques cas volontaires documentés (code retiré/inaccessible, morceaux de
`WHERE` assemblés par le contrôleur, et l'endpoint de migration sanctionné).

> ⚠️ Un `grep` qui ne cherche que `db.execute` **rate** les appels répartis sur
> plusieurs lignes (`await db\n .execute(...)`) et les enveloppes maison
> (`runSafeQuery(...)`). C'est exactement l'erreur qu'a commise une première
> passe, corrigée ensuite. Utilisez les trois commandes.

---

## 9. Où en est le chantier

- Les couches sont en place et le gros du déplacement est fait : les services de
  `src/services/**` couvrent déjà `authorization`, `communications`, `contacts`,
  `email`, `finance`, `lms`, `platform`, `programs`, `projects`, `tasks`,
  `ventures`, `workspace`.
- `src/lib` ne contient plus de `db.execute` hors de `db.js` lui-même.
- Ce qui reste relève surtout de la **frontière contrôleur** (orchestration encore
  présente dans certaines routes) et du **découpage des très gros fichiers de
  vue** (purement une dette de taille, sans changement de comportement).

L'état exact, tranche par tranche, **est** `docs/LAYER_SPLIT.md` : lisez son
en-tête pour le statut, son §2 pour le journal, son §4 pour le backlog.

---

## 10. Lexique

| Terme | Ce que ça veut dire ici |
|---|---|
| **Tranche** (*slice*) | Un morceau de découpage indépendant : un module ou une route, traité seul |
| **Dépôt / store / modèle** | Le fichier qui contient le SQL, une fonction par requête (`src/models/**`) |
| **Service** | Le fichier qui **décide**, sans SQL (`src/services/**`) |
| **Contrôleur** | La route API : authentifier, valider, mettre en forme (`src/app/api/**/route.js`) |
| **Vue** | Une page ou un composant d'interface |
| **Façade** | Un fichier qui réexporte depuis un autre chemin, pour ne rien casser pendant le déménagement |
| **Baril** (*barrel*) | Un fichier qui ne fait que réexporter plusieurs modules (`index.js`) |
| **SQL identique** (*byte-identical*) | La requête est déplacée sans être réécrite, pour ne pas casser les tests |
| **Mise en forme du dépôt** | Ajouter un filtre ou choisir une colonne : ce n'est **pas** une décision, ça reste dans le dépôt |
| **Infrastructure** | Le code partagé non métier dans `src/lib/**` (base, e-mail, i18n, stockage) |

---

## 11. Erreurs fréquentes à éviter

- ❌ **Reformater ou « améliorer » le SQL** pendant le déplacement. Le test
  d'API le reconnaît par son texte : on casse le filet.
- ❌ **Laisser une décision dans le store.** S'il y a un `if` métier qui choisit
  *quoi* renvoyer, ce n'est pas du dépôt.
- ❌ **Mettre du HTTP dans un service** (`next/server`, `NextResponse`). Le
  service renvoie une *valeur* ; transformer cette valeur en réponse est le rôle
  de la frontière HTTP.
- ❌ **Supprimer une façade trop tôt.** On vérifie d'abord avec `grep`.
- ❌ **Changer le comportement sans le dire.** Les règles d'erreur ouvert/fermé
  sont volontaires : on les conserve et on garde leur commentaire.
- ❌ **Traiter deux modules à la fois.** Une tranche = un module, pour que le
  retour en arrière reste simple.

---

## 12. Checklist de fin de tranche

- [ ] Le test de comportement a été écrit **avant** et passe avant/après.
- [ ] Le SQL a été **copié à l'identique** dans le dépôt (une fonction par
      requête, nommée d'après la donnée).
- [ ] La décision vit dans `src/services/<domaine>/` et **aucun SQL** n'y reste.
- [ ] Les anciens chemins d'import fonctionnent encore (façade en place).
- [ ] `npm test` — toutes les suites vertes.
- [ ] `npx eslint .` — 0 erreur.
- [ ] `npm run build` — build vert.
- [ ] `docs/LAYER_SPLIT.md` mis à jour (journal §2 + backlog §4).

---

## 13. Pour commencer aujourd'hui

1. Lisez `docs/LAYER_SPLIT.md` §1 (la cible) et §6 (la recette).
2. Lisez `docs/SERVER_LAYERS.md` (le chemin d'une requête).
3. Prenez **une** route encore épaisse ou **un** module qui mélange décision et
   SQL, listé dans le backlog de `docs/LAYER_SPLIT.md` §4.
4. Appliquez la recette du §4 de ce guide, puis la checklist du §12.
