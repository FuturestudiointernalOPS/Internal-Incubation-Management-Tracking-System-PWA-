# Lot 8 — étape 8.3 : les routes retirées deviennent prouvables, et l'audit des identités legacy

> Date : 2026-10-20. Les quatre chemins retirés refusent désormais par **une**
> fonction, journalisent chaque appel et sortent de la dette. L'audit en lecture
> seule des identités contextuelles est écrit et exécuté — avec un fait qui
> contredit la documentation et qui interdit de conclure.

---

## 1. Routes retirées : une forme de refus, une preuve

Quatre routes étaient retirées (toujours `403`) mais chacune portait sa propre
liste de rôles et sa propre réponse :

```
src/app/api/segments/route.js
src/app/api/segments/run/route.js
src/app/api/responses/route.js
src/app/api/responses/review/route.js
```

Elles utilisent maintenant `retiredRouteResponse(feature)` (dans
`src/server/http/refusal.js`, à côté de l'unique forme de refus) qui :

- répond `403 errors.featureRetired` avec l'en-tête `X-Authz-Decision: retired` ;
- écrit **une ligne par appel** : `[retired-route] <feature> was called`.

Cette ligne est l'élément manquant pour supprimer les fichiers : la preuve
statique (`0 appelant` dans `src`) est faite, la preuve de **trafic** se
construit maintenant dans les journaux. Tant qu'elle n'est pas silencieuse sur
une période complète, les fichiers restent.

**Effet secondaire mesuré** : ces routes n'ont plus de liste de rôles (une route
retirée refuse toute identité connectée de la même façon) et sortent de la dette
via une nouvelle famille du registre, `RETIRED_ROUTES`, qui documente la
fonctionnalité, la raison et l'attente de suppression.

## 2. Audit des identités contextuelles legacy (lecture seule)

`scripts/db-audit/legacy-contextual-identities.sql` mesure, sans écrire :

1. le vocabulaire stocké (`contacts.role` × `status`) ;
2. chaque valeur legacy (`participant`, `facilitator`, `investor`, `founder`)
   face à son **profil équivalent** (`profile_assignments` actif) — combien de
   personnes seraient couvertes, combien perdraient leur surface ;
3. les sessions vivantes qui portent encore une valeur retirée ;
4. les participants sans relation de programme (preuve que `participant` est
   déjà le rôle par défaut, donc que son retrait ne change rien pour eux).

### Résultat observé (2026-10-20, `.env.local`)

| Valeur | Contacts |
|---|---:|
| `staff` (actif) | 4 |
| `applicant` | 3 (2 actifs, 1 approuvé) |
| `member` | 2 (1 actif, 1 inactif) |
| `super_admin` (actif) | 1 |

- **Aucune ligne** ne porte une identité contextuelle legacy (requêtes 2 et 3 :
  0 ligne).
- 0 participant, donc la requête 4 confirme un plafond à zéro.
- Total : **9 contacts**.

### ⚠ Le fait qui contredit la documentation

`AGENTS.md` §7 affirme (vérifié le 2026-10-11) que `.env.local` pointe la
**production** : **588 contacts**. La même base répond aujourd'hui **9
contacts**. Les deux descriptions ne peuvent pas être vraies : soit `.env.local`
a été repointé depuis, soit la base a été nettoyée. `.env.audit-staging` et
`.env.audit-readonly` n'existent pas dans cette copie de travail.

Conséquence, et c'est la raison de ne rien changer ici :

> **la population de production n'est pas vérifiée.** Un zéro observé sur une
> base à 9 contacts ne prouve rien pour une base à 588. Retirer `participant`,
> `facilitator`, `investor` et `founder` du calcul de connexion reste bloqué
> jusqu'à ce que l'audit tourne sur la base effectivement ciblée.

C'est une **décision d'exécution** (quelle base ?) avant toute migration de
données, pas un choix technique.

## 3. Compteurs

| Indicateur | Avant 8.3 | Après 8.3 |
|---|---:|---:|
| Actions en dette | 60 | **56** |
| Liste de travail (actions sans capacité) | 125 | **121** |
| Listes de rôles en dur dans les actions | 73 | **68** |
| Comparaisons de rôle hors moteur | 299 | **294** |
| Exceptions figées du garde-fou rôles | 186 | **182** |

## 4. Tests

- `retired-routes.test.js` → 2 tests (forme de refus unique + journal par appel).
- `action-declarations.test.js` → 12 tests, dont « une route retirée refuse tout
  le monde et quitte la dette ».
- `npm run test:authz` → **10 suites / 68 tests** verts (route retirées incluse).
- `npm run lint` → 0 erreur, avertissements inchangés (261).
- Les 17 suites en échec restent **préexistantes** (vérifiées sur `HEAD` propre).

## 5. Retour arrière

`git revert`. Aucune écriture en base ; l'audit SQL est en lecture seule et ne
fait qu'un `SELECT`.

## 6. Compte rendu

```
LOT 8 — Supprimer les chemins morts — étape 8.3
Fait :
  - retiredRouteResponse : un seul refus 403 + une ligne de journal par appel
  - les 4 routes retirées perdent leur liste de rôles
  - famille RETIRED_ROUTES au registre ; elles sortent de la dette
  - audit lecture seule des identités contextuelles legacy (+ SQL versionné)
Compteurs : dette 60 -> 56 ; liste de travail 125 -> 121 ; listes de rôles
  73 -> 68 ; comparaisons 299 -> 294 ; exceptions 186 -> 182.
Divergences : la base joignable par `.env.local` contient 9 contacts, pas les
  588 documentés — la population de production n'est donc PAS vérifiée, et le
  retrait des identités legacy reste bloqué.
Tests : 10 suites / 68 tests authz verts. Lint 0 erreur.
Décisions requises : quelle base auditer pour la migration des identités.
Retour arrière : git revert.
Prochaine étape : laisser le journal des routes retirées tourner, puis les
  supprimer ; exécuter l'audit legacy sur la base de production confirmée.
```
