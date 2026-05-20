import db, { initDb } from "../src/lib/db.js";
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
  });
}

async function run() {
  try {
    await initDb();
    const newPassword = '12345';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log("🚀 Resetting Super Admin Password in DB...");
    const res = await db.execute({
      sql: "UPDATE contacts SET password = ? WHERE role = 'super_admin' AND email = ?",
      args: [hashedPassword, 'gwyn.ukoha@gmail.com']
    });

    console.log("✅ Database Update Successful.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Reset Failed:", error);
    process.exit(1);
  }
}

run();
