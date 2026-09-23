import db, { initDb } from "../src/lib/db.js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function migrate() {
  await initDb();
  console.log("Gap 1 — Add project_id to blockers\n");

  try {
    await db.execute({ sql: "ALTER TABLE blockers ADD COLUMN project_id TEXT DEFAULT NULL", args: [] });
    console.log("  ✅ blockers.project_id added");
  } catch (error) {
    if (error.message.includes("already exists")) console.log("  ⚠️  already exists");
    else console.error("  ❌", error.message);
  }

  console.log("\n✅ Done.");
}

migrate().then(() => process.exit(0));
