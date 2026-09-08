-- =============================================================================
-- MAKE REVIEW DECISIONS CONFIGURABLE
-- Removes the hardcoded CHECK constraint so administrators can define
-- workflow-specific decisions per form (e.g., Interview, Funded, Admitted).
-- =============================================================================

-- Drop the old constraint and add a more permissive one
ALTER TABLE platform_submission_reviews 
  DROP CONSTRAINT IF EXISTS platform_submission_reviews_decision_check;

-- Re-add with a note-only constraint (accepts any reasonable decision label)
ALTER TABLE platform_submission_reviews 
  ADD CONSTRAINT platform_submission_reviews_decision_check 
  CHECK (decision IS NOT NULL AND char_length(decision) > 0);

-- Also make submission statuses flexible for workflow-defined states
-- Keep the core states but allow workflow-specific labels to be stored
ALTER TABLE platform_form_submissions
  DROP CONSTRAINT IF EXISTS platform_form_submissions_status_check;

ALTER TABLE platform_form_submissions
  ADD CONSTRAINT platform_form_submissions_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'revision_requested'));
