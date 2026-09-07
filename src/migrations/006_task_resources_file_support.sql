-- Ticket 1.8: File attachment support for task_resources. Idempotent.
ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'url' CHECK (type IN ('url','file'));
ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
