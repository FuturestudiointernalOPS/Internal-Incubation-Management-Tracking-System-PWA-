const db = require('../lib/db');

async function checkApril() {
  try {
    await db.initDb();
    const res = await db.execute({
      sql: "SELECT id, name, email, role, group_name, status FROM contacts WHERE name LIKE '%April%' OR email LIKE '%april%'",
      args: []
    });
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkApril();
