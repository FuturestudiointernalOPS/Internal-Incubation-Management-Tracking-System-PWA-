import db from '../src/lib/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
    try {
        console.log("Applying project timeline schema updates (ESM)...");
        await db.execute("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS start_date DATE");
        await db.execute("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS end_date DATE");
        console.log("Schema update successful.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e.message);
        process.exit(1);
    }
}

migrate();
