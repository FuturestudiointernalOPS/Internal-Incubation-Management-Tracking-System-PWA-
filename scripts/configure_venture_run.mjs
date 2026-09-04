// Connect an EXISTING manually-created form as the Venture Application.
//
// Run: node scripts/configure_venture_run.mjs "Your Form Name"
// (defaults to "Venture Application" if no name given)
//
// What it does (idempotent, safe to re-run):
//   1. Flags your form as the Venture Application (settings.venture_application
//      = true, merged with any settings you already set in the builder) and
//      ensures it is published — this is what makes the approval rule react.
//   2. Ensures an ACTIVE run exists for the form (with a public slug); creates
//      one if missing.
//   3. Records the run as the configured Venture Run (system_settings
//      venture_run_id) so invitations/website resolve the URL automatically.
//
// If no form is found, run the seed instead:
//   POST /api/platform/seed/venture-application (super admin)

import { initDb } from "../src/lib/db.js";
import { updateSetting } from "../src/lib/ventures.js";

const formName = process.argv[2] || "Venture Application";

function randomSlug() {
  const chars = "0123456789abcdef";
  let s = "r";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

const db = await initDb();
console.log(`Connecting form "${formName}" as the Venture Application...\n`);

// ── 1. Find the form ──
const formRes = await db.execute({
  sql: "SELECT id, name, version, status, settings FROM platform_forms WHERE name = ?",
  args: [formName],
});
const form = formRes.rows[0];
if (!form) {
  console.error(`✗ No form named "${formName}" found.`);
  console.error("  → Either use the exact name of the form you created in the builder,");
  console.error("    or run the seed: POST /api/platform/seed/venture-application");
  process.exit(1);
}
console.log(`✓ Found form #${form.id} "${form.name}" (status: ${form.status})`);

// ── 1b. Single-active Venture intake guard ──
// This script may not flag a second form while another form already holds
// the Venture flag (no cleanup is performed here).
const alreadyFlagged =
  form.settings?.venture_application === true ||
  form.settings?.venture_application === "true";
if (!alreadyFlagged) {
  const ownerRes = await db.execute({
    sql: `SELECT id, name FROM platform_forms
          WHERE settings->>'venture_application' = 'true' AND id != ?
          ORDER BY id ASC`,
    args: [form.id],
  });
  const owner = ownerRes.rows[0];
  if (owner) {
    console.error(`✗ Venture registration is already assigned to form #${owner.id} "${owner.name}".`);
    console.error("  → Deactivate it first (untick the Venture Application toggle in the builder),");
    console.error("    or run this script against that form's exact name.");
    process.exit(1);
  }
}

// ── 2. Flag it as the Venture Application (merge settings, keep yours) ──
await db.execute({
  sql: `UPDATE platform_forms
        SET settings = settings || '{"venture_application": true}'::jsonb,
            status = 'published'
        WHERE id = ?`,
  args: [form.id],
});
console.log("✓ Flagged as Venture Application (settings.venture_application = true)");

// DB-level backstop: only one flagged form may ever exist.
try {
  await db.execute({
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_forms_single_venture_flag
          ON platform_forms ((settings->>'venture_application'))
          WHERE settings->>'venture_application' = 'true'`,
    args: [],
  });
  console.log("✓ Single-active Venture form index ensured");
} catch (e) {
  console.warn(`⚠ Single-flag unique index NOT created (multiple flagged forms may exist): ${e.message}`);
  console.warn("  Clear the extra Venture flags in the builder, then re-run this script.");
}

// ── 3. Ensure an active run with a public slug ──
let runRes = await db.execute({
  sql: `SELECT * FROM platform_form_runs
        WHERE form_id = ? AND status = 'active' AND public_slug IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
  args: [form.id],
});
let run = runRes.rows[0];
if (!run) {
  const slug = randomSlug();
  const created = await db.execute({
    sql: `INSERT INTO platform_form_runs (form_id, form_version, name, description, status, settings, owner_id, created_by, public_slug, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', '{}'::jsonb, 'system', 'system', ?, NOW(), NOW())
          RETURNING id`,
    args: [form.id, form.version || 1, `${form.name} — Open`, "Venture intake run (configured automatically)", slug],
  });
  const runId = created.rows[0].id;
  runRes = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [runId] });
  run = runRes.rows[0];
  console.log(`✓ Created active run #${run.id}`);
} else {
  console.log(`✓ Reusing active run #${run.id}`);
}

// ── 4. Record the configured Venture Run ──
await updateSetting("venture_run_id", String(run.id), "system");
console.log("✓ system_settings.venture_run_id set");

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
console.log("\n═══════════════════════════════════════════════════════════");
console.log("READY — Venture Run connected:");
console.log(`   Run ID:   ${run.id}`);
console.log(`   Public:   ${appUrl}/s/${run.public_slug}`);
console.log(`   Invite:   ${appUrl}/s/${run.public_slug}?invitation=<token>`);
console.log("═══════════════════════════════════════════════════════════");
process.exit(0);
