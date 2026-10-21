# Lot 4 — étape 4.2, lot 7/7 : projets et intentions

> Date : 2026-10-20. Dernier lot de l'étape 4.2 : huit routes de collaboration
> déclarent la décision qui vivait déjà dans leur service, une route admin passe
> à `projects.view`. L'étape 4.2 est terminée.

---

## 1. Les actions déclarées

| Action | Décision déclarée |
|---|---|
| `GET /api/projects/assignments` | `projects/collaboration.js` — projets possédés / en collaboration / actifs |
| `GET /api/projects/invitations` | `projects/collaboration.js` — invitations bornées à l'appelant |
| `POST /api/projects/invitations/respond` | `projects/collaboration.js` — l'invité répond, l'invitant annule |
| `GET/POST /api/projects/discuss` | `requireProjectAccess` (propriétaire ou membre) |
| `POST /api/admin/projects/[id]/reports/generate` | `requireProjectAccess` + `adminProjectReports.js` |
| `GET/POST/PUT/DELETE /api/intents` | `platform/intents.js` — contexte et responsable |
| `GET /api/intents/[id]` | `platform/intents.js` |
| `POST /api/intents/[id]/tasks` | `platform/intents.js` — accès à l'intention + assignation |

Ces décisions dépendent de l'appartenance au projet ou du contexte de
l'intention : elles restent dans le service, le registre les nomme.

### Capacité explicite

| Action | Avant | Après |
|---|---|---|
| `GET /api/admin/projects` | `requireAuth(["super_admin"])` | `projects.view` |

Le profil **Staff Default** porte `projects.view` : un staff peut désormais lire
la liste agrégée des projets. C'est le même droit que celui qui lui permet déjà
de lire le portefeuille de tâches, et le même écran n'est pas monté pour lui
dans l'interface. Gain documenté, pas de retrait.

---

## 2. Compteurs

| Indicateur | Avant le lot 7 | Après le lot 7 |
|---|---:|---:|
| Actions en dette | 94 | **85** |
| Actions sans capacité (liste de travail) | 151 | **150** |
| dont à protéger | 94 | **93** |
| Listes de rôles en dur dans les actions | 74 | **73** |
| Comparaisons de rôle hors moteur (lignes) | 351 | **350** |
| Exceptions figées du garde-fou rôles | 210 | **209** |
| Exceptions figées du garde-fou étendu | 48 | **48** |
| Nouvelles occurrences non listées / périmées | 0 / 0 | **0 / 0** |

---

## 3. Tests

- `identity-gate-bridge` : deux assertions alignées sur les changements
  antérieurs (le PUT des soumissions est devenu un handler « bare auth » ; la
  qualification d'upload a suivi la règle dans le service).
- `permissions-characterization` : `admin/projects` fige `projects.view`.
- `permissions-static-guards` : une exception devenue périmée retirée.
- Suites ciblées : `projects-api`, `projects-collaboration-api`,
  `projects-collaboration-invitations`, `admin-projects`,
  `staff-projects-ui`, `identity-gate-bridge`,
  `permissions-characterization` → 7 suites / 124 tests verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 4. Retour arrière

`git revert`. Aucune écriture en base, aucune migration.

---

## 5. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 7/7
Fait :
  - 8 routes projets/intents déclarent leur décision déléguée
  - GET /api/admin/projects passe à projects.view
  - deux assertions de pont alignées sur les lots précédents
Compteurs :
  - dette : 94 -> 85
  - liste de travail : 151 -> 150 (à protéger 94 -> 93)
  - listes de rôles : 74 -> 73
  - comparaisons de rôle : 351 -> 350
  - exceptions figées : 210 -> 209
  - accès retirés pour une personne réelle : 0
Divergences : gain assumé — un staff portant projects.view lit la liste agrégée
  des projets côté admin.
Tests ajoutés / passants : 7 suites ciblées (124 tests) + 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : l'étape 4.2 est close ; reste le Lot 5 (un seul contrôle
  venture, 38 appels à migrer), puis les lots 6 à 8.
```
