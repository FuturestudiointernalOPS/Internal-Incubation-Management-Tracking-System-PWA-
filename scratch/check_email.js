
const { createClient } = require('@libsql/client');
const db = createClient({
  url: "file:local.db",
});

async function check() {
  try {
    const contacts = await db.execute("SELECT email FROM v2_participants WHERE email LIKE 'Godwin%'");
    console.log(contacts.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
