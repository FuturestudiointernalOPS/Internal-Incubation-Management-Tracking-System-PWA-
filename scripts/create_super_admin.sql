-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE / RESET SUPER ADMIN — STAGING ONLY
-- ═══════════════════════════════════════════════════════════════════════════════
-- Email:    gclud79@gmail.com
-- Password: Aa.123456
--
-- This is idempotent:
--   • If the email does not exist → creates the super admin.
--   • If the email already exists    → updates it to super_admin / active and
--                                      resets the password.
--
-- ⚠️  Run this ONLY against STAGING. Never against production.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO contacts (
    cid,
    name,
    email,
    role,
    status,
    password,
    group_name,
    deleted
)
VALUES (
    'USR_GCLUD79',
    'Super Admin',
    'gclud79@gmail.com',
    'super_admin',
    'active',
    '$2b$10$R.jsbkMXWzYUay6f/6WHseVlMvtEh.b07OxE1iv/V/a9XzoElS5gK',
    'FUTURE STUDIO',
    0
)
ON CONFLICT (email) DO UPDATE SET
    name       = EXCLUDED.name,
    role       = 'super_admin',
    status     = 'active',
    password   = EXCLUDED.password,
    group_name = EXCLUDED.group_name,
    deleted    = 0;

-- ── Optional reactivation (run only if the email was previously soft-deleted) ──
-- UPDATE contacts
-- SET deleted_at = NULL, archived_at = NULL
-- WHERE LOWER(email) = 'gclud79@gmail.com';

-- ── Verify ─────────────────────────────────────────────────────────────────────
SELECT cid, name, email, role, status
FROM contacts
WHERE LOWER(email) = 'gclud79@gmail.com';
