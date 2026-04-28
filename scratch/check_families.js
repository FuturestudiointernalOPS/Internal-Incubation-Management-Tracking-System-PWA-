const { createClient } = require("@libsql/client");

const db = createClient({
  url: "file:local.db",
});

async function check() {
  try {
    const res = await db.execute("PRAGMA table_info(families)");
    console.log("FAMILIES COLUMNS:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
