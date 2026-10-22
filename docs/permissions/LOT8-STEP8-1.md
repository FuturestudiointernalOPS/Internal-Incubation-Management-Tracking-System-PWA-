# Lot 8 — étape 8.1 : premier chemin mort supprimé

> Date : 2026-10-20. L'ancien contrôle d'appartenance venture est supprimé
> (0 appelant), avec son helper de refus et le test qui ne testait que lui. Le
> cache de faits qu'il lisait reste, et son test est réécrit sur les fonctions
> encore utilisées.

---

## 1. La preuve avant la suppression

| Élément | Preuve |
|---|---|
| `requireVentureAccess` | **0 appelant** dans `src/app` et `src/services` (grep + census venture : 0 fichier sur l'ancien contrôle) |
| `ventureAccessRefusal` | **0 appelant** (il ne servait qu'aux routes sur l'ancien contrôle) |
| `ventureAccessFacts` | **0 appelant** (seul `requireVentureAccess` l'utilisait) |
| `venture-access-reasons.test.js` | ne testait **que** `requireVentureAccess` |

Le remplacement est déjà en place et testé : `requireVentureScopedAccess`
(capacité + périmètre) sur les 104 appels venture.

---

## 2. Ce qui a été supprimé

- `requireVentureAccess` (et son JSDoc) dans `src/lib/ventureAuth.js` ;
- `ventureAccessFacts` dans `src/services/ventures/accessFacts.js` ;
- `ventureAccessRefusal` dans `src/server/http/refusal.js` ;
- `src/__tests__/venture-access-reasons.test.js` (le test de l'ancienne porte) ;
- les commentaires qui citaient l'ancienne porte (périmètre, backfill programme,
  revue de livrables).

## 3. Ce qui reste, et pourquoi

**`getVentureFacts` / `getViewerRelationship` restent** : ce sont les faits
partagés (faits de la venture + relation du lecteur) que lisent encore
`resolveVentureLifecycle`, `hasActiveVentureAssignment` et
`requireOperationalVentureAccess`. Leur cache est toujours utile : une page qui
ouvre quatre onglets ne paie pas quatre fois la même lecture.

`src/__tests__/venture-access-cache.test.js` est **réécrit** sur ces fonctions :
mêmes garanties (une seule requête partagée, parallélisme, échec non mémorisé,
fenêtre, invalidation), sans l'ancienne porte.

### Le point d'entrée unifié (`requireScopedAccess`)

Il n'a **aucune action** qui l'appelle, mais il n'est pas du « poids mort » : il
est l'implémentation de référence de la **forme adoptée en D-3** (« adopter la
forme »), couverte par `context-access.test.js` et
`permissions-scoped-reason.test.js`. Les routes appellent les gardes de domaine
(`requireVentureScopedAccess`, `requireProgramScope`) qui réalisent la même
forme. Le supprimer reviendrait à supprimer l'unification, pas un vestige ; il
est donc conservé. Si sa suppression est souhaitée, c'est une décision explicite
distincte.

---

## 4. Un écart documenté (D-6)

L'ancienne porte distinguait `not-found` (404) de `out-of-scope` (403). Le garde
unifié répond `out-of-scope` dans les deux cas. Ce n'est pas une régression
introduite ici (les routes ont migré au Lot 5), mais c'est désormais **sans
repli** : restaurer le 404 pour une venture réellement absente demande de faire
porter `not-found` au verdict unifié. À traiter comme une décision produit
(anti-énumération vs raison honnête), pas dans une suppression de code mort.

---

## 5. Compteurs

| Indicateur | Avant 8.1 | Après 8.1 |
|---|---:|---:|
| Appels à l'ancien contrôle venture | 0 | **0** |
| Appels au contrôle venture complet | 112 | **112** |
| Actions en dette | 60 | **60** |
| Exceptions figées du garde-fou étendu | 23 | **22** |
| Fichiers de test | 914 | **913** (–1, test de l'ancienne porte) |

---

## 6. Tests

- `venture-access-cache` réécrit : **11 tests verts**.
- Ensemble `venture*` : **78 suites / 889 tests verts**, aux **7 suites
  préexistantes près** (13 tests, inchangées).
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 7. Retour arrière

`git revert`. Aucune écriture en base.

---

## 8. Compte rendu

```
LOT 8 — Supprimer les chemins morts — étape 8.1
Fait :
  - requireVentureAccess, ventureAccessFacts et ventureAccessRefusal supprimés
  - le test de l'ancienne porte supprimé
  - le test du cache réécrit sur les faits partagés encore utilisés
Compteurs : dette inchangée (60), exceptions étendues 23 -> 22.
Divergences : D-6 (404 pour une venture absente) n'est plus porté par aucun
  code ; documenté pour une décision produit.
Tests ajoutés / passants : 11 tests de cache + 889 tests venture + 54 authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : les routes retirées (segments, responses) exigent une preuve
  de trafic ; LEGACY_CONTEXTUAL_IDENTITIES exige une migration de données.
```
