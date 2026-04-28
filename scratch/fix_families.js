const { createClient } = require("@libsql/client");

const db = createClient({
  url: "file:local.db",
});

async function fix() {
  try {
    console.log("Fixing FAMILIES table...");
    await db.execute("ALTER TABLE families ADD COLUMN registration_id TEXT");
    console.log("-> Added registration_id");
  } catch (e) {
    console.log("-> registration_id might already exist or error:", e.message);
  }

  try {
    await db.execute("ALTER TABLE families ADD COLUMN email TEXT");
    console.log("-> Added email");
  } catch (e) {
    console.log("-> email might already exist or error:", e.message);
  }

  try {
    await db.execute("ALTER TABLE families ADD COLUMN password TEXT");
    console.log("-> Added password");
  } catch (e) {
    console.log("-> password might already exist or error:", e.message);
  }
  
  process.exit(0);
}

fix();
