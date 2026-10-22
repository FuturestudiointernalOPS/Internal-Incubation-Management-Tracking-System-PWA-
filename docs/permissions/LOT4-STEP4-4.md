# Lot 4 — étape 4.4 : dix actions d'administration protégées par une capacité

> Date : 2026-10-20. Première tranche du registre déclaratif : les actions qui
> n'admettaient déjà que le propriétaire de la plateforme échangent leur liste
> de rôles contre la capacité correspondante.

---

## 1. Pourquoi cette tranche d'abord

Ces dix fichiers étaient tous **déjà** réservés à `super_admin` :

- soit par `requireAuth(["super_admin"])` ;
- soit par `createHandler({ roles: ["super_admin"] })`.

Le propriétaire de la plateforme est **exempté** de la décision de capacité.
Remplacer la liste par une capacité ne change donc **aucune réponse** : c'est un
changement de forme, pas de règle. C'est la tranche au plus faible risque, et
elle retire dix entrées de la liste de travail.

En revanche, les routes qui admettaient aussi `staff` ou `program_manager` ne
sont **pas** touchées ici : leur capacité équivalente n'est pas encore dans le
profil par défaut du personnel, donc basculer maintenant retirerait un accès.
Elles viendront après la mesure de leurs profils.

## 2. Le mapping

| Action | Avant | Après |
|---|---|---|
| `GET /api/admin/analytics` | `requireAuth(["super_admin"])` | `reports.view` |
| `GET /api/admin/analytics/users` | `requireAuth(["super_admin"])` | `users.view` |
| `GET /api/admin/finance/data-sources` | `roles: ["super_admin"]` | `finance.view` |
| `POST /api/admin/ventures/create` | `roles: ["super_admin"]` | `ventures.create` |
| `GET /api/admin/ventures` | `roles: ["super_admin"]` | `settings.view` |
| `PATCH /api/admin/ventures` | `roles: ["super_admin"]` | `settings.edit` |
| `GET /api/engineering/email-config` | `requireAuth(["super_admin"])` | `settings.view` |
| `POST /api/engineering/email-config` | `requireAuth(["super_admin"])` | `settings.edit` |
| `POST /api/auth/resend-invite/[cid]` | `roles: ["super_admin"]` | `users.edit` |
| `POST /api/auth/revoke/[cid]` | `roles: ["super_admin"]` | `users.suspend` |
| `GET /api/investor/admin-overview` | `requireAuth(["super_admin"])` | `investor.view` |
| `GET /api/investor/executive-dashboard` | `requireAuth(["super_admin"])` | `investor.view` |

Deux fichiers portent deux méthodes : la capacité est vérifiée par méthode, avec
le niveau qui correspond (`view` pour lire, `edit` / `create` / `suspend` pour
écrire).

## 3. Le garde-fou

Dix entrées du garde-fou de rôle sont devenues **périmées** : elles sont retirées
sur le rapport du garde-fou, jamais devinées. Le cliquet continue de refuser
toute nouvelle liste.

Trois caractérisations figées ont été mises à jour pour épingler la capacité au
lieu du rôle — c'est le but de la caractérisation : elle suit la décision
lorsque celle-ci est prise.

## 4. Compteurs

| Indicateur | Avant 4.4 | Après 4.4 |
|---|---:|---:|
| Actions « à protéger » | 83 | **73** |
| Liste de travail totale | 121 | **111** |
| Compteur d'audit strict | 89 | **84** |
| Fichiers avec le contrôle central | 212 | **222** |
| Listes de rôles en dur dans les actions | 68 | **57** |
| Comparaisons de rôle hors moteur | 263 | **252** |
| Exceptions figées du garde-fou rôles | 169 | **159** |

## 5. Tests

- `npm run test:authz` → **12 suites / 79 tests** verts, cliquet respecté.
- `ventures/admin-venture-create` → 7 tests verts (le mock de capacité remplace
  le mock de rôle).
- `npm run lint` → 0 erreur sur les fichiers touchés.

## 6. Retour arrière

`git revert`. Aucune écriture en base. Aucun accès n'est élargi ni retiré : le
propriétaire de la plateforme passait déjà.

## 7. Compte rendu

```
LOT 4 — Registre déclaratif — étape 4.4
Fait : dix actions super-admin-only protégées par une capacité (12 méthodes).
Compteurs : à protéger 83 -> 73 ; liste de travail 121 -> 111 ;
  listes de rôles 68 -> 57 ; comparaisons 263 -> 252 ; exceptions 169 -> 159.
Divergences : aucune (le propriétaire de la plateforme est exempté).
Tests : 12 suites / 79 tests authz verts ; caractérisations mises à jour.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : mesurer les profils avant de convertir les routes qui
  admettaient aussi le personnel ou les gestionnaires.
```
