# Lot 2 — étape 2.3 : des refus honnêtes

> Date : 2026-10-20. Décision D-6, option 1 : dire la vraie raison. Un refus de
> droit ne s'habille plus en « introuvable », sauf choix d'anti-énumération
> documenté.

---

## 1. Le problème mesuré

L'ancien contrôle d'accès venture répondait la même chose — « pas de session » —
dans trois situations différentes, et les routes traduisaient cela en **404
« introuvable »** :

| Situation réelle | Ancienne réponse | Réponse cible |
|---|---|---|
| Personne non connectée | 404 | **401** |
| Venture inexistante | 404 | **404** (seul cas légitime) |
| Venture existante, accès refusé | 404 | **403** + raison `out-of-scope` |

Conséquence : le support recevait « ça n'existe pas » pour un problème de droits,
et la personne concernée n'avait aucun moyen de savoir qu'elle devait demander
un accès.

---

## 2. Ce qui a changé

Le contrôle d'accès rend maintenant une **raison stable** en plus de la session :

- `unauthenticated`, `not-found`, `out-of-scope`.

Un traducteur unique (`ventureAccessRefusal`) transforme cette raison en
réponse, avec la même forme de refus que le reste du système :

| Raison | Statut | Corps | En-tête |
|---|---:|---|---|
| `unauthenticated` | 401 | `errors.authRequired` | `unauthenticated` |
| `not-found` | 404 | `errors.ventureNotFound` | `not-found` |
| `out-of-scope` | 403 | `errors.insufficientPermissions` + `{ scope: "venture_own" }` | `out-of-scope` |

**38 sites de refus** dans **24 fichiers** utilisent ce traducteur.

Six autres refus de droit qui répondaient 404 ont été corrigés en 403 :

- liste des notes internes (droit de consultation) ;
- liste et mutation des membres de la venture (accès et droit de mutation) ;
- fiche d'un fondateur ;
- historique de la venture ;
- invitations de membres ;
- types de documents (le dernier appelant qui construisait encore son 404).

---

## 3. Les 404 qui restent, et pourquoi

Un 404 ne subsiste que dans deux cas :

1. **La ressource n'existe réellement pas** (venture, document, jalon, plan
   introuvable).
2. **Anti-énumération assumée et documentée** : le moteur de plans
   opérationnels reste invisible aux fondateurs. Ce choix est écrit dans le
   service qui le porte ; il n'est pas étendu aux autres ressources.

Aucune autre permission n'est masquée.

---

## 4. Compteurs

| Indicateur | Avant 2.3 | Après 2.3 |
|---|---:|---:|
| Refus de droit rendus en « introuvable » (appelants de l'ancien contrôle) | 38 | **0** |
| Refus de droit supplémentaires masqués en 404 (notes, membres, fondateurs, historique, invitations, types de documents) | 6 | **0** |
| Issues distinctes produites par le contrôle venture | 1 | **3** (401 / 403 / 404) |
| Sites utilisant le traducteur unique | 0 | **38** |

---

## 5. Tests

- `src/__tests__/venture-access-reasons.test.js` (nouveau) : les trois raisons et
  les trois formes de refus, y compris le repli sûr sur `out-of-scope`.
- Adaptés : `verification-upload`, `venture-document-types-api`,
  `member-invite-api`, `staging-venture-progression`.
- `npm run test:authz` → 7 suites / 54 tests verts.
- Périmètre élargi (tâches, ventures, sécurité lots 1→14, phases, présence,
  revues facilitateur) → **1318 tests verts**.
- 7 suites venture échouent **déjà sur `HEAD`** (vérifié en worktree propre) :
  mocks de requêtes, sans rapport.
- `npm run lint` → 0 erreur.
- Cliquet des permissions respecté.

---

## 6. Retour arrière

`git revert` du commit. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 2 — Une seule décision, une seule forme de refus — étape 2.3
Fait :
  - le contrôle venture distingue non connecté / inexistant / hors périmètre
  - traducteur unique de la raison vers la réponse (401 / 404 / 403)
  - 38 sites migrés dans 24 fichiers
  - 6 refus de droit qui répondaient 404 répondent maintenant 403
  - les 404 restants sont soit réels, soit un choix d'anti-énumération documenté
Compteurs :
  - refus masqués en 404 : 44 -> 0
  - issues distinctes du contrôle venture : 1 -> 3
  - sites utilisant le traducteur : 0 -> 38
Tests ajoutés / passants : 1 suite dédiée ; 1318 verts sur le périmètre élargi.
Décisions requises : aucune (D-6 tranchée).
Retour arrière : git revert.
Prochaine étape : étape 2.4 (point d'entrée unifié, D-3 « adopter la forme »).
```
