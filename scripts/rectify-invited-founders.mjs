/**
 * Rectify invited founders — the two things that were wrong.
 *
 * THE MODEL (owner decision): accepting an invitation makes the person a
 * baseline MEMBER. What they are inside a Venture is the MEMBERSHIP
 * (`venture_members.member_type`), never the stored identity. So a founder is a
 * member who holds the founder context of the Venture they were invited into.
 *
 *   1. IDENTITY — anyone whose stored role is `founder` *because* they are a
 *      founder of a Venture is normalised to `member`. Only people with an
 *      active founder membership are touched: a `founder` with no membership is
 *      left alone (nothing here explains it).
 *   2. LEAD SEAT — a Venture with active founder members but NO lead/owner gets
 *      its earliest founder as lead_founder + is_owner. An existing lead is
 *      never demoted. (This is a property of the membership, not the identity.)
 *
 *   node scripts/rectify-invited-founders.mjs            # dry run
 *   node scripts/rectify-invited-founders.mjs --apply
 *   node scripts/rectify-invited-founders.mjs --apply --env=staging
 *
 * Default target is production (.env.local). Before-image written to scratch/.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const ENV_KEY = (process.argv.find((a) => a.startsWith("--env=")) || "").split("=")[1] || "production";
const ENV_FILE = ENV_KEY === "staging" ? ".env.audit-staging" : ".env.local";

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

// ── 1. `role = 'founder'` explained by a Venture membership → member ──────────
const identityTargets = (
  await q(
    `SELECT c.cid, c.name, c.email, c.role AS current_role,
            (SELECT COUNT(*)::int FROM venture_members m
              WHERE (m.contact_id = c.cid OR m.user_cid = c.cid)
                AND m.removed_at IS NULL AND m.member_type = 'founder') AS founder_of
       FROM contacts c
      WHERE c.role = 'founder'
        AND EXISTS (SELECT 1 FROM venture_members m
                     WHERE (m.contact_id = c.cid OR m.user_cid = c.cid)
                       AND m.removed_at IS NULL AND m.member_type = 'founder')
      ORDER BY c.created_at DESC`,
  )
).rows;

// ── 2. Ventures with active founders but no lead/owner ───────────────────────
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

console.log(`identities to normalise founder → member: ${identityTargets.length}`);
for (const t of identityTargets) console.log(`  · ${t.email} (founder of ${t.founder_of} venture(s))`);

console.log(`\nventures to receive a lead/owner: ${ownerTargets.length}`);
for (const t of ownerTargets) console.log(`  + ${t.company_name} (${t.venture_id}) → ${t.founder_email}`);

if (!APPLY) {
  console.log("\n[dry run] nothing written. Re-run with --apply to execute.");
  await pool.end();
  process.exit(0);
}

try {
  mkdirSync("scratch", { recursive: true });
  const path = `scratch/rectify-founders-before-image-${ENV_KEY}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      {
        env: ENV_KEY,
        capturedAt: new Date().toISOString(),
        note: "roles as they were BEFORE normalising to member; memberships before the lead seat was set",
        identity_contacts: (
          await q(`SELECT cid, email, role FROM contacts WHERE cid = ANY($1::text[])`, [
            identityTargets.map((t) => t.cid),
          ])
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

await q("BEGIN");
try {
  let identities = 0;
  for (const t of identityTargets) {
    const r = await q(`UPDATE contacts SET role = 'member' WHERE cid = $1 AND role = 'founder'`, [t.cid]);
    identities += r.rowCount;
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
      `Invited-founder rectification (${ENV_KEY}): normalised ${identities} contact role(s) founder → member (the founder role belongs to the venture membership, not the identity) and gave ${owners} Venture(s) their lead/owner seat.`,
    ],
  );
  await q("COMMIT");
  console.log(`\napplied: ${identities} identity/ies founder → member, ${owners} venture lead(s) set.`);
} catch (e) {
  await q("ROLLBACK");
  console.error(`\nFAILED (rolled back): ${e.message}`);
  await pool.end();
  process.exit(1);
}

console.log("\n=== after ===");
const after = (
  await q(
    `SELECT c.email, c.role,
            (SELECT COUNT(*)::int FROM venture_members m
              WHERE (m.contact_id = c.cid OR m.user_cid = c.cid) AND m.removed_at IS NULL
                AND m.member_type = 'founder') AS founder_of
       FROM contacts c WHERE c.cid = ANY($1::text[]) ORDER BY c.email`,
    [identityTargets.map((t) => t.cid)],
  )
).rows;
for (const r of after) console.log(`  ${r.email}: role=${r.role}, founder of ${r.founder_of} venture(s)`);
const owners = (
  await q(
    `SELECT v.company_name,
            (SELECT COUNT(*)::int FROM venture_members m
              WHERE m.venture_id = v.venture_id AND m.removed_at IS NULL
                AND (m.lead_founder = TRUE OR m.is_owner = TRUE)) AS owners
       FROM ventures v ORDER BY v.created_at DESC LIMIT 10`,
  )
).rows;
for (const r of owners) console.log(`  ${r.company_name}: owners=${r.owners}`);

await pool.end();
console.log("\n[done]");
