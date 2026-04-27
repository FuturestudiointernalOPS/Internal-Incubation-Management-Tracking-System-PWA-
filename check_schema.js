import { initDb } from './src/lib/db.js';

async function checkSchema() {
    try {
        const db = await initDb();
        const res = await db.execute("PRAGMA table_info(v2_sessions)");
        console.log("v2_sessions schema:", JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
