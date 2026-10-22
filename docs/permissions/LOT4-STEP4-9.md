# Lot 4 — étape 4.9 : les cinq dernières actions protégées

> Date : 2026-10-21. Quatre actions de plus reçoivent une capacité dédiée, sans
> changer un seul accès. Il reste **une** action, laissée en dette assumée.

---

## 1. Les quatre conversions

| Action | Avant | Après | Accès |
|---|---|---|---|
| `POST /api/auth/invite-family` | `["super_admin","program_manager","staff"]` + contrôle du programme géré | `contacts.invite_families` + le **même** contrôle | identique |
| `GET /api/journey-reports` | rôle global codé dans le fichier | `reports.portfolio` | identique : personne ne détient la capacité, seul le propriétaire passe |
| `GET /api/ventures/assigned` | `roles: ["staff","program_manager","super_admin"]` | `ventures.my_assignments` | identique |
| `GET /api/ventures/lead-manager/home` | idem | `ventures.my_assignments` | identique |

`contacts.invite_families` et `ventures.my_assignments` sont accordées au profil
**personnel** (`staff_default`) par le même backfill que l'étape 4.8, en
insertion seule. `reports.portfolio` n'est accordée à **aucun** profil : c'est
la porte du propriétaire de la plateforme, et la ligne de vérification prouve
qu'elle n'a pas fuité vers le personnel.

Le contrôle de programme de l'invitation de familles **reste** : la capacité
autorise l'acte, la relation décide sur quel programme. Une capacité ne remplace
pas une vérification de périmètre.

## 2. Le seul changement visible : la forme d'un refus

`GET /api/journey-reports` répondait `404` à une requête sans session, et `403`
à une identité non autorisée. La décision centralisée répond désormais `401`
sans session — c'est la forme unique validée (D-6 : dire la vraie raison). Le
test de la route fige ce comportement.

## 3. L'action qui reste

`GET /api/integrations/google-calendar/connect` est ouverte à **toute identité
connectée** : elle ne lit aucune donnée propre, elle pose un cookie `state`
propre au navigateur. Le registre ne sait représenter que « soi-même via
`session.cid` » ; la déclarer ainsi serait faux. Elle reste donc la seule
action de la liste de travail, **assumée et mesurée** — ce n'est pas un trou :
aucune donnée n'est exposée et la session est exigée.

Deux issues possibles, à trancher plus tard :

1. ajouter au registre une forme « connecté seulement, aucune donnée » ;
2. lier réellement le cookie `state` à `session.cid` (meilleure sécurité) et la
   déclarer « soi-même ».

## 4. Compteurs

| Indicateur | Avant 4.9 | Après 4.9 |
|---|---:|---:|
| Actions « à protéger » | 5 | **1** |
| Liste de travail totale | 41 | **37** |
| Actions non déclarées (dette) | 5 | **1** |
| Compteur d'audit strict | 71 | **70** |
| Fichiers avec le contrôle central | 234 | **238** |
| Listes de rôles en dur dans les actions | 40 | **37** |
| Comparaisons de rôle hors moteur | 232 | **228** |
| Exceptions figées du garde-fou rôles | 150 | **146** |

## 5. Tests

- `journey-reports-portfolio` → le mock de capacité remplace le mock de rôle ;
  l'accès sans session fige désormais `401`.
- `profile-catalogue-seed` → le backfill porte 9 lignes.
- `permissions-static-guards`, `action-declarations`, `authz-metrics-ratchet`,
  `staff-venture-projects-tab` → verts.
- `npm run test:authz` → **12 suites / 79 tests** verts.
- `npm run lint` → 0 erreur.

## 6. Production

Après déploiement, `scripts/db-audit/capability-defaults-verification.sql`
vérifie les 9 attributions et l'absence de `reports.portfolio` sur le profil
personnel.

## 7. Retour arrière

`git revert`. En base : supprimer les lignes ajoutées et le marqueur
`profile-capability-defaults-v1` pour rejouer la migration.

## 8. Compte rendu

```
LOT 4 — Registre déclaratif — étape 4.9
Fait : 4 actions de plus protégées par une capacité dédiée ; 1 refus
  normalisé (401 sans session sur le portefeuille).
Compteurs : à protéger 5 -> 1 ; liste de travail 41 -> 37 ;
  dette 5 -> 1 ; listes de rôles 40 -> 37 ; comparaisons 232 -> 228 ;
  exceptions 150 -> 146.
Divergences : une seule — la forme du refus sans session (404 -> 401),
  conforme à la décision D-6.
Tests : 12 suites / 79 tests authz verts.
Décisions requises : la dernière action (démarrage OAuth) — nouvelle forme
  de déclaration, ou lien réel au `session.cid`.
Retour arrière : git revert.
Prochaine étape : Lots 6 et 7 — écriture atomique profil + droits, puis
  projection de l'interface.
```
