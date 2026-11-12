# Étape 0 — photographie de référence des décisions actuelles

Générée le 2026-11-12T11:31:33.719Z. **Lecture seule : aucun accès n'a été modifié.**

- Base : `postgres` (aws-0-eu-west-1.pooler.supabase.com:6543)
- Projet : `postgres.mbpaxrfhqqclzyiefuab`
- Rôle SQL : `postgres`
- Fichier d'environnement : `.env.local`
- Personnes photographiées : **25**

> Le détail reste local, dans `scratch/authz-reference/`. Les identifiants y sont remplacés par une empreinte stable par défaut (option `--include-identifiers` pour les garder).

## Par rôle

| Rôle | Personnes |
|---|---:|
| `member` | 18 |
| `staff` | 6 |
| `super_admin` | 1 |

## Rôles stockés (avant résolution de connexion)

| Rôle stocké | Personnes |
|---|---:|
| `member` | 17 |
| `staff` | 5 |
| `applicant` | 1 |
| `investor` | 1 |
| `super_admin` | 1 |

## Par espace

| Espace | Personnes |
|---|---:|
| `member` | 18 |
| `staff` | 6 |
| `admin` | 1 |

## Éligibilité par fonctionnalité

| Fonctionnalité | Éligibles | Non éligibles | Propriétaire (contournement) |
|---|---:|---:|---:|
| `crm` | 6 | 18 | 1 |
| `communication` | 15 | 9 | 1 |
| `programs` | 24 | 0 | 1 |
| `ventures` | 24 | 0 | 1 |
| `investors` | 7 | 17 | 1 |
| `finance` | 6 | 18 | 1 |
| `operations` | 12 | 12 | 1 |
| `reports` | 6 | 18 | 1 |
| `knowledge` | 6 | 18 | 1 |
| `lms` | 6 | 18 | 1 |
| `security` | 6 | 18 | 1 |
| `settings` | 6 | 18 | 1 |

## Droits accordés, par module et action

| Module | Action | Personnes autorisées |
|---|---|---:|
| `contacts` | `view` | 6 |
| `contacts` | `create` | 1 |
| `contacts` | `edit` | 1 |
| `contacts` | `delete` | 1 |
| `contacts` | `invite_families` | 5 |
| `duplicates` | `view` | 0 |
| `duplicates` | `resolve` | 0 |
| `bulk_upload` | `execute` | 0 |
| `crm` | `view` | 0 |
| `crm` | `create` | 0 |
| `crm` | `edit` | 0 |
| `crm` | `delete` | 0 |
| `crm` | `assign` | 0 |
| `crm` | `manage` | 0 |
| `org_membership` | `view` | 1 |
| `org_membership` | `manage` | 1 |
| `messaging` | `view` | 7 |
| `messaging` | `send` | 6 |
| `messaging` | `delete` | 2 |
| `internal_comms` | `view` | 1 |
| `internal_comms` | `create_announcements` | 1 |
| `internal_comms` | `moderate` | 1 |
| `forms` | `view` | 2 |
| `forms` | `create` | 2 |
| `forms` | `edit` | 1 |
| `forms` | `delete` | 1 |
| `collections` | `view` | 5 |
| `collections` | `manage` | 0 |
| `runs` | `view` | 1 |
| `runs` | `create` | 1 |
| `runs` | `edit` | 1 |
| `runs` | `delete` | 1 |
| `runs` | `review` | 1 |
| `programs` | `view` | 6 |
| `programs` | `create` | 6 |
| `programs` | `edit` | 6 |
| `programs` | `delete` | 1 |
| `programs` | `publish` | 6 |
| `programs` | `groups` | 5 |
| `facilitator` | `participants.view` | 1 |
| `facilitator` | `attendance.view` | 1 |
| `facilitator` | `attendance.record` | 1 |
| `facilitator` | `assignments.view` | 1 |
| `facilitator` | `assignments.grade` | 1 |
| `facilitator` | `sessions.conduct` | 1 |
| `facilitator` | `reviews.submit` | 1 |
| `ventures` | `view` | 22 |
| `ventures` | `create` | 2 |
| `ventures` | `edit` | 22 |
| `ventures` | `delete` | 1 |
| `ventures` | `view_all` | 2 |
| `ventures` | `edit_all` | 2 |
| `ventures` | `setup` | 6 |
| `ventures` | `kpis` | 6 |
| `ventures` | `permissions_view` | 6 |
| `ventures` | `my_assignments` | 6 |
| `ventures` | `validate` | 1 |
| `investor` | `view` | 1 |
| `investor` | `create` | 1 |
| `investor` | `edit` | 1 |
| `investor` | `delete` | 1 |
| `finance` | `view` | 1 |
| `finance` | `create` | 1 |
| `finance` | `edit` | 1 |
| `finance` | `delete` | 1 |
| `finance` | `export` | 1 |
| `projects` | `view` | 6 |
| `projects` | `create` | 6 |
| `projects` | `edit` | 6 |
| `projects` | `delete` | 1 |
| `projects` | `archive` | 1 |
| `tasks` | `view` | 1 |
| `tasks` | `create` | 1 |
| `tasks` | `edit` | 1 |
| `tasks` | `delete` | 1 |
| `reports` | `view` | 6 |
| `reports` | `create` | 6 |
| `reports` | `export` | 1 |
| `reports` | `delete` | 1 |
| `reports` | `portfolio` | 0 |
| `knowledge` | `view` | 1 |
| `knowledge` | `create` | 1 |
| `knowledge` | `edit` | 1 |
| `knowledge` | `delete` | 1 |
| `lms` | `view` | 1 |
| `lms` | `create` | 2 |
| `lms` | `edit` | 1 |
| `lms` | `delete` | 1 |
| `users` | `view` | 1 |
| `users` | `create` | 1 |
| `users` | `edit` | 1 |
| `users` | `suspend` | 1 |
| `users` | `delete` | 1 |
| `users` | `assign_roles` | 1 |
| `permissions` | `view_matrix` | 1 |
| `permissions` | `grant` | 1 |
| `permissions` | `revoke` | 1 |
| `permissions` | `assign_capabilities` | 1 |
| `permissions` | `assign_groups` | 1 |
| `permissions` | `assign_responsibilities` | 1 |
| `permissions` | `promote_super_admin` | 1 |
| `permissions` | `remove_super_admin` | 1 |
| `permissions` | `configure_eligibility` | 1 |
| `settings` | `view` | 1 |
| `settings` | `edit` | 1 |
| `settings` | `manage_schema` | 0 |
| `engineering` | `view` | 1 |
| `engineering` | `manage_tasks` | 1 |
| `engineering` | `manage_errors` | 1 |

## Arrivée après connexion

| Adresse | Personnes |
|---|---:|
| `/member/participant` | 12 |
| `/staff` | 4 |
| `/member/investor/dashboard` | 3 |
| `/member` | 3 |
| `/staff/program-manager` | 2 |
| `/admin` | 1 |

---

### Comment utiliser cette photographie

1. C'est la **référence** : toute étape suivante doit reproduire ces verdicts, sauf décision explicite de retirer un droit.
2. Le propriétaire apparaît encore avec `eligibility: null` : c'est le contournement actuel, pas la cible.
3. Les adresses d'arrivée sont celles d'aujourd'hui ; l'étape 4 les remplacera par un calcul fondé sur les droits.
4. Pour comparer après une étape, relancer ce script et diffuser les deux JSON.