/**
 * Repair accounts that an approval demoted back to "approved".
 *
 * The approval automation rewrote an existing account to "approved" because its
 * contact lookup never read the current status. So a person who had already
 * activated, and whose submission was approved again later, ended up
 * "approved" while still carrying an activation date — and the program
 * participant lists, which only count ACTIVE accounts, stopped showing them.
 *
 * Scope (deliberately narrow):
 *   status = 'approved'            (the value the approval wrote)
 *   AND activated_at IS NOT NULL   (they did complete activation)
 *   AND deleted = 0 AND deleted_at IS NULL AND archived_at IS NULL
 *
 * "inactive" is NOT touched: that is a deliberate deactivation, not this bug.
 *
 * Usage:
 *   node scripts/db-audit/repair-activated-accounts.mjs [env-file] [expected-ref] [--apply]
 *
 *   - Default env file: .env.local
 *   - Default expected project ref: the STAGING project. Another ref must be
 *     given EXPLICITLY (e.g. the production one) — the script refuses any other
 *     target, so it can never hit the wrong database by accident.
 *   - Dry run unless --apply is passed.
 *
 * The connection string is never printed; only the target ref is.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const positional = args.filter((arg) => !arg.startsWith("--"));
const ENV_FILE = path.join(PROJECT_ROOT, positional[0] || ".env.local");
const STAGING_REF = "mbpaxrfhqqclzyiefuab";
const EXPECTED_REF = positional[1] || STAGING_REF;

const SCOPE = `
  activated_at IS NOT NULL
  AND LOWER(COALESCE(status, '')) = 'approved'
  AND deleted = 0 AND deleted_at IS NULL AND archived_at IS NULL
`;

function readDatabaseUrl() {
  const env = readFileSync(ENV_FILE, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL not found in " + ENV_FILE);
}

const databaseUrl = readDatabaseUrl();
const projectRef = (databaseUrl.match(/\/\/(?:postgres\.)?([a-z0-9]+):/) || [])[1] || "";
if (projectRef !== EXPECTED_REF) {
  throw new Error(
    `Refusing to run: DATABASE_URL points at "${projectRef}", expected "${EXPECTED_REF}". ` +
      "Pass the expected project ref explicitly to target another database.",
  );
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  console.log(`target: ${projectRef} (${ENV_FILE}) — ${APPLY ? "APPLY" : "DRY RUN"}`);

  const candidates = await client.query(
    `SELECT cid, name, email, status, activated_at, last_login_at
       FROM contacts
      WHERE ${SCOPE}
      ORDER BY activated_at`,
  );
  console.log(`candidates: ${candidates.rows.length}`);
  console.table(candidates.rows);

  if (!APPLY) {
    console.log("Nothing written. Re-run with --apply to restore these accounts to 'active'.");
  } else {
    await client.query("BEGIN");
    try {
      const repaired = await client.query(
        `UPDATE contacts SET status = 'active'
          WHERE ${SCOPE}
          RETURNING cid, name, email, status, activated_at`,
      );
      await client.query("COMMIT");
      console.log(`repaired: ${repaired.rows.length}`);
      console.table(repaired.rows);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
