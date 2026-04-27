import db, { initDb } from './src/lib/db.js';

async function check() {
    await initDb();
    const res = await db.execute('PRAGMA table_info(v2_sessions)');
    console.log("COLUMNS:", res.rows.map(r => r.name).join(", "));
}
check();
