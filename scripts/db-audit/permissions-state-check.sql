-- Permissions — état de la base (LECTURE SEULE)
--
-- Usage:
--   node scripts/db-audit/run-readonly.mjs scripts/db-audit/permissions-state-check.sql .env.local
--
-- Répond aux questions que le code seul ne peut pas trancher (Phase 0 §2) et
-- fournit les chiffres RÉELS, jamais estimés. Aucune écriture.

-- 1. Les tables que le système d'autorisation consomme.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'contacts', 'profile_assignments', 'feature_eligibility', 'user_capabilities',
    'context_applied_grants', 'historical_access_revocations', 'system_settings',
    'v2_programs', 'v2_program_staff', 'participant_programs', 'ventures'
  )
ORDER BY 1;

-- 2. Valeurs d'identité HÉRITÉES encore présentes (Phase 8 : contacts.role doit
--    se limiter à super_admin / staff / member).
SELECT role, COUNT(*) AS n FROM contacts GROUP BY role ORDER BY n DESC;

-- 3. Le registre d'affectations (matière du backfill Phase 5).
SELECT context_type, profile_key, status, source, COUNT(*) AS n
FROM profile_assignments GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4;

-- 4. Forme de la matrice d'éligibilité (rôles de base vs profils).
SELECT identity_type, COUNT(*) AS n FROM feature_eligibility GROUP BY 1 ORDER BY 1;

-- 5. Empreinte de la lecture résiduelle (D3) — les lignes préfixées `hist:`.
SELECT module, capability, COUNT(*) AS n
FROM user_capabilities WHERE granted_by LIKE 'hist:%' GROUP BY 1, 2 ORDER BY 1, 2;

-- 6. Programme sans responsable (D5) — aucun `assigned_pm_id`.
SELECT COUNT(*) FILTER (WHERE assigned_pm_id IS NULL OR assigned_pm_id = '') AS without_pm,
       COUNT(*) AS total
FROM v2_programs;
