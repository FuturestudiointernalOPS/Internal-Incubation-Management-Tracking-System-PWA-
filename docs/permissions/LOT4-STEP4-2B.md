# Lot 4 — étape 4.2, lot 2/7 : sécurité et audit

> Date : 2026-10-20. Six surfaces de sécurité passent du nom de rôle à une
> capacité explicite.

---

## 1. Les 6 actions migrées

| Action | Avant | Après |
|---|---|---|
| `GET /api/security/events` | `super_admin` ou `security_officer` | `users.view` |
| `PATCH /api/security/events` | idem | `users.edit` |
| `GET /api/security/sessions` | idem | `users.view` |
| `POST /api/security/sessions` (révocation) | idem | `users.edit` |
| `GET /api/audit-logs` (+ `/[id]`) | idem | `users.view` |
| `GET /api/audit-log` | `super_admin` | `users.view` |
| `GET /api/forensic/user-role` | `super_admin` | `users.view` |

Lecture de la surface de sécurité → `users.view` ; modification (révoquer une
session, résoudre un événement) → `users.edit`.

---

## 2. Effet sur les accès

- Le propriétaire de la plateforme : inchangé (contournement).
- Un `staff` : inchangé par défaut — aucun profil standard ne porte `users.*`.
- `security_officer` : n'est **pas** produit par la connexion (la liste des
  valeurs de session ne le contient pas). Il s'agissait d'un libellé
  contextuel : l'accès passe désormais par la capacité, attribuable sans
  changer de code.

Aucun utilisateur actif ne perd donc son accès aujourd'hui.

---

## 3. Cas laissé en dette, à dessein

`GET /api/security/login-history` : **tranché** le 2026-10-20 — réservé à
l'administration (`users.view`) ; voir `LOT4-STEP4-3.md`.

`GET/POST/DELETE /api/contact-emails` : **tranché** le 2026-10-20 — la décision
reste dans le service, mais le registre sait désormais déclarer une décision
**déléguée** (`LOT4-STEP4-3.md`), donc la route quitte la liste de travail.

---

## 4. Compteurs

| Indicateur | Avant le lot 2 | Après le lot 2 |
|---|---:|---:|
| Actions en dette | 149 | **143** |
| Actions sans capacité (liste de travail) | 183 | **177** |
| Listes de rôles en dur dans les actions | 164 | **155** |
| Exceptions figées du garde-fou rôles | 272 | **265** |

---

## 5. Tests

- `permissions-static-guards` : sept nouvelles exceptions devenues périmées,
  retirées par le cliquet.
- `permissions-characterization` : trois tests de sécurité alignés sur la
  capacité.
- `security-phase3-urgences` : le refus d'un fondateur hors périmètre attend
  désormais 403 (conséquence de D-6, corrigée ici).
- `security-*` (16 suites) → vertes, sauf la caractérisation préexistante de
  `login-history`.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 2/7
Fait :
  - 6 surfaces de sécurité/audit passent à users.view / users.edit
  - 7 exceptions du garde-fou devenues périmées retirées
  - test de fondateur aligné sur D-6 (403)
  - deux cas documentés laissés en dette (contact-emails délégué,
    login-history en attente d'une décision produit)
Compteurs :
  - dette : 149 -> 143
  - liste de travail : 183 -> 177
  - listes de rôles : 164 -> 155
  - exceptions figées : 272 -> 265
  - accès retirés pour un utilisateur actif : 0
Tests ajoutés / passants : caractérisation et garde vertes ; 54 tests authz.
Décisions requises : qui peut voir l'historique de connexion (login-history).
Retour arrière : git revert.
Prochaine étape : lot 3/7 — annuaire et contacts (contacts, categories,
  dashboard, activity, events), puis les surfaces venture restantes.
```
