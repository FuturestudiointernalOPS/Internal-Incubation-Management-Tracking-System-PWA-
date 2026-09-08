// Run Venture OS FK fix migration against staging database
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.error("❌ DATABASE_URL not found in .env.local");
  process.exit(1);
}
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ Found DATABASE_URL");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.resolve(__dirname, "venture_os_fix_fk.sql"),
  "utf-8",
);

async function run() {
  const client = await pool.connect();
  try {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    let successCount = 0;
    let errorCount = 0;

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`✅ ${stmt.substring(0, 120).replace(/\n/g, " ")}`);
        successCount++;
      } catch (err) {
        if (
          err.message.includes("already exists")
        ) {
          console.log(`⏭️  ${stmt.substring(0, 80).replace(/\n/g, " ")} — already exists`);
          successCount++;
        } else {
          console.error(`❌ ${err.message.substring(0, 150)}`);
          errorCount++;
        }
      }
    }

    console.log(`\n📊 Résultat : ${successCount} OK, ${errorCount} erreurs`);
    console.log(errorCount === 0 ? "✅ Migration FK terminée !" : `⚠️  ${errorCount} erreur(s)`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌ Migration échouée:", err.message);
  process.exit(1);
});
