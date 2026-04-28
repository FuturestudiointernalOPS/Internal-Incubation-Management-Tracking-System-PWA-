
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function check() {
  try {
    const contacts = await db.execute("SELECT name, email, group_name, role FROM contacts WHERE email LIKE '%godwin%'");
    console.log("Contacts matching godwin:");
    console.table(contacts.rows);

    const groups = await db.execute("SELECT group_name, COUNT(*) as count FROM contacts GROUP BY group_name");
    console.log("\nGroups summary:");
    console.table(groups.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
