import db from './src/lib/db.js';
import { initDb } from './src/lib/db.js';
import fs from 'fs';
import path from 'path';

// Manual env loading with correct splitting
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const firstEqual = trimmedLine.indexOf('=');
      if (firstEqual !== -1) {
        const key = trimmedLine.substring(0, firstEqual).trim();
        let value = trimmedLine.substring(firstEqual + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
        process.env[key] = value;
      }
    }
  });
}

async function migrate() {
  try {
    await initDb();
    console.log("Initializing Migration (Families & Teams)...");

    // 1. Update families
    try {
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'individual'");
      console.log("Added type to families");
    } catch (e) { console.log("Error updating families (type):", e.message); }

    try {
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS shared_password_read TEXT");
      console.log("Added shared_password_read to families");
    } catch (e) { console.log("Error updating families (shared_password_read):", e.message); }

    try {
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS shared_password_edit TEXT");
      console.log("Added shared_password_edit to families");
    } catch (e) { console.log("Error updating families (shared_password_edit):", e.message); }

    try {
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS shared_email TEXT");
      console.log("Added shared_email to families");
    } catch (e) { console.log("Error updating families (shared_email):", e.message); }

    console.log("Migration Completed Successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration Failed:", err);
    process.exit(1);
  }
}

migrate();
