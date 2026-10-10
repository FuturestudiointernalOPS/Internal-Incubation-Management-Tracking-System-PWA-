/**
 * SECRET-1 — hash the legacy clear-text passwords still stored in `contacts`.
 *
 * The login routes used to accept a stored value that was not a bcrypt hash by
 * comparing it in clear text. They now upgrade such a row on the spot
 * (rehash-on-login); this script performs the same upgrade IN BULK so no clear
 * value has to wait for its owner's next login.
 *
 *   node scripts/hash-legacy-passwords.mjs                              # dry run (read-only)
 *   node scripts/hash-legacy-passwords.mjs --apply --backup=/secure/pw.tsv
 *   node scripts/hash-legacy-passwords.mjs --restore=/secure/pw.tsv     # rollback
 *
 * REVERSIBILITY: `--apply` REQUIRES `--backup=<path>` and refuses without it.
 * The backup file holds `cid<TAB>password` lines (mode 0600) — treat it as a
 * secret and delete it once satisfied. `--restore=<path>` replays it.
 *
 * A fresh database SNAPSHOT taken before `--apply` is mandatory; the file is a
 * convenience, not a substitute. This script changes nothing but the `password`
 * column of `contacts`, and is idempotent — a second run finds no legacy row.
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const ROUNDS = 10;

const readDatabaseUrl = (file) => {
  try {
    return readFileSync(file, "utf-8")
      .split("\n")
      .find((envLine) => envLine.startsWith("DATABASE_URL="))
      ?.substring("DATABASE_URL=".length)
      .trim();
  } catch {
    return null;
  }
};

const databaseUrl =
  process.env.DATABASE_URL ||
  readDatabaseUrl(".env.local") ||
  readDatabaseUrl(".env.staging") ||
  readDatabaseUrl(".env.audit-staging");

if (!databaseUrl) {
  console.error("Missing DATABASE_URL (env or an .env* file)");
  process.exit(2);
}

const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
};

const apply = process.argv.includes("--apply");
const backupPath = argValue("--backup");
const restorePath = argValue("--restore");

/** Mirrors `isLegacyClearPassword` in src/server/auth/password.js. */
const isLegacy = (value) =>
  typeof value === "string" && value.length > 0 && !value.startsWith("$2");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  await pool.query("SELECT 1");

  // ---- rollback mode -------------------------------------------------------
  if (restorePath) {
    const lines = readFileSync(restorePath, "utf-8").split("\n").filter(Boolean);
    let restored = 0;
    for (const line of lines) {
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const cid = line.slice(0, tab);
      const original = line.slice(tab + 1);
      await pool.query("UPDATE contacts SET password = $1 WHERE cid = $2", [original, cid]);
      restored += 1;
    }
    console.log(`[hash-legacy-passwords] restored ${restored} row(s) from ${restorePath}`);
  } else {
    // ---- survey ------------------------------------------------------------
    const { rows } = await pool.query(
      "SELECT cid, password FROM contacts WHERE password IS NOT NULL",
    );
    const legacy = rows.filter((r) => isLegacy(r.password));

    console.log(`[hash-legacy-passwords] contacts scanned: ${rows.length}`);
    console.log(`[hash-legacy-passwords] legacy clear-text rows: ${legacy.length}`);

    if (!apply) {
      console.log("DRY RUN — nothing written.");
      console.log("To apply: re-run with --apply --backup=/secure/pw.tsv (snapshot the DB first).");
    } else if (!backupPath) {
      console.error(
        "Refusing --apply without --backup=<path>. This is the rollback lever; snapshot the DB too.",
      );
      process.exitCode = 3;
    } else {
      // The pre-migration pairs, so --restore can undo the change.
      writeFileSync(
        backupPath,
        legacy.map((r) => `${r.cid}\t${r.password}`).join("\n"),
        { mode: 0o600 },
      );
      console.log(
        `[hash-legacy-passwords] backup written: ${backupPath} (${legacy.length} row(s), mode 0600)`,
      );

      let upgraded = 0;
      for (const row of legacy) {
        const hash = await bcrypt.hash(String(row.password), ROUNDS);
        // Guarded: a concurrent password change is never overwritten.
        const res = await pool.query(
          "UPDATE contacts SET password = $1 WHERE cid = $2 AND password = $3",
          [hash, row.cid, row.password],
        );
        upgraded += res.rowCount || 0;
      }
      console.log(`[hash-legacy-passwords] upgraded: ${upgraded} row(s)`);
      console.log("Re-run without --apply to confirm 0 legacy rows remain, then secure/delete the backup.");
    }
  }
} catch (error) {
  console.error("[hash-legacy-passwords] failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
