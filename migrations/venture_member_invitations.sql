-- =============================================================================
-- VENTURE MEMBER INVITATIONS
-- A founder adds a member to their Venture by EMAIL: the add creates a PENDING
-- invitation and emails a link. The person joins only after accepting it.
--
-- Apply manually in the Supabase SQL editor, OR rely on the idempotent runtime
-- self-healing (src/models/ventureMemberInvitations.js and
-- src/lib/ventures.js ensureVentureSchema) which issues the same statements.
-- Safe to run multiple times. Nothing is dropped.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_member_invitations (
  id SERIAL PRIMARY KEY,
  venture_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  member_type TEXT NOT NULL DEFAULT 'team_member',
  role TEXT,
  contact_id TEXT,
  invited_by TEXT,
  token TEXT,
  token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vmi_token_hash
  ON venture_member_invitations(token_hash) WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vmi_venture_status
  ON venture_member_invitations(venture_id, status);

CREATE INDEX IF NOT EXISTS idx_vmi_email
  ON venture_member_invitations(LOWER(email));
