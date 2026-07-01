-- =============================================================================
-- Finance Module Schema (Ticket 0)
-- Tables for budget tracking, transaction ledger, data source management,
-- and sync audit trail.
-- =============================================================================

-- 1. DATA SOURCES
-- Tracks external sheet URLs and sync metadata (Google Sheets, Excel, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'google_sheets',
    source_url TEXT,
    fiscal_year TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50) DEFAULT 'pending'
        CHECK (last_sync_status IN ('success', 'failed', 'pending')),
    last_sync_error TEXT,
    sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. FINANCE PROGRAMS (Lookup Table)
-- Maps budget codes (FS001–FS017) to program names
-- =============================================================================
CREATE TABLE IF NOT EXISTS finance_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. BUDGET LINES
-- Annual budget allocations per program per data source
-- =============================================================================
CREATE TABLE IF NOT EXISTS finance_budget_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES finance_programs(id) ON DELETE CASCADE,
    planned_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
    fiscal_year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (data_source_id, program_id, fiscal_year)
);

-- 4. TRANSACTIONS (Single source of truth)
-- Individual expense / revenue records
-- =============================================================================
CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    program_id UUID REFERENCES finance_programs(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    supplier_client TEXT DEFAULT '',
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    budget_code VARCHAR(10),
    type VARCHAR(10) NOT NULL DEFAULT 'expense'
        CHECK (type IN ('expense', 'revenue')),
    amount NUMERIC(15,0) NOT NULL DEFAULT 0,
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ft_data_source_id
    ON finance_transactions(data_source_id);
CREATE INDEX IF NOT EXISTS idx_ft_date
    ON finance_transactions(date);
CREATE INDEX IF NOT EXISTS idx_ft_program_id
    ON finance_transactions(program_id);
CREATE INDEX IF NOT EXISTS idx_ft_type
    ON finance_transactions(type);
CREATE INDEX IF NOT EXISTS idx_ft_ds_date
    ON finance_transactions(data_source_id, date);
CREATE INDEX IF NOT EXISTS idx_ft_archived
    ON finance_transactions(archived);

-- 5. SYNC LOG (Audit trail)
-- Tracks every sync operation for audit
-- =============================================================================
CREATE TABLE IF NOT EXISTS finance_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL DEFAULT 'manual'
        CHECK (sync_type IN ('manual', 'cli')),
    started_at TIMESTAMP WITH TIME ZONE
        NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('success', 'failed', 'partial')),
    rows_inserted INTEGER DEFAULT 0,
    rows_updated INTEGER DEFAULT 0,
    error_message TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE
        DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fsl_data_source_id
    ON finance_sync_log(data_source_id);
CREATE INDEX IF NOT EXISTS idx_fsl_status
    ON finance_sync_log(status);

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Seed finance_programs (FS001–FS017)
INSERT INTO finance_programs (code, name) VALUES
    ('FS001',  'Corporate Entrepreneurship Lab'),
    ('FS002',  'MTN Innovation Lab'),
    ('FS003',  'Sème City'),
    ('FS004',  'Future Academy'),
    ('FS005',  'Digital Skills Program'),
    ('FS006',  'AgriTech Incubation'),
    ('FS007',  'Creative Industries Lab'),
    ('FS008',  'HealthTech Accelerator'),
    ('FS009',  'Green Energy Program'),
    ('FS010',  'FinTech Sandbox'),
    ('FS011',  'Women in Tech'),
    ('FS012',  'Youth Employment Program'),
    ('FS013',  'EdTech Innovation'),
    ('FS014',  'Smart City Lab'),
    ('FS015',  'Manufacturing 4.0'),
    ('FS016',  'Tourism & Hospitality'),
    ('FS017',  'General Operations & Overhead')
ON CONFLICT (code) DO NOTHING;

-- Seed external data source (Google Sheets)
INSERT INTO data_sources (name, source_type, source_url, fiscal_year, status)
VALUES (
    '2025-2026 Budget (Google Sheets)',
    'google_sheets',
    'https://docs.google.com/spreadsheets/d/1h37lmF2HIqhWVZq4MwTuT72SHYVNeNcQ/export?format=xlsx',
    '2025-2026',
    'active'
) ON CONFLICT DO NOTHING;

-- Seed internal data source (manually entered transactions)
INSERT INTO data_sources (name, source_type, fiscal_year, status)
VALUES (
    'Internal Transactions',
    'internal',
    'ongoing',
    'active'
) ON CONFLICT DO NOTHING;
