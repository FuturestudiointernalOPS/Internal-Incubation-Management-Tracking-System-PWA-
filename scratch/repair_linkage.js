
import db, { initDb } from "../src/lib/db.js";

async function repair() {
  await initDb();
  console.log("--- REPAIR START ---");
  const programId = 'P-2026-1AA0AC1C';
  const groupName = 'T4S';
  
  const res = await db.execute({
    sql: "UPDATE families SET program_id = ? WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
    args: [programId, groupName]
  });
  
  console.log(`Linkage repaired for ${groupName}:`, res.rowsAffected);
}

repair();
