-- =============================================================================
-- MODULE 3 — INTELLIGENT FORMS
-- Reusable form builder engine for all Platform processes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_forms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  collection_id INTEGER REFERENCES platform_collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'public', 'restricted')),
  version INTEGER NOT NULL DEFAULT 1,
  settings JSONB DEFAULT '{}',
  created_by TEXT,
  owner_id TEXT,
  owner_name TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_collection ON platform_forms(collection_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON platform_forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_tags ON platform_forms USING GIN(tags);

-- =============================================================================
-- FORM SECTIONS — Logical grouping of fields within a form
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_form_sections (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_sections_form ON platform_form_sections(form_id);

-- =============================================================================
-- FORM FIELDS — Individual input fields with validation, logic, and metadata
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_form_fields (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES platform_form_sections(id) ON DELETE SET NULL,
  field_type TEXT NOT NULL DEFAULT 'text'
    CHECK (field_type IN (
      'text', 'textarea', 'number', 'email', 'phone', 'date', 'time',
      'select', 'radio', 'checkbox', 'multiselect', 'file', 'url',
      'rating', 'currency', 'signature', 'richtext', 'hidden'
    )),
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT,
  options JSONB,           -- For select/radio/checkbox: [{label, value}]
  validation JSONB DEFAULT '{}',  -- {min, max, pattern, minLength, maxLength, acceptedFiles, maxSize}
  conditional_logic JSONB,  -- {field_id, operator, value} → show this field only if condition matches
  calculation TEXT,         -- Expression for calculated fields
  sort_order INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_fields_form ON platform_form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_section ON platform_form_fields(section_id);

-- =============================================================================
-- FORM VERSIONS — Preserve historical versions of forms
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_form_versions (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,  -- Full snapshot of form structure at this version
  published_at TIMESTAMP,
  published_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(form_id, version)
);

CREATE INDEX IF NOT EXISTS idx_form_versions_form ON platform_form_versions(form_id);
