# Vérifications base (lecture seule) — résultats réels

> Exécuté avec `scripts/db-audit/run-readonly.mjs <sql> .env.local` (**staging**
> Supabase, `aws-0-eu-west-1.pooler.supabase.com:6543`, PostgreSQL 17.6).
> **Aucune écriture** : l'exécuteur n'autorise que `SELECT / WITH / SHOW / EXPLAIN`.
> ⚠️ `.env.local` vise la **staging**, pas la production (voir `AGENTS.md`).
>
> Ceci lève les « incertitudes d'environnement » de la Phase 0 complémentaire §2.

## Faits mesurés (jamais estimés)

| # | Question | Résultat réel |
|---|---|---|
| 1 | Tables du système d'autorisation | `contacts`, `context_applied_grants`, `feature_eligibility`, `participant_programs`, `profile_assignments`, `system_settings`, `user_capabilities`, `v2_program_staff`, `v2_programs`, `ventures`. **`historical_access_revocations` absente** (créée à la 1ʳᵉ utilisation, D3 2/2) |
| 2 | Valeurs d'identité **héritées** (`contacts.role`) | `staff` 4, **`applicant` 3 (hérité, hors identités de base)**, `member` 2, `super_admin` 1 |
| 3 | Registre d'affectations (`profile_assignments`) | 4 lignes, toutes `automatic` : `lms/learner` terminée ; `program/facilitator` terminée ; `program/program_manager` active ; `venture/founder` active |
| 4 | Matrice d'éligibilité (`feature_eligibility`) | **26** lignes `role` + **18** lignes `profile` |
| 5 | Lecture résiduelle (`user_capabilities` `granted_by LIKE 'hist:%'`) | **2** : `programs.view` ×1 et `lms.view` ×1 |
| 6 | Programmes sans responsable (`v2_programs.assigned_pm_id`) | **0** sur 1 programme |

## Conséquences (rattachées à des décisions)

- **Phase 8 — nettoyage d'identité** : `applicant` (3 comptes) est une valeur
  héritée à migrer vers une identité de base + une affectation de fonction
  équivalente. Migration **réversible**, à valider.
- **D5 — « propriétaire »** : `v2_programs` **n'a aucune colonne propriétaire**
  (seulement `assigned_pm_id` / `assigned_assistant_id`). La règle arbitrée
  « accessible au seul propriétaire » **n'a donc pas de définition dans le
  modèle** → **décision produit requise** (qui est propriétaire ? faut-il une
  colonne ?). C'est le blocage réel de D5, plus que la Phase 5.
- **D1 (a)** : le résidu `programs.view` **existe bien** en base → la borne
  livrée s'applique à un cas réel.
- **D3 (2/2)** : la table de révocation se créera à la première utilisation ;
  aucun balayage base n'a été lancé.

## Reproductibilité

```bash
node scripts/db-audit/run-readonly.mjs scripts/db-audit/permissions-state-check.sql .env.local
```

## Ce qui reste à mesurer (nécessite une écriture, donc autorisation)

- Le **backfill** du registre (Phase 5) et la mesure du mode ombre.
- La **migration des mots de passe** en clair (`scripts/hash-legacy-passwords.mjs`,
  `--apply --backup=…`).
