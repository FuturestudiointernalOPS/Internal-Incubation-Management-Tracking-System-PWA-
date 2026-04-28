
const { createClient } = require('@libsql/client');
const db = createClient({
  url: "file:local.db",
});

async function migrate() {
  try {
    // 1. Move all contacts with role 'staff' to group 'Future Studio'
    const res1 = await db.execute("UPDATE contacts SET group_name = 'Future Studio' WHERE role = 'staff'");
    console.log(`Updated ${res1.rowsAffected} contacts with role 'staff' to group 'Future Studio'`);

    // 2. Rename any group named 'Staff' to 'Future Studio' (just in case)
    const res2 = await db.execute("UPDATE contacts SET group_name = 'Future Studio' WHERE group_name = 'Staff' OR group_name = 'STAFF'");
    console.log(`Renamed 'Staff' group to 'Future Studio' for ${res2.rowsAffected} contacts`);

    // 3. Rename in families table
    const res3 = await db.execute("UPDATE families SET name = 'Future Studio' WHERE name = 'Staff' OR name = 'STAFF'");
    console.log(`Renamed 'Staff' family/group to 'Future Studio' for ${res3.rowsAffected} records`);

  } catch (e) {
    console.error(e);
  }
}

migrate();
