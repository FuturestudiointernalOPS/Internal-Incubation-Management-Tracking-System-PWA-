# Lot 5 — étape 5.1 : un seul contrôle venture (les lectures)

> Date : 2026-10-20. Sur les 38 appels à l'ancien contrôle d'appartenance,
> **18 lectures** passent au contrôle venture complet (capacité + périmètre).
> Les 20 écritures attendent une décision produit (D-7).

---

## 1. Ce qui a changé

Les routes suivantes appelaient `requireVentureAccess(id)` — l'appartenance
seule, sans capacité. Elles appellent désormais
`requireVentureScopedAccess({ ventureId, module: "ventures", capability: "view" })` :

| Surface | Méthode |
|---|---|
| `advisors` | GET |
| `analytics` | GET |
| `coaching` | GET |
| `deliverables` | GET |
| `document-types` | GET |
| `documents/[docId]/permissions` | GET |
| `documents/[docId]/reviews` | GET |
| `documents/[docId]/versions` | GET |
| `feedback` | GET |
| `founders` | GET |
| `fundraising` | GET |
| `investment` | GET |
| `investors` | GET |
| `journey` | GET |
| `journey-report` | GET |
| `progress` | GET |
| `submissions/review-queue` | GET |
| `tasks/[taskId]/submissions` | GET |

Le contrôle complet ajoute la **capacité** (`ventures.view`) au périmètre
`venture_own` qu'évaluait déjà l'ancien contrôle. La réponse d'un refus est
désormais celle du garde unifié : `capability-missing` ou `out-of-scope`.

---

## 2. Pourquoi les lectures d'abord (mode ombre)

La mesure a été faite en lecture seule sur la production avant la bascule,
en reproduisant la résolution du moteur (profil de base = surcharge du contact,
sinon profil par défaut du rôle, plus les octrois individuels et de groupe,
moins les restrictions) :

| Population attachée à une venture | Relations | Sans `ventures.view` | Sans `ventures.edit` |
|---|---:|---:|---:|
| `member` (profil `venture_member`) | 1 | **0** | **1** |
| `staff` (profil `staff_default`) | 2 | 0 | 0 |

Conclusion : **aucune divergence sur les lectures** — tous les membres actifs
portent `ventures.view`. En revanche, un membre sur un ne porte pas
`ventures.edit` : c'est la divergence des écritures, et elle est une décision
produit (D-7), pas un choix technique.

---

## 3. Cas laissés sur l'ancien contrôle, à dessein

- Les **18 écritures** (POST/PATCH/DELETE : conseillers, coaching, retours,
  documents, levée, investissement, investisseurs, téléversements, soumissions,
  transitions) attendent D-7.
- `GET /api/ventures/[id]/documents` et `GET /api/ventures/[id]/reports` :
  ils portent la **consultation historique en lecture seule** (D1 — un ancien
  gestionnaire garde l'accès). Le garde unifié refuse avant ce repli ; ils
  demandent un traitement dédié (décision + test) plutôt qu'un remplacement
  mécanique.

---

## 4. Compteurs

| Indicateur | Avant 5.1 | Après 5.1 |
|---|---:|---:|
| Appels au contrôle venture complet | 66 | **84** |
| Appels à l'ancien contrôle d'appartenance | 38 | **20** |
| Fichiers encore sur l'ancien contrôle (census) | 29 | **12** |
| Fichiers sur le nouveau système (census) | 36 | **53** |
| Actions en dette | 85 | **69** |
| Actions sans capacité (liste de travail) | 150 | **134** |
| dont « à vérifier — décision déléguée » | 22 | **6** |
| Exceptions figées du garde-fou étendu | 48 | **41** |
| Nouvelles occurrences non listées / périmées | 0 / 0 | **0 / 0** |

La liste de travail baisse de 16 : les fichiers migrés portent maintenant un
mécanisme de capacité visible, ils quittent donc la catégorie « décision
déléguée ».

---

## 5. Tests

Mocks alignés sur le déplacement de la porte (le garde scoped remplace le garde
d'appartenance sur les lectures) :

- `venture-progress`, `venture-document-types-api`, `ventures/submissions`,
  `venture-journey-gating`, `venture-scope-gating`, `venture-readiness-report`.
- `phase5b-venture-pilot` : la garde de régression accepte une déstructuration
  plus large (`{ id, docId }`, `{ id, taskId }`) — le point vérifié reste que
  `id` soit déclaré avant la porte.
- `permissions-role-gates-extended` : sept exceptions `M9` devenues périmées
  retirées.

Résultat : **79 suites / 900 tests verts** sur l'ensemble `venture*`, aux
**7 suites préexistantes près** (`ventures/api`, `ventures/lead`,
`ventures/ventures`, `venture-company-status`, `venture-document-types`,
`ventures/staff-actor`, `ventures/templates` — 13 tests, identifiés comme
préexistants avant ce lot).

- `npm run test:authz` → 7 suites / 54 tests verts.
- `action-declarations` → 10 tests verts ; dette régénérée (85 → 69).
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 6. Décision requise — D-7

**Contexte.** Le contrôle complet exige `ventures.edit` pour écrire. Le profil
`venture_member` (profil par défaut du rôle `member`) ne porte que
`ventures.view`. Aujourd'hui, l'ancien contrôle laisse **tout membre actif**
écrire dans sa venture.

**Options.**

| # | Option | Effet |
|---|---|---|
| A | Ajouter `ventures.edit` au profil `venture_member` (migration one-shot) | Comportement identique à aujourd'hui ; le périmètre `venture_own` borne toujours l'écriture à ses propres ventures. **Recommandé.** |
| B | Assigner le profil `founder` à la place, au niveau de base, aux seuls propriétaires | Les simples membres d'équipe passent en lecture seule — resserrement volontaire. |
| C | Laisser les 18 écritures sur l'ancien contrôle | Statu quo ; la dette venture reste à 20. |

**Défaut recommandé : A.** Il préserve exactement l'accès actuel, ne crée aucune
divergence, et rend la capacité attribuable sans changer le code. L'option B est
un changement de règle qui mérite d'être choisi explicitement.

---

## 7. Retour arrière

`git revert`. Aucune écriture en base, aucune migration.

---

## 8. Compte rendu

```
LOT 5 — Un seul contrôle venture — étape 5.1 (lectures)
Fait :
  - 18 lectures passent de l'appartenance seule à capacité + périmètre
  - 2 lectures historiques (documents, reports) documentées et laissées
  - 6 suites de tests alignées sur la nouvelle porte
  - 7 exceptions M9 périmées retirées
Compteurs :
  - contrôle complet : 66 -> 84
  - ancien contrôle : 38 -> 20
  - census legacy : 29 -> 12 fichiers
  - dette : 85 -> 69 ; liste de travail : 150 -> 134
  - exceptions étendues : 48 -> 41
  - accès retirés pour une personne réelle : 0
Divergences en mode ombre : 0 sur les lectures (mesure production) ;
  1 divergence identifiée sur les écritures (D-7).
Tests ajoutés / passants : 79 suites / 900 tests venture verts (7 suites
  préexistantes rouges, inchangées) + 54 tests authz.
Décisions requises : D-7 — source du droit d'écriture venture.
Retour arrière : git revert.
Prochaine étape : D-7, puis les 18 écritures et les 2 lectures historiques.
```
