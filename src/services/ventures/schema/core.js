/**
 * Core venture records — ventures, founders, members and their history.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// Ventures table columns
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS company_name TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_number TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS industry TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS business_stage TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS description TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS website TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS logo_url TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS created_by TEXT",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
"ALTER TABLE ventures ADD COLUMN IF NOT EXISTS venture_id TEXT",
// Venture founders columns
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS phone TEXT",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS title TEXT",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_token TEXT",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS email TEXT",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS name TEXT",
// Missing venture_founders columns
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
// Legacy column fixes
"ALTER TABLE venture_founders ALTER COLUMN contact_id DROP NOT NULL",
// Venture members columns
"ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW()",
// Ensure name column is nullable (legacy constraint issue)
"ALTER TABLE ventures ALTER COLUMN name DROP NOT NULL",
// Fix missing venture_history columns
"ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB",
"ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT",
// Fix missing venture_activity_log columns
"ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT",
"ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT",
"ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB",
// Founder management columns
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder'",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_by TEXT",
"ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP",
];
