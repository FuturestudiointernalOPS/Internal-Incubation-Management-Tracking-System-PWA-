# Lot 1 — étape 1.5 : une seule liste de vocabulaire

> Date : 2026-10-19. Objectif : aucune des listes de rôles/profils n'est écrite
> à la main. Le vocabulaire vient d'une seule source.

---

## 1. Ce qui a changé

### 1.1 Un vocabulaire unique dans la couche d'identité

`src/lib/identity.js` expose maintenant :

- `BASELINE_IDENTITIES` — les **3 identités de base** ;
- `ENTITY_IDENTITIES` — `team`, une connexion d'entité (pas un rôle de personne) ;
- `LEGACY_CONTEXTUAL_IDENTITIES` — les 4 valeurs contextuelles encore acceptées
  à la connexion tant que les sites de décision les lisent ;
- `LOGIN_IDENTITIES` — l'union dérivée des trois listes précédentes.

Le résolveur de connexion ne recopie plus ces valeurs : il les importe.

### 1.2 La liste de l'écran d'accès historique est dérivée

`src/lib/featureAccess.js` ne contient plus les dix rôles écrits à la main :

```js
export const ALL_FEATURE_ROLES = [...BASELINE_IDENTITIES];       // 3
export const ALL_FEATURE_PROFILES = [...PROFILE_KEYS];           // 8
export const ALL_FEATURE_IDENTITIES = [                           // 3 + 8
  ...BASELINE_IDENTITIES,
  ...PROFILE_KEYS,
];
```

Les profils viennent du catalogue de profils, les rôles des identités de base.
Aucune des deux listes n'est plus maintenue séparément.

### 1.3 Ce qui n'est pas encore réduit

Le calcul de connexion produit encore **8 valeurs** :

- 3 identités de base ;
- 1 connexion d'entité (`team`) ;
- 4 valeurs contextuelles historiques (`participant`, `facilitator`, `investor`,
  `founder`).

Ces 4 valeurs sont maintenant **déclarées comme dette** dans un seul endroit
(`LEGACY_CONTEXTUAL_IDENTITIES`) et comptées par le tableau de bord. Les
supprimer maintenant casserait les nombreux sites de décision qui lisent encore
le libellé contextuel. La migration se fait donc en deux temps :

1. **cette étape** : une seule source, une liste d'écran réduite à 3 ;
2. **lot contextuel** : migrer les 76 décisions restantes qui lisent un libellé,
   puis retirer les 4 valeurs de `LEGACY_CONTEXTUAL_IDENTITIES`.

Le critère « 3 identités » du plan est donc **partiellement atteint** : la liste
de l'écran est à 3, la liste de connexion est encore à 8 pour compatibilité.

---

## 2. Compteurs

| Indicateur | Avant | Après |
|---|---:|---:|
| Rôles de l'écran d'accès historique | 10 | **3** |
| Fonctions du catalogue de profils | 8 | **8** (source) |
| Valeurs produites par la connexion | 9 | **8** |
| dont valeurs contextuelles/entité legacy | — | **5** |
| Décisions qui lisent encore le libellé `program_manager` | 76 | **76** |
| Comparaisons de rôle hors moteur | 462 | **462** |
| Exceptions figées du garde-fou | 282 | **282** |
| Nouvelles occurrences / exceptions périmées | 0 / 0 | **0 / 0** |

---

## 3. Tests

- `npm run test:authz` → **7 suites, 54 tests verts**
- Suites ciblées complémentaires → **21 suites, 267 tests verts**
- `npm run authz:metrics:check` → **cliquet respecté**
- `npm run lint` → **0 erreur**
- Nouveau test de vocabulaire : `ALL_FEATURE_ROLES` = 3 identités,
  `ALL_FEATURE_PROFILES` = clés du catalogue, les profils ne deviennent jamais
  des toggles de rôle.

---

## 4. Retour arrière

- Aucun changement de décision d'accès : les valeurs de connexion et les
  décisions restent identiques.
- `git revert` du commit ; aucune écriture en base.

---

## 5. Compte rendu

```
LOT 1 — Un seul vocabulaire de rôle — étape 1.5
Fait :
  - vocabulaire d'identité unique (3 bases + 1 entité + 4 contextuels legacy)
  - liste de l'écran d'accès historique dérivée : 10 → 3
  - liste des profils dérivée du catalogue : 8 clés
  - résolveur de connexion branché sur le vocabulaire
  - les valeurs contextuelles restantes sont comptées comme dette
Compteurs :
  - rôles de l'écran : 10 → 3
  - valeurs de connexion : 8 (dont 5 legacy/entité)
  - comparaisons de rôle : 462 (inchangé)
  - exceptions figées : 282 (0 nouvelle, 0 périmée)
Divergences en mode ombre : aucune règle d'accès modifiée.
Tests ajoutés / passants : test:authz 7 suites / 54 tests ; 21 suites / 267 tests.
Décisions requises : aucune.
Retour arrière : git revert ; aucune écriture en base.
Prochaine étape : Lot 2 — une seule décision, une seule forme de refus.
  La suppression des 4 valeurs contextuelles reste un lot dédié (76 décisions
  de libellé à migrer).
```
