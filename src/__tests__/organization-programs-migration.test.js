const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261023_white_label_programs_foundation.sql"), "utf8")
  .replace(/--[^\n]*/g, "");

// Static contract checks only. Actual PostgreSQL application, rerun and legacy
// create tests must still be run on an explicitly isolated test database.
test("migration is additive and preserves all existing rows and constraints", () => {
  expect(sql).not.toMatch(/\b(DROP|TRUNCATE)\b|\bDELETE\s+FROM\b|\bRENAME\s+(TO|COLUMN|CONSTRAINT)\b/i);
  expect(sql).not.toMatch(/\bUPDATE\s+(?:public\.)?(?:v2_programs|user_sessions|contacts)\s+SET\b/i);
  expect(sql).not.toMatch(/\bALTER\s+COLUMN\s+\w+\s+(?:TYPE|SET\s+NOT\s+NULL)/i);
  expect(sql).not.toMatch(/ON DELETE CASCADE/i);
  expect(sql).toMatch(/ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS organization_id UUID/i);
  expect(sql).toMatch(/ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS active_organization_id UUID/i);
});

test("new role assignments cannot point at another organisation's member or role", () => {
  expect(sql).toMatch(/FOREIGN KEY \(membership_id, organization_id\)/);
  expect(sql).toMatch(/REFERENCES organization_memberships\(id, organization_id\) ON DELETE RESTRICT/);
  expect(sql).toMatch(/FOREIGN KEY \(role_id, organization_id\)/);
});

test("new organisation tables deny direct browser-role access by default", () => {
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((match) => match[1]);
  expect(tables).toHaveLength(9);
  for (const table of tables) expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  expect(sql).not.toMatch(/CREATE POLICY/i);
});

test("no client is activated or populated by the initial migration", () => {
  expect(sql).toContain("Client activation blocked: White-Label isolation not yet approved");
  expect(sql).toContain("Client programme writes blocked: White-Label isolation not yet approved");
  expect(sql).not.toMatch(/INSERT INTO v2_programs/i);
  expect(sql).not.toMatch(/INSERT INTO organization_memberships/i);
});

test("legacy programme creation keeps a platform default and no owner backfill occurs", () => {
  expect(sql).toMatch(/ALTER COLUMN organization_id\s+SET DEFAULT '00000000-0000-4000-8000-000000000001'::UUID/);
  expect(sql).toContain("Organization identity is immutable");
  expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
});

test("bounded transaction, restart-safe object creation and read-only role seeds", () => {
  expect(sql.trim()).toMatch(/^BEGIN;/);
  expect(sql.trim()).toMatch(/COMMIT;$/);
  expect(sql).toContain("SET LOCAL lock_timeout = '5s'");
  expect(sql).toContain("IF NOT EXISTS (SELECT 1 FROM pg_trigger");
  expect(sql).toContain("'programs', 'view', 1");
  expect(sql).not.toContain("'programs', 'edit'");
});

test.each(["20261029_white_label_programs_management.sql", "20261029_white_label_programs_sessions.sql"])("%s is additive and leaves the activation lock intact", (name) => {
  const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations", name), "utf8").replace(/--[^\n]*/g, "");
  expect(migration).not.toMatch(/\bDROP\b|\bDELETE\s+FROM\b|\bTRUNCATE\s+TABLE\b|\bRENAME\b/i);
  expect(migration).not.toMatch(/\bUPDATE\s+(?:public\.)?(?:v2_programs|v2_sessions|contacts|user_sessions)\s+SET\b/i);
  expect(migration).not.toMatch(/DISABLE\s+TRIGGER|session_replication_role|CREATE OR REPLACE FUNCTION wl_programs_preparation_guard/i);
  expect(migration).not.toMatch(/\('org_admin'|\('program_manager'/);
});

test("branding migration is additive, permission-gated, and keeps activation locked", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261029_white_label_branding.sql"), "utf8").replace(/--[^\n]*/g, "");
  expect(migration).not.toMatch(/\bDROP\b|\bDELETE\s+FROM\b|\bTRUNCATE\s+TABLE\b|\bRENAME\b/i);
  expect(migration).toMatch(/'org_admin',\s*'organization_admin',\s*'branding\.edit',\s*3/);
  expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS organization_branding/);
  expect(migration).toMatch(/ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY/);
  expect(migration).toMatch(/wl_audit_branding_change/);
  expect(migration).not.toMatch(/DISABLE\s+TRIGGER|session_replication_role|DROP TRIGGER/i);
  expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION wl_programs_preparation_guard/i);
});
