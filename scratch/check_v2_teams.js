const { createClient } = require("@libsql/client");

const db = createClient({
  url: "file:local.db",
});

async function check() {
  try {
    const res = await db.execute("PRAGMA table_info(v2_teams)");
    console.log("V2_TEAMS COLUMNS:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
