-- Assessment-level question type.
--
-- The question type (multiple_choice | true_false) is now chosen when the
-- assessment is CREATED, instead of per question. Every question added to an
-- assessment inherits this type, so the type is stored on lms_assessments.

ALTER TABLE lms_assessments
    ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice'
        CHECK (question_type IN ('multiple_choice', 'true_false'));

-- Backfill existing assessments that only ever received true_false questions;
-- empty and mixed assessments keep the multiple_choice default.
UPDATE lms_assessments a
SET question_type = 'true_false'
WHERE EXISTS (
        SELECT 1 FROM lms_assessment_questions q
        WHERE q.assessment_id = a.id AND q.question_type = 'true_false'
      )
  AND NOT EXISTS (
        SELECT 1 FROM lms_assessment_questions q
        WHERE q.assessment_id = a.id AND q.question_type = 'multiple_choice'
      );

CREATE INDEX IF NOT EXISTS idx_lms_assessments_question_type ON lms_assessments(question_type);
