/**
 * SYNC PRODUCTION COLUMNS → STAGING
 * Adds every column that exists on staging but is missing on production.
 * Safe — never drops data, never drops tables.
 */
const { Pool } = require("pg");
const fs = require("fs");

const stagingUrl = fs.readFileSync(".env.local", "utf-8").match(/DATABASE_URL=(.+)/)[1].trim();
const prodUrl = "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function getColsInfo(pool, tbl) {
  const r = await pool.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
    [tbl]
  );
  return r.rows;
}

(async () => {
  console.log("Scanning staging schema...");
  const s = new Pool({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });
  const p = new Pool({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  const tables = (await s.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).rows.map(x => x.table_name);
  let totalAdded = 0;
  let errors = 0;

  for (const tbl of tables) {
    // Check if table exists on prod
    const ptCheck = await p.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1 AND table_schema='public') as ex", [tbl]);
    if (!ptCheck.rows[0].ex) {
      console.log("⏭️  Table missing entirely on prod, skipping:", tbl);
      continue;
    }

    const sCols = await getColsInfo(s, tbl);
    const pCols = await getColsInfo(p, tbl);
    const pColNames = pCols.map(c => c.column_name);

    for (const sc of sCols) {
      if (pColNames.includes(sc.column_name)) continue;

      // Map data_type to PostgreSQL-compatible type
      let pgType = sc.data_type;
      if (pgType === "character varying" || pgType === "character") pgType = "TEXT";
      if (pgType === "timestamp with time zone") pgType = "TIMESTAMPTZ";
      if (pgType === "double precision") pgType = "REAL";
      if (pgType === "jsonb") pgType = "JSONB";
      if (pgType === "boolean") pgType = "BOOLEAN";
      if (pgType === "integer") pgType = "INTEGER";
      if (pgType === "date") pgType = "DATE";
      if (pgType === "real") pgType = "REAL";
      if (pgType === "numeric") pgType = "NUMERIC";
      if (pgType === "uuid") pgType = "UUID";

      try {
        const sql = `ALTER TABLE "${tbl}" ADD COLUMN "${sc.column_name}" ${pgType}`;
        await p.query(sql);
        totalAdded++;
        console.log(`  ✅ ${tbl}.${sc.column_name}`);
      } catch (e) {
        errors++;
        console.log(`  ⚠️ ${tbl}.${sc.column_name}: ${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n🎉 Terminé: ${totalAdded} colonnes ajoutées, ${errors} erreurs`);
  await s.end();
  await p.end();
})();
