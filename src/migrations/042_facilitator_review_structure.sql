-- =============================================================================
-- 042 — STRUCTURED WEEKLY FACILITATOR REVIEW
-- -----------------------------------------------------------------------------
-- Additive, idempotent migration. Turns the free-form facilitator review into a
-- short, structured weekly check-in while preserving the existing review row,
-- PM decision workflow, and legacy free-form columns (never dropped).
--
-- New structured columns:
--   overall_rating        'excellent' | 'good' | 'okay' | 'difficult'
--   went_well             short text
--   struggles             short text (what participants struggled with)
--   engagement            'high' | 'moderate' | 'low' | 'concerning'
--   needs_attention_type  'nothing' | 'participant' | 'group' | 'attendance'
--                         | 'session' | 'assignment' | 'other'
--   needs_attention_note  brief explanation when an issue is selected
--   focus_next_week       short text
--   additional_notes      optional short text
-- =============================================================================

BEGIN;

ALTER TABLE program_facilitator_reviews
    ADD COLUMN IF NOT EXISTS overall_rating TEXT,
    ADD COLUMN IF NOT EXISTS went_well TEXT,
    ADD COLUMN IF NOT EXISTS struggles TEXT,
    ADD COLUMN IF NOT EXISTS engagement TEXT,
    ADD COLUMN IF NOT EXISTS needs_attention_type TEXT,
    ADD COLUMN IF NOT EXISTS needs_attention_note TEXT,
    ADD COLUMN IF NOT EXISTS focus_next_week TEXT,
    ADD COLUMN IF NOT EXISTS additional_notes TEXT;

COMMIT;
