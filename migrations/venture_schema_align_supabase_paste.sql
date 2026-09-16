-- =============================================================================
-- VENTURE SCHEMA ALIGN (SQL-EDITOR EDITION) — give a database that has never
-- run the Venture paths the tables and columns the code already reads and writes.
-- =============================================================================
-- WHY THIS FILE EXISTS
--   Verified read-only against production: 29 of the 67 tables the code needs
--   are missing, 24 of them Ventures. The Ventures DDL has no migration file of
--   its own — it lives inside ensureVentureSchema() (src/lib/ventures.js),
--   ensureJourneyTable() (src/lib/ventureJourneys.js) and the historical
--   016/017/019/020 files under src/migrations/, and only ever runs lazily from
--   four code paths, swallowing every error. This is the explicit path.
--
-- NON-DISRUPTIVE BY CONSTRUCTION
--   * ADDITIVE ONLY. Every statement is CREATE TABLE IF NOT EXISTS,
--     ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--     ALTER COLUMN ... DROP NOT NULL (relaxes a constraint — it can never
--     reject a value that used to be accepted, and it is guarded here anyway),
--     or an INSERT ... WHERE NOT EXISTS seed that inserts ONLY when that exact
--     row is absent.
--   * There is no DROP, no TRUNCATE, no DELETE, no UPDATE, and nothing is ever
--     renamed. A column this file does not know about is left exactly as it is.
--   * Running it twice changes nothing the second time.
--   * It runs as ONE BATCH in the SQL editor, so nothing in it may be allowed to
--     fail: every statement whose target may be absent is wrapped in a guard.
--
-- SUPABASE SQL-EDITOR EDITION — PASTE THIS INSTEAD OF HAVING TO EDIT ANYTHING
--   This file is venture_schema_align.sql with the abort-prone statements already
--   wrapped in their guards. Nothing has to be deleted by hand, and there is no
--   longer any statement that can fail on a database whose shape differs from
--   staging's. Paste the whole file in one go.
--
-- WHY IT DIFFERS FROM venture_schema_align.sql
--   The node runner (scripts/db-audit/apply-schema-file.mjs) collects a failure
--   and carries on. The Supabase SQL editor does NOT: it sends the paste as ONE
--   batch, so the FIRST error aborts everything after it and rolls the batch back.
--   Six statements here target tables that may be absent on this database
--   (v2_teams, platform_form_submissions, venture_kpi_definitions, venture_history,
--   venture_activity_log, user_sessions) and two relax a NOT NULL on a column that
--   may not exist (venture_founders.contact_id, ventures.name). Every one of them
--   would have taken the rest of the file down with it.
--   Here they are guarded instead: to_regclass() for a possibly-absent TABLE,
--   an EXCEPTION WHEN undefined_column handler for a possibly-absent COLUMN.
--   A guarded statement is a NO-OP when its target is absent, so the whole file
--   applies in one paste and is safe to re-run.
--
--   The one-statement-per-line contract of the original file does NOT hold here,
--   because the guards are DO $$ ... $$ blocks. Use THIS file in the SQL editor,
--   and venture_schema_align.sql + venture_schema_align_legacy_guards.sql with the
--   node runner. Both routes reach the same end state.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — VENTURE TABLES THAT DO NOT EXIST YET, in dependency order
-- =============================================================================
-- Coaches first: venture_sessions holds a foreign key to venture_coaches(id),
-- so creating sessions before coaches would fail on that reference.
--
-- NO FOREIGN KEY ON venture_id FOR THESE SIX TABLES: venture_coach_assignments,
-- venture_coach_activity, venture_tasks, venture_task_activity, venture_sessions,
-- venture_session_activity. That is not an oversight — it is how staging has them,
-- and it is required: the code resolves the Venture's INTERNAL id
-- (resolveVentureInternalId -> ventures.id) and writes THAT into these columns,
-- while ventures(venture_id) holds the VNT- code. On staging ventures.id is an
-- unconstrained TEXT value here, so it stores fine. An FK to ventures(venture_id)
-- would reject every such write with 23503 on a database whose ventures.id is an
-- integer — the journey and task-creation paths would break on the first request.
-- The other venture_id columns below DO keep their FK: those paths resolve the
-- VNT- code first (see resolveCode() in the notes/plans routes).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venture_coaches (id SERIAL PRIMARY KEY, coach_type TEXT NOT NULL DEFAULT 'coach', full_name TEXT NOT NULL, photo_url TEXT, email TEXT NOT NULL UNIQUE, phone TEXT, organization TEXT, biography TEXT, years_experience INTEGER, areas_of_expertise JSONB DEFAULT '[]'::jsonb, industries JSONB DEFAULT '[]'::jsonb, languages JSONB DEFAULT '[]'::jsonb, availability TEXT DEFAULT 'available', timezone TEXT DEFAULT 'UTC', linkedin_url TEXT, website_url TEXT, status TEXT DEFAULT 'active', created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_coaches_type ON venture_coaches(coach_type);
CREATE INDEX IF NOT EXISTS idx_venture_coaches_status ON venture_coaches(status);
CREATE INDEX IF NOT EXISTS idx_venture_coaches_email ON venture_coaches(email);
CREATE TABLE IF NOT EXISTS venture_coach_assignments (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, coach_id INTEGER NOT NULL REFERENCES venture_coaches(id) ON DELETE CASCADE, coach_type TEXT NOT NULL, is_primary BOOLEAN DEFAULT FALSE, status TEXT DEFAULT 'active', assigned_by TEXT, assignment_date TIMESTAMP DEFAULT NOW(), notes TEXT, UNIQUE(venture_id, coach_id));
CREATE INDEX IF NOT EXISTS idx_coach_assignments_venture ON venture_coach_assignments(venture_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach ON venture_coach_assignments(coach_id);
CREATE TABLE IF NOT EXISTS venture_coach_availability (id SERIAL PRIMARY KEY, coach_id INTEGER NOT NULL REFERENCES venture_coaches(id) ON DELETE CASCADE, day_of_week INTEGER, start_time TIME, end_time TIME, date DATE, is_available BOOLEAN DEFAULT TRUE, note TEXT, UNIQUE(coach_id, date, day_of_week, start_time));
CREATE INDEX IF NOT EXISTS idx_coach_availability_coach ON venture_coach_availability(coach_id);
CREATE TABLE IF NOT EXISTS venture_coach_activity (id SERIAL PRIMARY KEY, coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL, venture_id TEXT, action TEXT NOT NULL, actor_cid TEXT, details JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_coach_activity_coach ON venture_coach_activity(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_activity_venture ON venture_coach_activity(venture_id);

-- Tasks and their children. venture_tasks must exist before task_submissions,
-- task_comments, task_attachments and task_activity can reference it.
CREATE TABLE IF NOT EXISTS venture_tasks (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, milestone_id INTEGER REFERENCES venture_milestones(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'backlog', priority TEXT NOT NULL DEFAULT 'medium', due_date TIMESTAMP, estimated_hours DECIMAL(8,2), actual_hours DECIMAL(8,2), assigned_cid TEXT, assigned_name TEXT, reporter_cid TEXT, reporter_name TEXT, labels JSONB DEFAULT '[]'::jsonb, checklist JSONB DEFAULT '[]'::jsonb, display_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_tasks_venture_id ON venture_tasks(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_tasks_milestone_id ON venture_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_venture_tasks_status ON venture_tasks(status);
CREATE INDEX IF NOT EXISTS idx_venture_tasks_assigned_cid ON venture_tasks(assigned_cid);
CREATE TABLE IF NOT EXISTS venture_task_comments (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES venture_task_comments(id) ON DELETE CASCADE, author_cid TEXT NOT NULL, author_name TEXT, body TEXT NOT NULL, is_edited BOOLEAN DEFAULT FALSE, is_deleted BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON venture_task_comments(task_id);
CREATE TABLE IF NOT EXISTS venture_task_attachments (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, file_name TEXT NOT NULL, file_size BIGINT, file_type TEXT, file_url TEXT NOT NULL, uploaded_by TEXT, uploaded_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON venture_task_attachments(task_id);
CREATE TABLE IF NOT EXISTS venture_task_activity (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, venture_id TEXT NOT NULL, action TEXT NOT NULL, actor_cid TEXT, actor_name TEXT, details JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON venture_task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_venture_id ON venture_task_activity(venture_id);

-- Sessions and their children.
CREATE TABLE IF NOT EXISTS venture_sessions (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, session_type TEXT NOT NULL DEFAULT 'coaching', coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL, coach_name TEXT, founder_cid TEXT, founder_name TEXT, start_time TIMESTAMP NOT NULL, end_time TIMESTAMP NOT NULL, timezone TEXT DEFAULT 'UTC', location TEXT, meeting_link TEXT, status TEXT DEFAULT 'scheduled', agenda TEXT, recording_url TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_sessions_venture ON venture_sessions(venture_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach ON venture_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON venture_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON venture_sessions(start_time);
CREATE TABLE IF NOT EXISTS venture_session_notes (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE, note_type TEXT DEFAULT 'shared', content TEXT NOT NULL, author_cid TEXT, author_name TEXT, attachments JSONB DEFAULT '[]'::jsonb, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_session_notes_session ON venture_session_notes(session_id);
CREATE TABLE IF NOT EXISTS venture_session_attendance (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE, participant_cid TEXT NOT NULL, participant_name TEXT, participant_type TEXT, status TEXT DEFAULT 'pending', timestamp TIMESTAMP DEFAULT NOW(), UNIQUE(session_id, participant_cid));
CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON venture_session_attendance(session_id);
CREATE TABLE IF NOT EXISTS venture_session_action_items (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, owner_cid TEXT, owner_name TEXT, priority TEXT DEFAULT 'medium', due_date TIMESTAMP, status TEXT DEFAULT 'pending', completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_session_action_items_session ON venture_session_action_items(session_id);
CREATE TABLE IF NOT EXISTS venture_session_activity (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE, venture_id TEXT, action TEXT NOT NULL, actor_cid TEXT, actor_name TEXT, details JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_session_activity_session ON venture_session_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_venture ON venture_session_activity(venture_id);

-- =============================================================================
-- SECTION 2 — VENTURE TABLES DECLARED BY ensureVentureSchema()
-- =============================================================================
-- These are exactly the statements that function issues. They are repeated here
-- so the schema exists before the code is deployed instead of on the first
-- request that happens to need them.
-- -----------------------------------------------------------------------------

-- Verification workspace
CREATE TABLE IF NOT EXISTS venture_verifications (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'draft', submitted_at TIMESTAMP, reviewed_by TEXT, reviewed_at TIMESTAMP, reviewer_notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_verification_items (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, reviewed_by TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(verification_id, category));
CREATE TABLE IF NOT EXISTS venture_verification_documents (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, category TEXT NOT NULL, document_type TEXT NOT NULL, file_name TEXT NOT NULL, file_size BIGINT, file_type TEXT, file_url TEXT NOT NULL, uploaded_by TEXT, uploaded_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_verification_history (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, action TEXT NOT NULL, previous_status TEXT, new_status TEXT, actor_cid TEXT, actor_name TEXT, notes TEXT, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_verification_reviews (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, reviewer_cid TEXT NOT NULL, reviewer_name TEXT, decision TEXT NOT NULL, notes TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_verification_comments (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, author_type TEXT NOT NULL, author_cid TEXT, author_name TEXT, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW());

-- Audit and security
CREATE TABLE IF NOT EXISTS venture_audit_logs (id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, actor_cid TEXT NOT NULL, actor_name TEXT, actor_role TEXT, venture_id TEXT, entity_type TEXT, entity_id TEXT, description TEXT, metadata JSONB DEFAULT '{}'::jsonb, ip_address TEXT, user_agent TEXT, session_id TEXT, severity TEXT DEFAULT 'info', created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_event_type ON venture_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_actor ON venture_audit_logs(actor_cid);
CREATE INDEX IF NOT EXISTS idx_venture_audit_logs_created ON venture_audit_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS venture_security_events (id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, actor_cid TEXT, actor_name TEXT, target_cid TEXT, description TEXT, metadata JSONB DEFAULT '{}'::jsonb, ip_address TEXT, user_agent TEXT, country TEXT, device TEXT, browser TEXT, os TEXT, severity TEXT DEFAULT 'warning', is_resolved BOOLEAN DEFAULT FALSE, resolved_by TEXT, resolved_at TIMESTAMP, resolution_notes TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_security_events_type ON venture_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_venture_security_events_severity ON venture_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_venture_security_events_created ON venture_security_events(created_at DESC);
CREATE TABLE IF NOT EXISTS venture_trusted_devices (id SERIAL PRIMARY KEY, user_cid TEXT NOT NULL, device_name TEXT, device_type TEXT, browser TEXT, os TEXT, ip_address TEXT, fingerprint TEXT, is_trusted BOOLEAN DEFAULT FALSE, last_used_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_cid, fingerprint));
CREATE TABLE IF NOT EXISTS venture_login_history (id SERIAL PRIMARY KEY, user_cid TEXT, user_name TEXT, user_email TEXT, action TEXT NOT NULL, ip_address TEXT, user_agent TEXT, device TEXT, browser TEXT, os TEXT, country TEXT, city TEXT, is_success BOOLEAN DEFAULT TRUE, failure_reason TEXT, session_id TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_login_history_user ON venture_login_history(user_cid);
CREATE INDEX IF NOT EXISTS idx_venture_login_history_created ON venture_login_history(created_at DESC);
CREATE TABLE IF NOT EXISTS venture_failed_logins (id SERIAL PRIMARY KEY, identifier TEXT NOT NULL, ip_address TEXT, attempted_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_failed_logins_identifier ON venture_failed_logins(identifier);

-- External integrations and the public API
CREATE TABLE IF NOT EXISTS integration_providers (id SERIAL PRIMARY KEY, provider_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, icon TEXT, is_available BOOLEAN DEFAULT TRUE, config_schema JSONB, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS integration_configs (id SERIAL PRIMARY KEY, provider TEXT NOT NULL, label TEXT, venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE, config JSONB DEFAULT '{}'::jsonb, credentials_encrypted TEXT, status TEXT DEFAULT 'disconnected', last_sync_at TIMESTAMP, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(venture_id, provider));
CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_configs_venture ON integration_configs(venture_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_status ON integration_configs(status);
CREATE TABLE IF NOT EXISTS api_keys (id SERIAL PRIMARY KEY, key_id TEXT NOT NULL UNIQUE, key_hash TEXT NOT NULL, name TEXT NOT NULL, description TEXT, scopes JSONB DEFAULT '[]'::jsonb, created_by TEXT NOT NULL, expires_at TIMESTAMP, last_used_at TIMESTAMP, is_active BOOLEAN DEFAULT TRUE, allowed_ips JSONB DEFAULT '[]'::jsonb, rate_limit INTEGER DEFAULT 100, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE TABLE IF NOT EXISTS webhooks (id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, secret TEXT, events JSONB DEFAULT '[]'::jsonb, venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE, is_active BOOLEAN DEFAULT TRUE, retry_count INTEGER DEFAULT 3, timeout_ms INTEGER DEFAULT 10000, last_triggered_at TIMESTAMP, last_status TEXT, failure_count INTEGER DEFAULT 0, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_venture ON webhooks(venture_id);
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (id SERIAL PRIMARY KEY, webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE, event_type TEXT NOT NULL, payload JSONB, response_status INTEGER, response_body TEXT, duration_ms INTEGER, status TEXT DEFAULT 'pending', attempt INTEGER DEFAULT 1, error_message TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status ON webhook_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created ON webhook_delivery_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS api_usage_logs (id SERIAL PRIMARY KEY, api_key_id INTEGER, endpoint TEXT NOT NULL, method TEXT, ip_address TEXT, response_status INTEGER, duration_ms INTEGER, user_agent TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_ip ON api_usage_logs(ip_address);

-- System monitoring
CREATE TABLE IF NOT EXISTS system_health_checks (id SERIAL PRIMARY KEY, component TEXT NOT NULL, status TEXT NOT NULL, response_time_ms INTEGER, message TEXT, details JSONB DEFAULT '{}'::jsonb, checked_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_system_health_checks_component ON system_health_checks(component);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_status ON system_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked ON system_health_checks(checked_at DESC);
CREATE TABLE IF NOT EXISTS system_metrics (id SERIAL PRIMARY KEY, metric_name TEXT NOT NULL, metric_value DOUBLE PRECISION NOT NULL, unit TEXT, tags JSONB DEFAULT '{}'::jsonb, recorded_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);
CREATE TABLE IF NOT EXISTS system_alerts (id SERIAL PRIMARY KEY, alert_type TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, message TEXT, metric_name TEXT, metric_value DOUBLE PRECISION, threshold DOUBLE PRECISION, status TEXT DEFAULT 'open', acknowledged_by TEXT, acknowledged_at TIMESTAMP, resolved_by TEXT, resolved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at DESC);
CREATE TABLE IF NOT EXISTS system_reports (id SERIAL PRIMARY KEY, report_type TEXT NOT NULL, title TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, summary TEXT, data JSONB DEFAULT '{}'::jsonb, generated_by TEXT, file_url TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_system_reports_type ON system_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_system_reports_period ON system_reports(period_start, period_end);
CREATE TABLE IF NOT EXISTS job_history (id SERIAL PRIMARY KEY, job_name TEXT NOT NULL, job_type TEXT NOT NULL, status TEXT NOT NULL, started_at TIMESTAMP, completed_at TIMESTAMP, duration_ms INTEGER, payload JSONB DEFAULT '{}'::jsonb, result JSONB DEFAULT '{}'::jsonb, error_message TEXT, retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3, created_by TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_job_history_name ON job_history(job_name);
CREATE INDEX IF NOT EXISTS idx_job_history_status ON job_history(status);
CREATE INDEX IF NOT EXISTS idx_job_history_created ON job_history(created_at DESC);
CREATE TABLE IF NOT EXISTS queue_statistics (id SERIAL PRIMARY KEY, queue_name TEXT NOT NULL, current_size INTEGER DEFAULT 0, processed_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0, average_wait_ms INTEGER, average_process_ms INTEGER, recorded_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_queue_statistics_name ON queue_statistics(queue_name);
CREATE INDEX IF NOT EXISTS idx_queue_statistics_recorded ON queue_statistics(recorded_at DESC);

-- =============================================================================
-- SECTION 3 — VENTURE PROVENANCE, CONFIG, INVITATIONS AND TEMPLATES
-- =============================================================================

-- venture_origins: 1:1 CRM provenance for every venture
CREATE TABLE IF NOT EXISTS venture_origins (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE, source_type TEXT NOT NULL DEFAULT 'legacy', program_id TEXT, cohort_id TEXT, team_id TEXT, participant_cid TEXT, invited_by_cid TEXT, form_id INTEGER, run_id INTEGER, submission_id INTEGER, invitation_id INTEGER, approved_by_cid TEXT, approved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_origins_source ON venture_origins(source_type);
CREATE INDEX IF NOT EXISTS idx_venture_origins_program ON venture_origins(program_id);
CREATE INDEX IF NOT EXISTS idx_venture_origins_team ON venture_origins(team_id);

-- venture_option_values: configurable taxonomies (stages, industry/sector, ...)
CREATE TABLE IF NOT EXISTS venture_option_values (id SERIAL PRIMARY KEY, option_type TEXT NOT NULL, value TEXT NOT NULL, label TEXT, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(option_type, value));

-- platform_form_run_invitations: tracked invitations into a Venture Run
CREATE TABLE IF NOT EXISTS platform_form_run_invitations (id SERIAL PRIMARY KEY, run_id INTEGER, contact_cid TEXT, email TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'external', program_id TEXT, cohort_id TEXT, team_id TEXT, invited_by_cid TEXT, token TEXT, token_hash TEXT, expires_at TIMESTAMP, used_at TIMESTAMP, status TEXT NOT NULL DEFAULT 'sent', created_at TIMESTAMP DEFAULT NOW(), UNIQUE(token));
CREATE INDEX IF NOT EXISTS idx_run_invitations_token_hash ON platform_form_run_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_run_invitations_email ON platform_form_run_invitations(email);
CREATE INDEX IF NOT EXISTS idx_run_invitations_status ON platform_form_run_invitations(status);

-- Reusable playbook templates (Future Studio defines, Ventures execute snapshots)
CREATE TABLE IF NOT EXISTS venture_playbook_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_playbook_template_stages (id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES venture_playbook_templates(id) ON DELETE CASCADE, stage_order INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, completion_criteria TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(template_id, stage_order));
CREATE TABLE IF NOT EXISTS venture_milestone_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, expected_outcome TEXT, default_due_days INTEGER, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_task_templates (id SERIAL PRIMARY KEY, milestone_template_id INTEGER REFERENCES venture_milestone_templates(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT, requirement_type TEXT NOT NULL DEFAULT 'activity', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_playbook_stage_milestones (id SERIAL PRIMARY KEY, stage_id INTEGER NOT NULL REFERENCES venture_playbook_template_stages(id) ON DELETE CASCADE, milestone_template_id INTEGER NOT NULL REFERENCES venture_milestone_templates(id) ON DELETE CASCADE, sort_order INTEGER DEFAULT 0, UNIQUE(stage_id, milestone_template_id));

-- Per-venture playbook instance — a SNAPSHOT; template edits never rewrite it
CREATE TABLE IF NOT EXISTS venture_playbook_instances (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, template_id INTEGER NOT NULL REFERENCES venture_playbook_templates(id), assigned_by TEXT, assigned_at TIMESTAMP DEFAULT NOW(), UNIQUE(venture_id));
CREATE TABLE IF NOT EXISTS venture_playbook_instance_stages (id SERIAL PRIMARY KEY, instance_id INTEGER NOT NULL REFERENCES venture_playbook_instances(id) ON DELETE CASCADE, template_stage_id INTEGER, stage_order INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, completion_criteria TEXT, status TEXT NOT NULL DEFAULT 'locked', completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(instance_id, stage_order));

-- Task reviews (accept / reject / revision requested) with history
CREATE TABLE IF NOT EXISTS venture_task_reviews (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, reviewer_cid TEXT, reviewer_name TEXT, decision TEXT NOT NULL, comments TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_task_reviews_task ON venture_task_reviews(task_id);

-- Task submissions: append-only versions; founder submits, staff reviews.
-- Official task completion requires an approved submission when
-- venture_tasks.review_required is TRUE.
CREATE TABLE IF NOT EXISTS venture_task_submissions (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'submitted', file_url TEXT, file_name TEXT, file_type TEXT, file_size BIGINT, notes TEXT, submitted_by TEXT, submitted_by_name TEXT, reviewed_by TEXT, review_decision TEXT, review_comment TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(task_id, version));
CREATE INDEX IF NOT EXISTS idx_vts_task ON venture_task_submissions(task_id, version);

-- =============================================================================
-- SECTION 4 — THE VENTURE PERMISSION MODEL AND INTERNAL NOTES
-- =============================================================================
-- Responsibilities are configurable, contextual assignments. The stable code is
-- what assignments and the matrix use; names are editable from the UI.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venture_responsibilities (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_scope_types (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());

-- Platform GLOBAL matrix (responsibility x area x action). Permission profiles
-- belong to the RESPONSIBILITY, never to an individual Venture. Per-Venture
-- overrides are intentionally NOT part of the model.
CREATE TABLE IF NOT EXISTS venture_permission_matrix (id SERIAL PRIMARY KEY, responsibility_code TEXT NOT NULL, area TEXT NOT NULL, action TEXT NOT NULL, allowed BOOLEAN DEFAULT FALSE, updated_by TEXT, updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(responsibility_code, area, action));

-- venture_staff_assignments is the ONLY per-Venture access data (who, which
-- responsibility, which scope). A person may hold several responsibilities on
-- the same Venture, and different ones across Ventures: access is per row.
CREATE TABLE IF NOT EXISTS venture_staff_assignments (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, staff_contact_id TEXT NOT NULL, responsibility_code TEXT NOT NULL, scope_type TEXT NOT NULL DEFAULT 'venture_wide', scope_ref_type TEXT, scope_ref_id TEXT, assigned_by TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW(), removed_at TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_vsa_venture ON venture_staff_assignments(venture_id, status);
CREATE INDEX IF NOT EXISTS idx_vsa_staff ON venture_staff_assignments(staff_contact_id, status);

-- Internal Venture notes (staff-only; founders never see these)
CREATE TABLE IF NOT EXISTS venture_notes (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, author_cid TEXT, author_name TEXT, title TEXT NOT NULL, body TEXT NOT NULL, scope_ref_type TEXT, scope_ref_id TEXT, is_archived BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_venture_notes_venture ON venture_notes(venture_id, is_archived);

-- =============================================================================
-- SECTION 5 — OPERATING PLANS AND REUSABLE PLAN TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS venture_operating_plans (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, name TEXT NOT NULL, objective TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_vop_venture ON venture_operating_plans(venture_id);
CREATE TABLE IF NOT EXISTS venture_plan_sections (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES venture_operating_plans(id) ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT, instructions TEXT, sort_order INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'not_started', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_vps_plan ON venture_plan_sections(plan_id);

-- Links a plan section to existing Venture objects (milestone/task/document/session/note)
CREATE TABLE IF NOT EXISTS venture_plan_links (id SERIAL PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES venture_plan_sections(id) ON DELETE CASCADE, ref_type TEXT NOT NULL, ref_id TEXT NOT NULL, label TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(section_id, ref_type, ref_id));
CREATE INDEX IF NOT EXISTS idx_vpl_section ON venture_plan_links(section_id);
CREATE TABLE IF NOT EXISTS venture_plan_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_plan_template_sections (id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES venture_plan_templates(id) ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT, instructions TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_vpts_template ON venture_plan_template_sections(template_id);

-- =============================================================================
-- SECTION 6 — JOURNEY TEMPLATE LIBRARY AND TYPED VENTURE REPORTS
-- =============================================================================
-- Structure-only copies of a whole Venture Journey. Templates are reusable
-- blueprints, never a live view of a Venture. UUID keys on purpose.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venture_journey_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_journey_template_stages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), template_id UUID NOT NULL REFERENCES venture_journey_templates(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, objective TEXT, stage_order INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(template_id, stage_order));
CREATE TABLE IF NOT EXISTS venture_journey_template_milestones (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stage_id UUID NOT NULL REFERENCES venture_journey_template_stages(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, objective TEXT, priority TEXT DEFAULT 'medium', display_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS venture_journey_template_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), milestone_id UUID NOT NULL REFERENCES venture_journey_template_milestones(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, priority TEXT DEFAULT 'medium', labels JSONB DEFAULT '[]', checklist JSONB DEFAULT '[]', review_required BOOLEAN DEFAULT FALSE, required_deliverable_type TEXT, display_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- Typed Venture progress reports (Manager to Super Admin). A report BELONGS to a
-- journey; reporting_period-based reports stay valid and are never back-filled.
CREATE TABLE IF NOT EXISTS venture_reports (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, title TEXT NOT NULL, reporting_period TEXT, summary TEXT, current_journey TEXT, current_milestone TEXT, completed_items JSONB DEFAULT '[]'::jsonb, outstanding_items JSONB DEFAULT '[]'::jsonb, support_delivered TEXT, challenges TEXT, recommendation TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), submitted_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_venture_reports_venture ON venture_reports(venture_id, status);

-- =============================================================================
-- SECTION 7 — COLUMNS ON TABLES THAT ALREADY EXIST
-- =============================================================================
-- production already has ventures, venture_founders, venture_members,
-- venture_milestones and v2_notifications, but several of the columns the code
-- reads and writes are absent. These are additive.
-- -----------------------------------------------------------------------------
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS business_stage TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS venture_id TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES v2_programs(id);
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS origin_team_id TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMP;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS graduation_notes TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS north_star TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_status TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS social_media JSONB;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS branding JSONB;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
-- Legacy NOT NULL relaxations, GUARDED BY COLUMN (not by table): the failure mode
-- here is a missing COLUMN on a table that EXISTS. ADD COLUMN IF NOT EXISTS never
-- errors on a missing column; ALTER COLUMN ... DROP NOT NULL does, and production's
-- venture_founders predates contact_id. Both relaxations are guarded the same way.
DO $$ BEGIN
  ALTER TABLE ventures ALTER COLUMN name DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
          WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_token TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder';
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_by TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;
DO $$ BEGIN
  ALTER TABLE venture_founders ALTER COLUMN contact_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
          WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW();
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS contact_id TEXT;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'team_member';
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT 'edit';
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS invited_by TEXT;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS lead_founder BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS suspended_by TEXT;
ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS target_date TIMESTAMP;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS template_id INTEGER;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS journey_stage_id UUID;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS owner_cid TEXT;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_by TEXT;
CREATE INDEX IF NOT EXISTS idx_vm_journey_stage ON venture_milestones(journey_stage_id) WHERE journey_stage_id IS NOT NULL;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS template_id INTEGER;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS requirement_type TEXT DEFAULT 'activity';
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS review_required BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS required_deliverable_type TEXT;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS journey_stage_id UUID;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS milestone_ref TEXT;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS task_id INTEGER;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS preparation_notes TEXT;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS venture_facing BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS deliverable_id TEXT;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS materials JSONB;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS coach_contact_id TEXT;
ALTER TABLE venture_notes ADD COLUMN IF NOT EXISTS source_session_id INTEGER;
ALTER TABLE venture_notes ADD COLUMN IF NOT EXISTS attachments JSONB;
ALTER TABLE venture_reports ADD COLUMN IF NOT EXISTS journey_stage_id UUID;
ALTER TABLE venture_reports ADD COLUMN IF NOT EXISTS report_kind TEXT;
ALTER TABLE venture_responsibilities ADD COLUMN IF NOT EXISTS created_by TEXT;
-- Team promotion, GUARDED BY TABLE.
DO $$ BEGIN
  IF to_regclass('public.v2_teams') IS NOT NULL THEN
    ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT;
    ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;
  END IF;
END $$;

-- Form submission to invitation link, GUARDED BY TABLE.
DO $$ BEGIN
  IF to_regclass('public.platform_form_submissions') IS NOT NULL THEN
    ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS invitation_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_form_submissions_invitation ON platform_form_submissions(invitation_id);
  END IF;
END $$;

-- Notification entity context (drill-down) plus the template/seen/dedupe fields.
-- All nullable by design, so legacy rows and existing consumers are untouched.
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_venture_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_journey_stage_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_milestone_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_task_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_session_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS template_key TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS params JSONB;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notif_dedupe ON v2_notifications(recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- KPI library extension (formula / frequency / measurement), GUARDED BY TABLE.
DO $$ BEGIN
  IF to_regclass('public.venture_kpi_definitions') IS NOT NULL THEN
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC;
  END IF;
END $$;

-- Legacy tables. Absent on some databases; guarded so their absence is a no-op
-- instead of an abort that would take the rest of the paste with it.
DO $$ BEGIN
  IF to_regclass('public.venture_history') IS NOT NULL THEN
    ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB;
    ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.venture_activity_log') IS NOT NULL THEN
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT;
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT;
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active';
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash) WHERE token_hash IS NOT NULL;
  END IF;
-- If production already had token_hash populated with duplicates, the UNIQUE index
-- is the one guarded-statement that can still fail on its own data. Swallow it:
-- the columns above roll back with it (they are telemetry, nothing depends on them)
-- and the rest of the paste still applies.
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- =============================================================================
-- SECTION 8 — JOURNEY STAGES (the parent of a milestone) and the facilitator
-- playbook, which shares its key shape.
-- =============================================================================
-- These two are the ONLY tables in this file whose venture_id references the
-- INTERNAL ventures(id); every other Venture table keys on the TEXT
-- ventures(venture_id) code. ventures.id is NOT the same type on every database:
--   uuid    -> the Venture-OS foundation shape. venture_id follows it, with the
--              FK to ventures(id) and ON DELETE CASCADE.
--   integer -> the legacy shape (src/migrations/010_ventures.sql: id SERIAL,
--              venture_id TEXT UNIQUE). A uuid column CANNOT reference it:
--              42804 foreign key constraint cannot be implemented,
--              key columns "venture_id" and "id" ... uuid and integer.
--              So venture_id is TEXT here, with NO foreign key.
-- The code is written for the difference: it resolves ventures.id into this
-- column and always reads it back as `venture_id = ?`, and TEXT accepts both an
-- integer and a UUID, so it is the one type that works on either database.
-- Creating the tables here also turns the runtime self-healers in
-- src/lib/ventureJourneys.js, src/models/ventureJourney.js and
-- ensurePlaybookTable() into no-ops instead of silent failures.
-- -----------------------------------------------------------------------------
DO $$
DECLARE id_type text;
BEGIN
  SELECT data_type INTO id_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ventures' AND column_name = 'id';

  IF to_regclass('public.venture_journey_stages') IS NULL THEN
    IF id_type = 'uuid' THEN
      EXECUTE 'CREATE TABLE venture_journey_stages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, objective TEXT, target_date DATE, stage_order INTEGER NOT NULL, status TEXT NOT NULL DEFAULT ''locked'', completed_at TIMESTAMPTZ, approved_by TEXT REFERENCES contacts(cid), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(venture_id, stage_order))';
    ELSE
      EXECUTE 'CREATE TABLE venture_journey_stages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, target_date DATE, stage_order INTEGER NOT NULL, status TEXT NOT NULL DEFAULT ''locked'', completed_at TIMESTAMPTZ, approved_by TEXT REFERENCES contacts(cid), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(venture_id, stage_order))';
    END IF;
  END IF;

  IF to_regclass('public.venture_facilitator_playbook') IS NULL THEN
    IF id_type = 'uuid' THEN
      EXECUTE 'CREATE TABLE venture_facilitator_playbook (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, stage_order INTEGER NOT NULL, stage_name TEXT NOT NULL, objective TEXT, expected_outcome TEXT, questions TEXT, evidence TEXT, documents TEXT, mistakes TEXT, approval_criteria TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(venture_id, stage_order))';
    ELSE
      EXECUTE 'CREATE TABLE venture_facilitator_playbook (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_id TEXT NOT NULL, stage_order INTEGER NOT NULL, stage_name TEXT NOT NULL, objective TEXT, expected_outcome TEXT, questions TEXT, evidence TEXT, documents TEXT, mistakes TEXT, approval_criteria TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(venture_id, stage_order))';
    END IF;
  END IF;
END $$;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_type TEXT;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_id TEXT;

-- =============================================================================
-- SECTION 9 — PERMISSION / IDENTITY TABLES
-- =============================================================================
-- These also self-heal at runtime, but the authz bootstrap runs on the FIRST
-- authorized request — the moment PRODUCTION_TEST.md section 7 warns about.
-- Creating them here removes that failure cause instead of gambling on it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS context_role_profiles (id SERIAL PRIMARY KEY, context TEXT NOT NULL, role_key TEXT NOT NULL, profile_id INTEGER, is_active INTEGER NOT NULL DEFAULT 1, notes TEXT DEFAULT '', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(context, role_key));
CREATE INDEX IF NOT EXISTS idx_context_role_profiles_lookup ON context_role_profiles(context, role_key);
CREATE TABLE IF NOT EXISTS context_applied_grants (id SERIAL PRIMARY KEY, user_cid TEXT NOT NULL, context TEXT NOT NULL, role_key TEXT NOT NULL, source_ref TEXT, module TEXT NOT NULL, capability TEXT NOT NULL, access_level INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(user_cid, context, role_key, module, capability));
CREATE INDEX IF NOT EXISTS idx_context_applied_grants_user ON context_applied_grants(user_cid, context, role_key);
CREATE TABLE IF NOT EXISTS responsibility_capability_grants (id SERIAL PRIMARY KEY, user_cid TEXT NOT NULL, responsibility_key TEXT NOT NULL, module TEXT NOT NULL, capability TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(user_cid, responsibility_key, module, capability));
CREATE INDEX IF NOT EXISTS idx_resp_cap_grants_cid ON responsibility_capability_grants(user_cid);
CREATE UNIQUE INDEX IF NOT EXISTS responsibility_capability_grants_key ON responsibility_capability_grants (user_cid, responsibility_key, module, capability);

-- =============================================================================
-- SECTION 10 — CRM TABLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS contact_duplicate_flags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_cid_a TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE, contact_cid_b TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE, match_reason TEXT NOT NULL, confidence DECIMAL(3,2) DEFAULT 0.50, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed')), reviewed_by TEXT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(contact_cid_a, contact_cid_b));
CREATE TABLE IF NOT EXISTS contact_group_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE, family_id TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'invitation', added_by TEXT, added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(contact_cid, family_id));
CREATE INDEX IF NOT EXISTS idx_cgm_contact ON contact_group_members(contact_cid);
CREATE INDEX IF NOT EXISTS idx_cgm_family ON contact_group_members(family_id);

-- =============================================================================
-- SECTION 11 — CURRICULUM SNAPSHOT TABLE
-- =============================================================================
-- Ids are TEXT on purpose: the writer binds cids, integer requirement ids and
-- UUIDs through the same columns without casts, so a UUID-typed column would
-- reject valid writes. The historical migrations/add_submission_versions.sql
-- carries a DIFFERENT, SQLite-flavoured shape and is superseded by this one.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v2_submission_versions (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, submission_id TEXT, participant_id TEXT, deliverable_id TEXT, file_url TEXT, version INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW());

-- =============================================================================
-- SECTION 12 — SEEDS (insert only when that exact row is absent)
-- =============================================================================
-- These are reference rows the UI needs. Nothing is updated or overwritten, so
-- an administrator's edit of a label is never lost.
-- -----------------------------------------------------------------------------
INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'google_calendar', 'Google Calendar', 'Sync events and availability with Google Calendar', '{"type":"object","properties":{"client_id":{"type":"string"},"client_secret":{"type":"string"},"redirect_uri":{"type":"string"},"calendar_id":{"type":"string"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='google_calendar');
INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'google_drive', 'Google Drive', 'Access and store documents in Google Drive', '{"type":"object","properties":{"client_id":{"type":"string"},"client_secret":{"type":"string"},"redirect_uri":{"type":"string"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='google_drive');
INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'microsoft_outlook', 'Microsoft Outlook', 'Sync email, calendar and contacts with Outlook', '{"type":"object","properties":{"tenant_id":{"type":"string"},"client_id":{"type":"string"},"client_secret":{"type":"string"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='microsoft_outlook');
INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'slack', 'Slack', 'Receive notifications and updates in Slack channels', '{"type":"object","properties":{"webhook_url":{"type":"string"},"channel":{"type":"string"},"bot_token":{"type":"string"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='slack');
INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'zoom', 'Zoom', 'Create and manage Zoom meetings', '{"type":"object","properties":{"client_id":{"type":"string"},"client_secret":{"type":"string"},"account_id":{"type":"string"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='zoom');
INSERT INTO integration_providers (provider_key, name, description, config_schema) SELECT 'microsoft_teams', 'Microsoft Teams', 'Collaborate and schedule meetings via Teams', '{"type":"object","properties":{"tenant_id":{"type":"string"},"client_id":{"type":"string"},"client_secret":{"type":"string"}}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM integration_providers WHERE provider_key='microsoft_teams');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'idea', 'Idea', 1 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='idea');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'validation', 'Validation', 2 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='validation');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'mvp', 'MVP', 3 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='mvp');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'growth', 'Growth', 4 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='growth');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'business_stage', 'scale', 'Scale', 5 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='business_stage' AND value='scale');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Fintech', 'Fintech', 1 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Fintech');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Healthtech', 'Healthtech', 2 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Healthtech');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Edtech', 'Edtech', 3 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Edtech');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Cleantech', 'Cleantech', 4 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Cleantech');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'SaaS', 'SaaS', 5 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='SaaS');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'E-commerce', 'E-commerce', 6 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='E-commerce');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Agritech', 'Agritech', 7 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Agritech');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Logistics', 'Logistics', 8 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Logistics');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'AI / ML', 'AI / ML', 9 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='AI / ML');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Blockchain', 'Blockchain', 10 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Blockchain');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Media & Entertainment', 'Media & Entertainment', 11 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Media & Entertainment');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Real Estate', 'Real Estate', 12 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Real Estate');
INSERT INTO venture_option_values (option_type, value, label, sort_order) SELECT 'industry', 'Other', 'Other', 13 WHERE NOT EXISTS (SELECT 1 FROM venture_option_values WHERE option_type='industry' AND value='Other');

-- =============================================================================
-- SECTION 13 — VERIFICATION (REPORTING ONLY — NEVER EXECUTED)
-- =============================================================================
-- Run these by hand after applying. Every line starts with '--', so the runner
-- skips all of them; they are here so the check travels with the change.
--
-- 13a. Any of the 29 tables still missing? Expect zero rows.
-- SELECT t.n AS still_missing FROM (VALUES ('venture_notes'), ('venture_reports'), ('venture_sessions'), ('venture_staff_assignments'), ('venture_tasks'), ('venture_permission_matrix'), ('venture_journey_stages'), ('venture_journey_templates'), ('venture_origins'), ('venture_option_values'), ('venture_task_submissions'), ('venture_task_reviews'), ('venture_operating_plans'), ('venture_plan_sections'), ('venture_plan_links'), ('venture_playbook_templates'), ('venture_milestone_templates'), ('venture_task_templates'), ('venture_responsibilities'), ('venture_scope_types'), ('context_role_profiles'), ('context_applied_grants'), ('responsibility_capability_grants'), ('contact_duplicate_flags'), ('contact_group_members'), ('v2_submission_versions')) AS t(n) LEFT JOIN information_schema.tables i ON i.table_name = t.n AND i.table_schema = 'public' WHERE i.table_name IS NULL ORDER BY t.n;
--
-- 13b. Notification columns present? Expect 10 rows.
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'v2_notifications' AND column_name IN ('entity_venture_id','entity_journey_stage_id','entity_milestone_id','entity_task_id','entity_session_id','template_key','params','dedupe_key','seen_at','read_at') ORDER BY column_name;
--
-- 13c. Archive columns present? Expect 9 rows (3 tables x 3 columns).
-- SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('is_archived','archived_at','archived_by') AND table_name IN ('venture_milestones','venture_tasks','venture_journey_stages') ORDER BY table_name, column_name;
--
-- 13d. Seeds landed? Expect 6 providers and 18 option values.
-- SELECT count(*) AS providers FROM integration_providers;
-- SELECT option_type, count(*) FROM venture_option_values GROUP BY option_type ORDER BY option_type;
--
-- 13e. venture_milestones.id must stay integer (the code casts against it):
-- SELECT data_type FROM information_schema.columns WHERE table_name = 'venture_milestones' AND column_name = 'id';
--
-- NOT INCLUDED ON PURPOSE: the unique index idx_v2_weekly_reports_week_key.
-- It lives in migrations/align_schema_with_code.sql and it CANNOT be created
-- while duplicate (program_id, week_number, teacher_id) rows exist. Detect the
-- duplicates first using that file's section 8, resolve them by hand, then run
-- that file. Adding it here would only produce a confusing failure.
-- =============================================================================
