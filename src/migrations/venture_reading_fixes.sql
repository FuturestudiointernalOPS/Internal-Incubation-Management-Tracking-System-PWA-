-- ─────────────────────────────────────────────────────────────────────────────
-- Ventures — the reading fixes (items 5–11 of the calculations review).
--
-- Four independent, additive changes:
--
--   5. The business reading's four thresholds (`reading_*`) move out of the
--      Reports page and into `venture_stage_settings`, beside the traffic
--      light's. Nothing is deleted; the old literals are the seed values.
--   6. A band ladder belongs to a CURRENCY. A CFA ladder cannot grade a USD
--      report, so the ladder now carries its currency.
--   7. (no schema) `womenLed` is derived from the founder records, not from a
--      headcount of employees.
--   8. (no schema) jobs are reported as created / lost / net, never as one
--      signed "created" figure.
--   9. (no schema) the verdict reports revenue growth and customer growth
--      separately.
--  10. Milestones get a real completion timestamp. Until now only `updated_at`
--      existed, which any edit moves, so "what landed in March" was unanswerable.
--  11. (no schema) a task with an approved deliverable is scored by the
--      deliverables component only.
--
-- The application applies the schema statements below at runtime
-- (`ensureVentureSchema`), idempotently. They are repeated here so a
-- deployment that sets SKIP_RUNTIME_SCHEMA_MAINTENANCE=true can migrate the
-- database itself. Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 5. The business reading's thresholds ────────────────────────────────────
INSERT INTO venture_stage_settings (setting_key, business_model, setting_value, value_type, effective_from) VALUES
 ('reading_growth_green_pct','default',5,'percent','2026-11-01'),
 ('reading_growth_red_pct','default',-2,'percent','2026-11-01'),
 ('reading_retention_floor_pct','default',50,'percent','2026-11-01'),
 ('reading_min_ltv_cac','default',3,'number','2026-11-01')
ON CONFLICT (setting_key, business_model, effective_from) DO NOTHING;

-- ── 6. Currency-aware band ladders ──────────────────────────────────────────
ALTER TABLE IF EXISTS venture_band_settings
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';

-- The old uniqueness forbids a second ladder for the same band code. Replace it
-- with the currency-aware one so a EUR ladder can sit beside the CFA ladder.
ALTER TABLE IF EXISTS venture_band_settings
  DROP CONSTRAINT IF EXISTS venture_band_settings_band_kind_band_code_effective_from_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vbs_kind_code_currency
  ON venture_band_settings (band_kind, band_code, currency, effective_from);

-- Every existing ladder was defined in the studio's base currency (the seeded
-- CFA ladder). Stamping it is what makes the filter correct rather than a guess.
UPDATE venture_band_settings
   SET currency = 'XOF'
 WHERE currency IS NULL;

-- ── 10. Milestones: a real completion timestamp ─────────────────────────────
ALTER TABLE IF EXISTS venture_milestones
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill from the best evidence available: the last time the row moved. It is
-- an approximation, so it is only written where the milestone is completed and
-- the column is still empty. A row corrected later keeps the exact stamp.
UPDATE venture_milestones
   SET completed_at = COALESCE(updated_at, NOW())
 WHERE status = 'completed'
   AND completed_at IS NULL;

-- ONE guarantee for every writer (engine, controller, bulk reconcile): whoever
-- sets status to 'completed' stamps the column, and reopening the milestone
-- clears it. Without this, a writer added later would silently lose the date.
CREATE OR REPLACE FUNCTION venture_milestones_stamp_completed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venture_milestones_completed_at ON venture_milestones;
CREATE TRIGGER trg_venture_milestones_completed_at
  BEFORE INSERT OR UPDATE ON venture_milestones
  FOR EACH ROW EXECUTE FUNCTION venture_milestones_stamp_completed_at();
