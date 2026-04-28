
const { createClient } = require('@libsql/client');
const db = createClient({
  url: "file:local.db",
});

async function check() {
  try {
    const res = await db.execute("SELECT name FROM families");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
