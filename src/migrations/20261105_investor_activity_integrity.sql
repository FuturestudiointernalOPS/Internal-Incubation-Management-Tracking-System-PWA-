-- Phase 1 follow-up to migrations/investor_os_expansion.sql.
-- Additive only: no retyping UUID/BIGINT columns, no historical backfill/deletion.
-- Canonical references are recorded in server-owned metadata by activityLog.js.
-- Review and apply explicitly to the confirmed test target; never from a request.
BEGIN;
CREATE OR REPLACE FUNCTION investor_activity_reject_mutation_v1()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Investor activity records are append-only';
END;
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'investor_activity_log'::regclass
                   AND tgname = 'investor_activity_no_update_delete_v1') THEN
    CREATE TRIGGER investor_activity_no_update_delete_v1
    BEFORE UPDATE OR DELETE ON investor_activity_log
    FOR EACH ROW EXECUTE FUNCTION investor_activity_reject_mutation_v1();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'investor_activity_log'::regclass
                   AND tgname = 'investor_activity_no_truncate_v1') THEN
    CREATE TRIGGER investor_activity_no_truncate_v1
    BEFORE TRUNCATE ON investor_activity_log
    FOR EACH STATEMENT EXECUTE FUNCTION investor_activity_reject_mutation_v1();
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_investor_activity_rolling_view_v1
  ON investor_activity_log (actor_id, venture_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_activity_canonical_ref_v1
  ON investor_activity_log ((metadata->>'investor_ref'), occurred_at DESC);
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
VALUES ('investor_time_to_close_start', 'first_introduction_request', 'string', 'investment',
        'Start event for time-to-close; applied when the metric calculation supports it')
ON CONFLICT (setting_key) DO NOTHING;
COMMIT;
