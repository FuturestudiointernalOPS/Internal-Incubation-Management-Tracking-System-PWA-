-- =============================================================================
-- Venture reporting — Phase 4 (ADDITIVE ONLY)
-- Seeds the studio-editable traffic-light thresholds (§11) and the reporting
-- schedule (when a month/quarter is due). No schema change: the settings table
-- already holds effective-dated, per-business-model numeric values.
--
-- Contract of scripts/db-audit/apply-schema-file.mjs: one statement per line,
-- each terminated by ';', no ';' inside string literals.
-- =============================================================================

INSERT INTO venture_stage_settings (setting_key, business_model, setting_value, value_type, effective_from) VALUES ('traffic_runway_green_months','default',9,'months','2026-11-01'), ('traffic_runway_amber_months','default',4,'months','2026-11-01'), ('traffic_growth_green_pct','default',5,'percent','2026-11-01'), ('traffic_growth_amber_pct','default',0,'percent','2026-11-01'), ('traffic_milestones_green_pct','default',80,'percent','2026-11-01'), ('traffic_milestones_amber_pct','default',50,'percent','2026-11-01'), ('reporting_monthly_due_day','default',5,'day','2026-11-01'), ('reporting_monthly_due_minute','default',540,'minute','2026-11-01'), ('reporting_quarterly_due_day','default',10,'day','2026-11-01'), ('reporting_quarterly_due_minute','default',540,'minute','2026-11-01'), ('reporting_utc_offset_minutes','default',0,'minute','2026-11-01') ON CONFLICT (setting_key, business_model, effective_from) DO NOTHING;
