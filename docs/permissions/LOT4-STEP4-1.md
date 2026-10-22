# Lot 4 — étape 4.1 : un registre déclaratif des actions

> Date : 2026-10-20. Objectif : chaque action déclare ce qu'elle exige, et la
> dette devient un cliquet — une action non déclarée fait échouer la CI.

---

## 1. La déclaration

Trois formes, et une seule question : « sur quoi cette action s'appuie-t-elle ? »

| Forme | Signification | Preuve attendue |
|---|---|---|
| **capacité** | l'action appelle un mécanisme de décision (capacité, périmètre, ou les deux) | le mécanisme est dans le fichier |
| **personnelle** | ouverte à tout utilisateur connecté, bornée à ses propres données | entrée déclarée avec sa portée et sa raison |
| **ouverte** | publique par conception, gardée par secret, hub ou impasse documentée | entrée déclarée avec son type et sa raison |

Une action qui n'est aucune des trois est **en dette** : elle a un contrôle de
session ou de rôle, mais aucune déclaration de capacité. C'est la liste de
travail de l'étape 4.2.

Les deux ensembles qui vivaient dans le test de garde (`ROUTE_HUBS`,
`NO_GUARD_ALLOWED`) ont rejoint le registre : un seul endroit répond désormais
de la politique, et le tableau de bord lit ce registre au lieu de parser un
fichier de test.

---

## 2. L'état mesuré

| Catégorie | Actions |
|---|---:|
| Appellent un mécanisme de décision | **249** |
| Déclarées personnelles | 32 |
| Déclarées ouvertes (hub / impasse / public) | 2 + 6 hors liste de travail |
| **En dette — à protéger** | **137** |
| **En dette — décision déléguée à vérifier** | **22** |
| **Total en dette** | **159** |

Les 159 sont figées dans `src/services/authorization/actionDebt.js`, avec leur
catégorie. Le fichier est généré :

```bash
node scripts/authz-action-debt.mjs --write
```

mais il ne peut que **rétrécir** : le test compare la dette figée au balayage
réel dans les deux sens.

---

## 3. Le cliquet, prouvé

Une route temporaire a été ajoutée (session seule, aucune capacité) : le test a
échoué en la nommant. La route a été supprimée, le test est revenu vert.

Le test vérifie aussi :

- que chaque déclaration personnelle porte une portée et une raison ;
- que chaque déclaration ouverte porte un type connu et une raison ;
- qu'aucune action n'est déclarée sous deux formes ;
- que toute action déclarée existe encore ;
- que la liste de dette ne contient que les deux catégories de dette ;
- qu'aucune action n'est à la fois déclarée et en dette.

---

## 4. Compteurs

| Indicateur | Avant 4.1 | Après 4.1 |
|---|---:|---:|
| Actions avec décision de capacité | 249 | **249** |
| Actions déclarées personnelles / ouvertes | 32 / 2 | **32 / 2** (+6 lisibles dans le registre) |
| Actions en dette, figées | 0 (implicite) | **159** explicites |
| Sources de la politique (registre + test) | 2 | **1** |
| Actions nouvelles non déclarées tolérées | oui | **non** |

Aucune réponse ne change : cette étape déclare et mesure, elle ne protège encore
rien de plus.

---

## 5. Tests

- `action-declarations` (nouveau) : les 9 assertions ci-dessus.
- `permissions-static-guards` mis à jour pour lire le registre.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.1
Fait :
  - schéma de déclaration à trois formes (capacité / personnelle / ouverte)
  - hubs et impasses déplacés du test vers le registre
  - dette figée : 159 actions (137 à protéger, 22 déléguées à vérifier)
  - générateur de la dette et cliquet prouvé par une route sonde
Compteurs :
  - actions avec capacité : 249 (inchangé)
  - dette explicite : 159
  - sources de la politique : 2 -> 1
Tests ajoutés / passants : 9 tests de registre ; cliquet respecté.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : étape 4.2, premier lot de 20 actions « à protéger » (écriture,
  suppression, données personnelles d'abord), avec test d'un utilisateur non
  autorisé pour chacune.
```
