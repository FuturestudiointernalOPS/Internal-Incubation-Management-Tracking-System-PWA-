# Lot 4 — étape 4.2 : premier lot de 10 actions protégées

> Date : 2026-10-20. Objectif : remplacer les listes de rôles en dur par une
> capacité déclarée, en commençant par les actions les plus destructrices.

---

## 1. Méthode

Chaque action est prise dans la dette, classée par risque, et reçoit une
**capacité** au lieu d'une liste de rôles. Le contrôle de session reste
(`requireAuth()`), puis la capacité décide.

Le lot commence par la surface qui peut modifier des données en masse :
migrations, imports, seeds, console plateforme. Toutes ces routes étaient
réservées au rôle `super_admin`.

---

## 2. Les 10 actions migrées

| Action | Avant | Après |
|---|---|---|
| `POST /api/admin/run-migration` | `requireAuth(["super_admin"])` | `requireAuth()` + `settings.edit` |
| `GET /api/migrate/phase0` | idem | idem |
| `POST`+`GET /api/migrate/phase1` | idem (×2) | idem (×2) |
| `POST`+`GET /api/migrate/phase5` | idem (×2) | idem (×2) |
| `POST /api/platform/import/execute` | idem | idem |
| `POST /api/platform/import/preview` | idem | idem |
| `POST`+`GET /api/platform/import/review-flags` | idem (×2) | idem (×2) |
| `POST /api/platform/seed/founder-assessment` | idem | idem |
| `POST /api/platform/seed/investor-application` | idem | idem |
| `GET /api/superadmin/full-state` | `createHandler({ roles: ["super_admin"] })` | `createHandler()` + `settings.view` |

**Aucun accès n'est retiré** : le propriétaire de la plateforme contourne la
capacité, et aucun profil standard ne porte `settings.edit` ni `settings.view`.
La capacité est donc, aujourd'hui, plus stricte ou égale à la liste de rôles
qu'elle remplace — et elle devient attribuable sans changer de code.

---

## 3. Ce que le cliquet a fait

Dix exceptions du garde-fou rôles sont devenues **périmées** (la liste de rôles
n'existe plus). Le cliquet a refusé de les garder : elles ont été retirées.
C'est la première fois que le compteur des exceptions baisse par migration, et
pas par édition manuelle.

Les tests de caractérisation qui figeaient l'ancienne liste ont été mis à jour
pour figer la nouvelle capacité, et le test d'intake investisseur de même.

---

## 4. Compteurs

| Indicateur | Avant 4.2 | Après 4.2 (lot 1) |
|---|---:|---:|
| Actions en dette | 159 | **149** |
| Actions `requireAuth` sans capacité | 105 | **96** |
| Listes de rôles en dur dans les actions | 177 | **164** |
| Exceptions figées du garde-fou rôles | 282 | **272** |
| Actions avec capacité | 249 | **259** |

---

## 5. Tests

- `action-declarations` : la dette figée correspond au balayage (149).
- `permissions-static-guards` : cliquet vert, dix exceptions retirées.
- `permissions-characterization` et `investor-application-intake` : assertions
  alignées sur la capacité.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run lint` → 0 erreur.

Reste une suite en échec, **préexistante et sans rapport** :
`security/login-history` fige une liste de rôles plus ancienne que la route
(qui contient déjà `staff`).

---

## 6. Retour arrière

`git revert`. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 1/7
Fait :
  - 10 actions de plateforme (migrations, imports, seeds, console) passent de
    la liste super_admin à settings.edit / settings.view
  - 10 exceptions du garde-fou devenues périmées retirées
  - tests de caractérisation alignés
Compteurs :
  - dette : 159 -> 149
  - requireAuth sans capacité : 105 -> 96
  - listes de rôles : 177 -> 164
  - exceptions figées : 282 -> 272
  - accès retirés : 0
Tests ajoutés / passants : cliquet et caractérisation verts ; 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : lot 2/7 — sécurité et annuaire (security/*, audit-logs,
  forensic, contacts), puis les surfaces venture restantes.
```
