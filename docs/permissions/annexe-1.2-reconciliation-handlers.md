# Annexe 1.2 — Réconciliation des comptages de handlers

> Phase 0 complémentaire. Lecture seule. Méthode : énumération statique des
> fichiers de route (`scratch/scan_handlers.py`, outil d'audit, retiré du code
> applicatif) + `grep`. Aucune hypothèse : chaque chiffre est reproductible.

## 1. Chiffres mesurés

| Mesure | Valeur | Méthode |
|---|---:|---|
| Fichiers `route.js` sous `src/app/api` | **435** | `find src/app/api -name route.js` |
| Méthodes HTTP exportées **dans les `route.js`** | **751** | `= 512 (function) + 236 (const) + 3 (export {…})` |
| Exports de handlers **hors `route.js`** (modules internes) | **23** | `platform/form-runs/handlers/**` |
| Total des **occurrences** de handlers sous `src/app/api` | **771** | 512 + 23 + 236 = 771 (fonctions) ; les 3 accolades s'ajoutent si on compte 751) |

## 2. Décomposition exacte des trois nombres

### 2.1 Le « 771 » de la première mesure

Il provenait de `grep -rhoE "export (async )?function (GET|POST|…)" src/app/api`
— une recherche sur **tous les fichiers** sous `src/app/api`, pas seulement les
`route.js`. Il additionne :

- **512** méthodes sous forme `export [async] function` dans les 435 `route.js` ;
- **23** exports de la même forme dans des **modules internes** :
  `src/app/api/platform/form-runs/handlers/*.js` (voir §3) ;
- soit **535** occurrences de la forme `function` ;
- plus **236** occurrences de la forme `export const …` (toutes dans des `route.js`).

Total brut : 535 + 236 = **771**. Ce n'est donc **pas** le nombre de handlers de
route : il inclut 23 modules internes.

### 2.2 Le « 748 » de l'inventaire D

L'inventaire D a compté les formes `function` et `const` **dans les `route.js`** :
512 + 236 = **748**. Il est donc exact pour ces deux formes, mais il **omet les
3 exports par accolades** (voir §2.3).

### 2.3 Le nombre autoritaire de handlers de route

**751** = 748 (inventaire D) + **3** ré-exports par accolades dans
`src/app/api/platform/form-runs/route.js:102` :

```js
export { GET, PUT, DELETE };
```

Ce fichier est un **hub de dispatch** : il définit `POST` (fonction, la sous-action
`action=…`) et ré-exporte `GET`, `PUT`, `DELETE` (importés des modules de `handlers/`).
L'inventaire D n'a listé que `POST` pour cette route : **3 méthodes de route lui
échappent** (`GET`, `PUT`, `DELETE`).

## 3. Les 23 modules internes hors `route.js`

Fichiers (tous sous `src/app/api/platform/form-runs/handlers/`) :

| Forme | Fichiers |
|---|---|
| Collection | `get.js`, `put.js`, `delete.js` |
| Sous-actions POST | `post/create.js`, `post/review.js`, `post/submit.js`, `post/assign.js`, `post/unassign.js`, `post/launch.js`, `post/status.js`, `post/bulk_review.js`, `post/delete_submission.js`, `post/manual_add.js`, `post/mark_email_cancelled.js`, `post/preview_result.js`, `post/regenerate_link.js`, `post/regenerate_report.js`, `post/retry_emails.js`, `post/send_activation_messages.js`, `post/send_result_emails.js`, `post/send_manual_message.js`, `post/dispatch_scheduled_result_emails.js`, `post/update_respondent_email.js` |

**Ce ne sont pas des routes.** Ce sont des modules de handler importés par le hub
`platform/form-runs/route.js`. Pour l'inventaire des *actions exposées*, ils
représentent 20 sous-actions d'écriture (dispatchées) + 3 handlers de collection ;
l'inventaire D les a traités comme **une seule entrée « hub »** (voir son
incertitude dédiée). C'est un choix de comptage, pas un oubli.

## 4. Réconciliation finale — aucune route manquante

| Cause d'écart | Explication | Statut |
|---|---|---|
| 771 → 751 | 23 exports en `handlers/**` (modules, pas routes) + 3 ré-exports (non comptés par la première mesure) | Expliqué |
| 748 → 751 | 3 ré-exports `export { GET, PUT, DELETE }` dans le hub `form-runs` | Corrigé (inventaire D à compléter) |
| 535 (fonction, tous fichiers) → 512 (fonction, routes) | 23 modules internes | Expliqué |
| 236 (const) identique dans les deux mesures | Tous les `export const GET…` sont dans des `route.js` | Cohérent |

**Conclusion** : il n'existe **ni route non inventoriée, ni doublon, ni faux
positif de route**. L'écart est purement un écart de **périmètre de comptage**
(modules internes vs fichiers de route) et de **formes d'export** (accolades).

## 5. Incertitudes

- Les ré-exports par accolades au-delà de `form-runs` : la détection `export {…}`
  n'a repéré que ce fichier. Une forme plus rare (`export { handler as GET }`) est
  couverte par le script (`split(" as ")`) ; aucune autre occurrence trouvée.
- Certains `route.js` peuvent exporter des helpers (hors méthodes HTTP) ; ils ne
  sont pas comptés comme handlers, ce qui est correct.
