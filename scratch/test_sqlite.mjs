import { createClient } from "@libsql/client";
const db = createClient({ url: "file:local.db" });
async function check() {
  const res = await db.execute("SELECT '2026-04-30T22:59:44.000Z' > datetime('now') as test");
  console.log(res.rows);
}
check();
