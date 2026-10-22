# Lot 8 — étape 8.4 : D-6, dire la vraie raison

> Date : 2026-10-20. Une venture qui n'existe pas répond `404`. Une venture qui
> existe mais n'est pas la vôtre continue de répondre `403`. La porte venture
> distingue enfin les deux, sur décision produit (D-6, option 1).

---

## 1. L'écart

Depuis le Lot 5, `requireVentureScopedAccess` répondait `out-of-scope` dans les
deux cas :

```
GET /api/ventures/VNT-INEXISTANT/...   →  403 out-of-scope
GET /api/ventures/VNT-AUTRUI/...       →  403 out-of-scope
```

L'ancienne porte répondait `404` au premier. L'écart n'était pas une régression
de sécurité (refuser reste sûr), mais une information perdue : le client ne
pouvait pas distinguer « votre lien est faux » de « ce n'est pas le vôtre ».

## 2. La correction

`ventureExists(id)` (modèle → service) répond par un booléen, sans lire le
contenu de l'enregistrement. La décision l'interroge **uniquement sur le chemin
de refus** :

```
capability-missing  → 403   (inchangé)
out-of-scope        → 403   (la venture existe)
not-found           → 404   errors.notFound   (nouveau)
```

Coût : une lecture supplémentaire seulement quand la porte allait refuser. Une
requête autorisée ne paie rien (test dédié).

Une erreur de lecture renvoie `false` côté service ; la porte répond alors
`403 out-of-scope`. Une panne d'infrastructure ne devient **jamais** un `404`
confiant.

`GET /api/ventures/[id]/my-access` prouvait déjà l'existence avant de répondre ;
il reste inchangé et cohérent.

## 3. Le compromis, assumé

Une identité **authentifiée** peut désormais distinguer « absente » de « pas la
vôtre » en comparant les codes HTTP. C'est exactement l'option 1 retenue : la
raison honnête plutôt que l'anti-énumération. Le prix est borné — il faut déjà
être connecté, et la réponse ne révèle rien du contenu.

Si l'anti-énumération redevenait prioritaire, la bascule est un seul `case` dans
`requireVentureScopedAccess` (renvoyer 403 pour `not-found`) — c'est pourquoi la
décision reste nommée dans le verdict (`decision: "not-found"`) et non fondue
dans le refus.

## 4. Compteurs

| Indicateur | Avant 8.4 | Après 8.4 |
|---|---:|---|
| Actions en dette | 56 | 56 |
| Comparaisons de rôle hors moteur | 294 | 294 |
| Exceptions figées | 182 | 182 |
| Appels au contrôle venture complet | 112 | 112 |

Aucun compteur de dette ne bouge : cette étape corrige une réponse, pas une
règle d'accès.

## 5. Tests

- `phase5b-venture-pilot` → 2 tests ajoutés : `404 + X-Authz-Decision: not-found`
  pour une venture absente ; la lecture d'existence n'est pas appelée quand la
  porte autorise.
- Les `jest.mock` des suites venture déclarent `ventureExists` (par défaut
  `true`, donc les refus restent `403`).
- `ventures/` → 24 suites vertes, aux **5 suites préexistantes** près (`api`,
  `lead`, `ventures`, `staff-actor`, `templates`).
- `npm run test:authz` → 10 suites / 68 tests verts ; cliquet respecté.
- `npm run lint` → 0 erreur.

## 6. Retour arrière

`git revert`. La décision `not-found` disparaît avec le `case` ; toutes les
routes retrouvent `403 out-of-scope`. Aucune écriture en base.

## 7. Compte rendu

```
LOT 8 — D-6, dire la vraie raison — étape 8.4
Fait :
  - ventureExists (modèle + service), booléen sans lecture de contenu
  - la décision distingue not-found (404) de out-of-scope (403)
  - la lecture d'existence ne tourne que sur le chemin de refus
Compteurs : inchangés (56 dette, 294 comparaisons, 182 exceptions).
Divergences : une identité connectée peut énumérer l'existence d'une venture —
  compromis explicite de l'option 1, réversible en un case.
Tests : 2 ajoutés, 24 suites venture vertes (5 préexistantes en échec).
Décisions requises : aucune (D-6 tranchée).
Retour arrière : git revert.
Prochaine étape : laisser le journal des routes retirées tourner ; exécuter
  l'audit legacy sur la base de production confirmée.
```
