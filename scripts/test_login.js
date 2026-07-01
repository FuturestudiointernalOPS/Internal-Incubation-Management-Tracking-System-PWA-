const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = match[1].trim();

console.log("Connecting to:", DATABASE_URL.replace(/\/\/.*@/, "//***@"));

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  const email = "superadmin@impactos.staging";
  const password = "ImpactOS2026!";

  const res = await pool.query(
    "SELECT cid, name, email, role, password, status FROM contacts WHERE email = $1 AND deleted = 0",
    [email],
  );

  if (res.rows.length === 0) {
    console.log("❌ User not found:", email);
  } else {
    const user = res.rows[0];
    console.log(
      "✅ User found:",
      user.name,
      "|",
      user.email,
      "| role:",
      user.role,
      "| status:",
      user.status,
    );
    const isHashed = user.password.startsWith("$2");
    console.log("   Password is hashed:", isHashed);
    const pwMatch = isHashed
      ? await bcrypt.compare(password, user.password)
      : password === user.password;
    console.log("   Password match:", pwMatch);
  }

  const all = await pool.query(
    "SELECT role, COUNT(*)::int FROM contacts WHERE deleted = 0 GROUP BY role ORDER BY role",
  );
  console.log(
    "\n📊 Users:",
    all.rows.map((r) => `${r.role}: ${r.count}`).join(", "),
  );

  await pool.end();
}

test().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
