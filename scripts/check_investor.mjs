import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0 && !line.startsWith("#")) {
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (_) {}

import { initDb } from "../src/lib/db.js";
const db = await initDb();

// 1. Check Sarah's cid in contacts
const c = await db.execute({sql: "SELECT cid, name, email, role FROM contacts WHERE email ILIKE $1", args: ["%sarah%"]});
console.log("Contacts:", JSON.stringify(c.rows, null, 2));

// 2. Check all notifications for all recipients
const n = await db.execute({sql: "SELECT id, recipient_id, title, is_read, type FROM v2_notifications WHERE type = 'investor' ORDER BY created_at DESC", args: []});
console.log("\nAll investor notifications:", JSON.stringify(n.rows, null, 2));

// 3. Check if the notification API would return it (simulate GET with Sarah's cid)
const recipientId = "USR-MS6ALOU8THH1K";
const notifs = await db.execute({sql: "SELECT * FROM v2_notifications WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 50", args: [recipientId]});
const unread = notifs.rows.filter(r => r.is_read == 0 || r.is_read == null);
console.log("\nUnread for", recipientId, ":", JSON.stringify(unread, null, 2));

process.exit(0);
