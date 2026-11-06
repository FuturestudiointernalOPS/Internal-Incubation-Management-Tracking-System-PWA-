import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.resolve(root, process.argv[2] || ".env.local");
const allowStagingWrite = process.argv.includes("--allow-staging-write");
if (!envPath.startsWith(`${root}${path.sep}`)) {
  throw new Error("Environment file must be inside the repository.");
}
if (!allowStagingWrite) {
  throw new Error("Pass --allow-staging-write to authorize this staging migration.");
}

const envText = readFileSync(envPath, "utf8");
const databaseLine = envText.split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
if (!databaseLine) throw new Error("DATABASE_URL is missing.");

const connectionString = databaseLine
  .slice(databaseLine.indexOf("=") + 1)
  .trim()
  .replace(/^["']|["']$/g, "");
const parsedUrl = new URL(connectionString);
const username = decodeURIComponent(parsedUrl.username);
const projectRef = username.startsWith("postgres.")
  ? username.slice("postgres.".length)
  : null;
if (projectRef !== "mbpaxrfhqqclzyiefuab") {
  throw new Error("Refusing to apply the Investor Phase 3/4 migration outside the verified staging project.");
}

const migrationPath = path.join(root, "src/migrations/20261106_investor_phase3_4.sql");
const migration = readFileSync(migrationPath, "utf8");
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
let connected = false;
let originalReadOnly = null;

try {
  await client.connect();
  connected = true;
  await client.query("RESET default_transaction_read_only");
  const identity = await client.query("SELECT current_database() AS database, current_user AS role");
  console.log(`Verified staging ${projectRef}; database ${identity.rows[0].database}; role ${identity.rows[0].role}.`);
  const setting = await client.query("SELECT current_setting('default_transaction_read_only') AS read_only");
  originalReadOnly = setting.rows[0].read_only;
  if (!["on", "off"].includes(originalReadOnly)) {
    throw new Error("Could not determine the staging session read-only setting.");
  }
  if (originalReadOnly === "on") {
    await client.query("SET default_transaction_read_only = off");
  }
  const writeMode = await client.query("SELECT current_setting('default_transaction_read_only') AS read_only");
  if (writeMode.rows[0].read_only !== "off") {
    throw new Error("Staging session is still read-only; refusing to run the migration.");
  }
  await client.query("BEGIN");
  await client.query(migration);
  await client.query("COMMIT");
  console.log("Investor Phase 3/4 additive migration applied successfully.");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Keep the original migration error.
  }
  console.error(`Investor Phase 3/4 migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (connected && originalReadOnly !== null) {
    try {
      await client.query("RESET default_transaction_read_only");
    } catch (error) {
      console.error(`Could not restore the staging session read-only setting: ${error.message}`);
      process.exitCode = 1;
    }
  }
  await client.end();
}
