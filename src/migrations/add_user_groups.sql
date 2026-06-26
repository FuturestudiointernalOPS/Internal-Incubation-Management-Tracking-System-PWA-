-- Add user_groups table for multi-group membership
-- Compatible with existing single group_name column on contacts

CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    role_in_group TEXT DEFAULT 'member',
    assigned_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_cid, group_name)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_cid ON user_groups(user_cid);
CREATE INDEX IF NOT EXISTS idx_user_groups_name ON user_groups(group_name);
