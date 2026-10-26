-- Synthetic compatibility fixture ONLY, not the complete ImpactOS schema.
DO $$ BEGIN
  IF current_database() <> 'impactos_wl_synthetic' OR to_regclass('public.contacts') IS NOT NULL THEN
    RAISE EXCEPTION 'Requires an empty impactos_wl_synthetic database';
  END IF;
END $$;
CREATE TABLE contacts (cid TEXT PRIMARY KEY, name TEXT, email TEXT,
  role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active', deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE user_sessions (token TEXT PRIMARY KEY, token_hash TEXT, user_cid TEXT NOT NULL,
  role TEXT, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE v2_programs (id UUID PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  status TEXT, duration_weeks INTEGER NOT NULL DEFAULT 13, duration_days INTEGER NOT NULL DEFAULT 0,
  start_date DATE, end_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_pm_id TEXT, assigned_assistant_id TEXT, note_id TEXT,
  program_type TEXT DEFAULT 'incubation', is_archived INTEGER DEFAULT 0, is_template INTEGER DEFAULT 0);
CREATE TABLE v2_knowledge_bank (id UUID PRIMARY KEY, title TEXT);
INSERT INTO contacts (cid, name, email) VALUES ('SYNTH-PERSON', 'Synthetic Person', 'person@example.invalid');
INSERT INTO v2_programs (id, name, description, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Legacy synthetic programme', 'Preserve this row', 'planned');
INSERT INTO user_sessions (token, user_cid, role, expires_at) VALUES
  ('synthetic-token', 'SYNTH-PERSON', 'participant', '2099-01-01');
CREATE TABLE wl_synthetic_baseline (kind TEXT PRIMARY KEY, snapshot JSONB);
INSERT INTO wl_synthetic_baseline VALUES
  ('program', (SELECT to_jsonb(p) FROM v2_programs p)),
  ('session', (SELECT to_jsonb(s) FROM user_sessions s));
