import { createClient } from "@libsql/client";
const db = createClient({ url: "file:local.db" });
async function check() {
  const res = await db.execute("SELECT id, name, length(url) as size FROM v2_knowledge_attachments");
  console.log(res.rows);
}
check();
