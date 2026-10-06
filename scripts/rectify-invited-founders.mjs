/**
 * Rectify invited founders: founder identity + one lead per Venture.
 *
 * Mirrors the invite-acceptance fix in `models/ventureMemberInvitations.js` for
 * memberships that already exist:
 *
 *   1. An active FOUNDER member whose stored role is a baseline/guest one
 *      (member / applicant / empty) becomes `role = 'founder'`. A role that
 *      gates another surface (facilitator, program_manager, …) is NEVER touched
 *      — that person gets founder access through the venture context instead.
 *   2. Any Venture with active founder members but NO lead/owner gets its
 *      earliest founder as lead_founder + is_owner. An existing lead is never
 *      demoted.
 *
 *   node scripts/rectify-invited-founders.mjs            # dry run
 *   node scripts/rectify-founders.mjs --apply            # write
 *   node scripts/rectify-founders.mjs --apply --env=staging
 *
 * Default target is production (.env.local) — the environment where the invited
 * founders live. Before-image written to scratch/.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const ENV_KEY = (process.argv.find((a) => a.startsWith("--env=")) || "").split("=")[1] || "production";
const ENV_FILE = ENV_KEY === "staging" ? ".env.audit-staging" : ".env.local";

// Same list as models/ventureMemberInvitations.js
const ROLES_NEVER_OVERWRITTEN = [
  "super_admin", "staff", "admin", "program_manager", "facilitator",
  "participant", "investor", "mentor", "teacher", "developer", "finance", "crm",
];

const readUrl = (f) =>
  readFileSync(f, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const pool = new pg.Pool({
  connectionString: readUrl(ENV_FILE),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
const q = (sql, args = []) => pool.query(sql, args);

console.log(`[rectify-founders] env=${ENV_KEY} (${ENV_FILE}) mode=${APPLY ? "APPLY" : "DRY RUN"}\n`);

// ── 1. Founder memberships whose identity is not founder (and is safe to set) ──
const ph = ROLES_NEVER_OVERWRITTEN.map((_, i) => `$${i + 1}`).join(", ");
const identityTargets = (
  await q(
    `SELECT c.cid, c.name, c.email, c.role AS current_role, vm.venture_id
       FROM venture_members vm
       JOIN contacts c ON c.cid = vm.contact_id OR c.cid = vm.user_cid
      WHERE vm.member_type = 'founder' AND vm.removed_at IS NULL
        AND COALESCE(c.role, '') NOT IN (${ph})
        AND c.role IS DISTINCT FROM 'founder'
      ORDER BY vm.venture_id`,
    ROLES_NEVER_OVERWRITTEN,
  )
).rows;

// ── 2. Founder memberships blocked by a role that gates another surface ───────
const blockedByRole = (
  await q(
    `SELECT c.cid, c.name, c.email, c.role AS current_role, vm.venture_id,
            (SELECT COUNT(*)::int FROM feature_eligibility fe
              WHERE fe.identity_type='role' AND fe.identity_value = c.role
                AND fe.feature_key = 'ventures' AND fe.eligible = 1) AS ventures_eligible
       FROM venture_members vm
       JOIN contacts c ON c.cid = vm.contact_id OR c.cid = vm.user_cid
      WHERE vm.member_type = 'founder' AND vm.removed_at IS NULL
        AND COALESCE(c.role, '') IN (${ph})
      ORDER BY vm.venture_id`,
    ROLES_NEVER_OVERWRITTEN,
  )
).rows;

// ── 3. Ventures with active founders but no lead/owner ───────────────────────
const ownerTargets = (
  await q(
    `SELECT v.venture_id, v.company_name,
            (SELECT m.id FROM venture_members m
              WHERE m.venture_id = v.venture_id AND m.removed_at IS NULL
                AND m.member_type = 'founder'
              ORDER BY m.joined_at ASC NULLS LAST, m.id ASC LIMIT 1) AS founder_member_id,
            (SELECT c.email FROM venture_members m
              JOIN contacts c ON c.cid = m.contact_id OR c.cid = m.user_cid
              WHERE m.venture_id = v.venture_id AND m.removed_at IS NULL
                AND m.member_type = 'founder'
              ORDER BY m.joined_at ASC NULLS LAST, m.id ASC LIMIT 1) AS founder_email
       FROM ventures v
      WHERE NOT EXISTS (
        SELECT 1 FROM venture_members o
         WHERE o.venture_id = v.venture_id AND o.removed_at IS NULL
           AND (o.lead_founder = TRUE OR o.is_owner = TRUE))
        AND EXISTS (
        SELECT 1 FROM venture_members f
         WHERE f.venture_id = v.venture_id AND f.removed_at IS NULL
           AND f.member_type = 'founder')
      ORDER BY v.created_at DESC`,
  )
).rows;

console.log(`identity to promote to 'founder': ${identityTargets.length}`);
for (const t of identityTargets) console.log(`  + ${t.email} (${t.current_role || "no role"}) → founder · ${t.venture_id}`);
console.log(`\nfounders whose role is PROTECTED (need context access, not a role rewrite): ${blockedByRole.length}`);
for (const t of blockedByRole)
  console.log(`  ~ ${t.email} role=${t.current_role} ventures_eligible=${t.ventures_eligible} · ${t.venture_id}`);
console.log(`\nventures to receive a lead/owner: ${ownerTargets.length}`);
for (const t of ownerTargets) console.log(`  + ${t.company_name} (${t.venture_id}) → ${t.founder_email}`);

if (!APPLY) {
  console.log("\n[dry run] nothing written. Re-run with --apply to execute.");
  await pool.end();
  process.exit(0);
}

// ── Before-image ─────────────────────────────────────────────────────────────
try {
  mkdirSync("scratch", { recursive: true });
  const path = `scratch/rectify-founders-before-image-${ENV_KEY}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      {
        env: ENV_KEY,
        capturedAt: new Date().toISOString(),
        identity_contacts: (
          await q(
            `SELECT cid, email, role FROM contacts WHERE cid = ANY($1::text[])`,
            [identityTargets.map((t) => t.cid)],
          )
        ).rows,
        owner_memberships: (
          await q(
            `SELECT id, venture_id, contact_id, user_cid, member_type, role, lead_founder, is_owner
               FROM venture_members WHERE id = ANY($1::int[])`,
            [ownerTargets.map((t) => t.founder_member_id).filter(Boolean)],
          )
        ).rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nbefore-image → ${path}`);
} catch (e) {
  console.log(`\nbefore-image failed: ${e.message}`);
}

// ── Apply ────────────────────────────────────────────────────────────────────
await q("BEGIN");
try {
  let roles = 0;
  for (const t of identityTargets) {
    const r = await q(
      `UPDATE contacts SET role = 'founder' WHERE cid = $1 AND role IS DISTINCT FROM 'founder'`,
      [t.cid],
    );
    roles += r.rowCount;
  }
  let owners = 0;
  for (const t of ownerTargets) {
    if (!t.founder_member_id) continue;
    const r = await q(
      `UPDATE venture_members
          SET lead_founder = TRUE, is_owner = TRUE, member_type = 'founder', role = 'founder'
        WHERE id = $1
          AND NOT EXISTS (
            SELECT 1 FROM venture_members o
             WHERE o.venture_id = $2 AND o.removed_at IS NULL
               AND (o.lead_founder = TRUE OR o.is_owner = TRUE))`,
      [t.founder_member_id, t.venture_id],
    );
    owners += r.rowCount;
  }
  await q(
    `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
     VALUES ('system','system','system','system','role_changed',$1)`,
    [
      `Invited-founder rectification (${ENV_KEY}): promoted ${roles} contact role(s) to 'founder' and gave ${owners} Venture(s) their lead/owner seat.`,
    ],
  );
  await q("COMMIT");
  console.log(`\napplied: ${roles} contact role(s) → founder, ${owners} venture lead(s) set.`);
} catch (e) {
  await q("ROLLBACK");
  console.error(`\nFAILED (rolled back): ${e.message}`);
  await pool.end();
  process.exit(1);
}

// ── After-state ──────────────────────────────────────────────────────────────
console.log("\n=== after ===");
const after = (
  await q(
    `SELECT v.venture_id, v.company_name,
            (SELECT COUNT(*)::int FROM venture_members m
              WHERE m.venture_id = v.venture_id AND m.removed_at IS NULL) AS members,
            (SELECT COUNT(*)::int FROM venture_members m
              WHERE m.venture_id = v.venture_id AND m.removed_at IS NULL
                AND (m.lead_founder = TRUE OR m.is_owner = TRUE)) AS owners
       FROM ventures v ORDER BY v.created_at DESC LIMIT 10`,
  )
).rows;
for (const r of after) console.log(`  ${r.company_name} (${r.venture_id}): members=${r.members} owners=${r.owners}`);

await pool.end();
console.log("\n[done]");
