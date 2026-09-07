-- Venture OS — Sprint 3, Track 1 (Venture Foundation & Business Profile)
-- Root schema for the whole Venture OS chain. Tracks 2-5 depend on ventures.id
-- and venture_members existing with these shapes — do not rename columns
-- without coordinating with the other four Sprint 3 tracks.

CREATE TABLE IF NOT EXISTS ventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | graduated | archived
  description TEXT,
  mission TEXT,
  vision TEXT,
  industry TEXT,
  sector TEXT,
  business_stage TEXT NOT NULL DEFAULT 'idea', -- idea | validation | mvp | growth | scale
  website TEXT,
  social_media JSONB DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private', -- private | public | invite_only
  branding JSONB DEFAULT '{}',
  language TEXT DEFAULT 'en',
  program_id UUID REFERENCES v2_programs(id), -- Program OS program this venture originated from
  origin_team_id TEXT REFERENCES v2_teams(id), -- optional bridge to the v2_teams squad that formed this venture
  is_archived INTEGER NOT NULL DEFAULT 0,
  graduated_at TIMESTAMPTZ,
  graduation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_members (
  id SERIAL PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(cid),
  member_type TEXT NOT NULL DEFAULT 'team_member', -- founder | team_member
  role TEXT, -- e.g. CEO/CTO for founders, Developer/Designer for team members
  permissions TEXT NOT NULL DEFAULT 'edit', -- edit | read
  invited_by TEXT REFERENCES contacts(cid),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ, -- soft delete: preserves team-formation history (ticket 1.7)
  UNIQUE(venture_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_venture_members_venture ON venture_members(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_members_contact ON venture_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_ventures_program ON ventures(program_id);
