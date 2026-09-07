-- =============================================================================
-- MODULE 2 — COLLECTIONS & ORGANIZATION
-- Reusable organizational containers for all Platform assets.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_collections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER REFERENCES platform_collections(id) ON DELETE SET NULL,
  owner_id TEXT,
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'public', 'restricted')),
  tags TEXT[],
  category TEXT,
  icon TEXT DEFAULT 'FolderKanban',
  color TEXT DEFAULT '#FF6600',
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prevents circular parent references
CREATE INDEX IF NOT EXISTS idx_collections_parent ON platform_collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON platform_collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_status ON platform_collections(status);
CREATE INDEX IF NOT EXISTS idx_collections_owner ON platform_collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_tags ON platform_collections USING GIN(tags);

-- =============================================================================
-- COLLECTION ASSETS — Links Platform assets (Forms, Assessments, etc.) to Collections
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_collection_assets (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES platform_collections(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  added_by TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(collection_id, asset_type, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_assets_collection ON platform_collection_assets(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_assets_asset ON platform_collection_assets(asset_type, asset_id);

-- =============================================================================
-- AUDIT LOG — Track all Collection activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_collection_audit (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES platform_collections(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_audit_collection ON platform_collection_audit(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_audit_created ON platform_collection_audit(created_at);
