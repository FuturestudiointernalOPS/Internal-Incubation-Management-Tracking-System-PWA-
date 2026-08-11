// Run Venture OS Schema Fix migration against staging database
const fs = require("fs");
const path = require("path");

// Read .env.local manually
const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

// Extract DATABASE_URL
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
  path.resolve(__dirname, "venture_os_schema_fix.sql"),
  "utf-8",
);

async function run() {
  const client = await pool.connect();
  try {
    // Split by semicolon but keep the full statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    let successCount = 0;
    let errorCount = 0;

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`✅ ${stmt.substring(0, 100).replace(/\n/g, " ")}`);
        successCount++;
      } catch (err) {
        if (
          err.message.includes("already exists") ||
          err.message.includes("duplicate") ||
          err.message.includes("already") 
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
    if (errorCount === 0) {
      console.log("✅ Migration Venture OS terminée avec succès !");
    } else {
      console.log(`⚠️  Terminé avec ${errorCount} erreur(s) — voir ci-dessus.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌ Migration échouée:", err.message);
  process.exit(1);
});
