-- Minimal synthetic workspace schema, never an application migration.
ALTER TABLE contacts ADD COLUMN phone TEXT, ADD COLUMN group_name TEXT,
  ADD COLUMN created_at TIMESTAMPTZ, ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN archived_at TIMESTAMPTZ, ADD COLUMN v2_team_id UUID;
ALTER TABLE v2_knowledge_bank ADD COLUMN url TEXT, ADD COLUMN description TEXT;
CREATE TABLE v2_knowledge_attachments (id UUID, note_id UUID, name TEXT, url TEXT);
CREATE TABLE participant_programs (participant_id TEXT, program_id UUID,
  screening_status TEXT, accepted_at TIMESTAMPTZ, assigned_at TIMESTAMPTZ);
CREATE TABLE v2_program_staff (id UUID, program_id UUID, staff_id TEXT, role TEXT);
CREATE TABLE v2_teams (id UUID, program_id UUID, name TEXT, handler_name TEXT);
CREATE TABLE v2_events (id UUID, program_id UUID);
CREATE TABLE v2_kpis (id UUID, program_id UUID);
CREATE TABLE v2_document_requirements (id UUID, program_id UUID, title TEXT, week_number INTEGER, is_completed INTEGER DEFAULT 0);
CREATE TABLE v2_followups (id UUID, program_id UUID, created_at TIMESTAMPTZ);
CREATE TABLE v2_submissions (id UUID, program_id UUID, participant_id TEXT,
  deliverable_id UUID, requirement_id UUID, submission_url TEXT, status TEXT,
  submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ);
CREATE TABLE v2_weekly_reports (id UUID, program_id UUID, week_number INTEGER);
CREATE TABLE families (id UUID, program_id UUID);
CREATE TABLE v2_deliverables (id UUID, program_id UUID, week_number INTEGER);
CREATE TABLE kpi_progress (kpi_id UUID, program_id UUID);
CREATE TABLE v2_attendance (program_id UUID, participant_id TEXT, status TEXT, date DATE, week_number INTEGER);
ALTER TABLE v2_programs ADD COLUMN grading_mode TEXT;
