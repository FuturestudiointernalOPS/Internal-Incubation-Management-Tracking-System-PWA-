/**
 * Phase 1 — Venture foundation (members, invitations, origins, taxonomies).
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// ─── Phase 1 — Venture Foundation (additive only) ───
// venture_members: single founder/member model (lead/owner/suspend/soft-delete)
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS contact_id TEXT",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'team_member'",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT 'edit'",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS invited_by TEXT",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS lead_founder BOOLEAN DEFAULT FALSE",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS suspended_by TEXT",
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
// venture_member_invitations: a founder adds a member by email; the person
// only joins after opening the emailed link (invite ≠ member)
"CREATE TABLE IF NOT EXISTS venture_member_invitations (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT, member_type TEXT NOT NULL DEFAULT 'team_member', role TEXT, contact_id TEXT, invited_by TEXT, token TEXT, token_hash TEXT, status TEXT NOT NULL DEFAULT 'pending', expires_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, responded_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())",
"CREATE UNIQUE INDEX IF NOT EXISTS idx_vmi_token_hash ON venture_member_invitations(token_hash) WHERE token_hash IS NOT NULL",
"CREATE INDEX IF NOT EXISTS idx_vmi_venture_status ON venture_member_invitations(venture_id, status)",
"CREATE INDEX IF NOT EXISTS idx_vmi_email ON venture_member_invitations(LOWER(email))",
// venture_milestones: runtime columns the code already reads/writes
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS target_date TIMESTAMP",
// v2_teams: promotion columns the promote route already writes
"ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT",
"ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP",
// ventures: canonical origin/profile columns
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES v2_programs(id)",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS origin_team_id TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMP",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS graduation_notes TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS north_star TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS country TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS country_code TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_status TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS social_media JSONB",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS branding JSONB",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS language TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS sector TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE",
// platform_form_submissions: submission → invitation link (Venture pipeline provenance)
"ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS invitation_id INTEGER",
"CREATE INDEX IF NOT EXISTS idx_form_submissions_invitation ON platform_form_submissions(invitation_id)",
// venture_origins: 1:1 CRM provenance for every venture
"CREATE TABLE IF NOT EXISTS venture_origins (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE, source_type TEXT NOT NULL DEFAULT 'legacy', program_id TEXT, cohort_id TEXT, team_id TEXT, participant_cid TEXT, invited_by_cid TEXT, form_id INTEGER, run_id INTEGER, submission_id INTEGER, invitation_id INTEGER, approved_by_cid TEXT, approved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_origins_source ON venture_origins(source_type)",
"CREATE INDEX IF NOT EXISTS idx_venture_origins_program ON venture_origins(program_id)",
"CREATE INDEX IF NOT EXISTS idx_venture_origins_team ON venture_origins(team_id)",
// venture_option_values: configurable taxonomies (stages, industry/sector, ...)
"CREATE TABLE IF NOT EXISTS venture_option_values (id SERIAL PRIMARY KEY, option_type TEXT NOT NULL, value TEXT NOT NULL, label TEXT, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(option_type, value))",
// Seed default taxonomies (idempotent; staff can edit via Venture Setup later)
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'idea', 'Idea', 1 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='idea')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'validation', 'Validation', 2 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='validation')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'mvp', 'MVP', 3 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='mvp')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'growth', 'Growth', 4 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='growth')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'scale', 'Scale', 5 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='scale')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Fintech', 'Fintech', 1 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Fintech')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Healthtech', 'Healthtech', 2 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Healthtech')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Edtech', 'Edtech', 3 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Edtech')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Cleantech', 'Cleantech', 4 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Cleantech')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'SaaS', 'SaaS', 5 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='SaaS')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'E-commerce', 'E-commerce', 6 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='E-commerce')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Agritech', 'Agritech', 7 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Agritech')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Logistics', 'Logistics', 8 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Logistics')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'AI / ML', 'AI / ML', 9 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='AI / ML')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Blockchain', 'Blockchain', 10 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Blockchain')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Media & Entertainment', 'Media & Entertainment', 11 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Media & Entertainment')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Real Estate', 'Real Estate', 12 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Real Estate')",
"INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Other', 'Other', 13 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Other')",
// platform_form_run_invitations: tracked invitations into the Venture Run
// (Phase 3 — Invitations & Team Promotion)
"CREATE TABLE IF NOT EXISTS platform_form_run_invitations (id SERIAL PRIMARY KEY, run_id INTEGER, contact_cid TEXT, email TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'external', program_id TEXT, cohort_id TEXT, team_id TEXT, invited_by_cid TEXT, token TEXT, token_hash TEXT, expires_at TIMESTAMP, used_at TIMESTAMP, status TEXT NOT NULL DEFAULT 'sent', created_at TIMESTAMP DEFAULT NOW(), UNIQUE(token))",
"CREATE INDEX IF NOT EXISTS idx_run_invitations_token_hash ON platform_form_run_invitations(token_hash)",
"CREATE INDEX IF NOT EXISTS idx_run_invitations_email ON platform_form_run_invitations(email)",
"CREATE INDEX IF NOT EXISTS idx_run_invitations_status ON platform_form_run_invitations(status)",
];
