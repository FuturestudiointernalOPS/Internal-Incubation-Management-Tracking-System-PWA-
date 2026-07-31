import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
const db = await initDb();

const queries = [
  `CREATE TABLE IF NOT EXISTS dd_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES dd_information_requests(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    file_data TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_dd_docs_request ON dd_documents(request_id)',
];

for (const sql of queries) {
  await db.execute({ sql, args: [] });
}

console.log("✅ dd_documents table created");
process.exit(0);
