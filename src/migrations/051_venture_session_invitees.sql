-- =============================================================================
-- IMPACTOS — VENTURE SESSION INVITEES
-- The people a session is announced to by e-mail (on ImpactOS or not).
-- =============================================================================

-- An invitee is NOT an attendance row: attendance records who showed up and
-- needs an account. An invitee is any e-mail the session is sent to.
-- `contact_cid` is filled when that e-mail belongs to an account, so the
-- session can also reach the person's calendar; NULL for an outside guest.
CREATE TABLE IF NOT EXISTS venture_session_invitees (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    contact_cid TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
);

-- One invite per address per session (case-insensitive), so re-adding an
-- address updates the row instead of duplicating the invitation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_venture_session_invitees_email
    ON venture_session_invitees(session_id, LOWER(email));

CREATE INDEX IF NOT EXISTS idx_venture_session_invitees_contact
    ON venture_session_invitees(contact_cid) WHERE contact_cid IS NOT NULL;
