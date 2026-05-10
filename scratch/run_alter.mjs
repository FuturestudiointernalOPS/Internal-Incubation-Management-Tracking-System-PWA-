import pg from 'pg';
const { Pool } = pg;

const dbUrl = "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

async function run() {
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Running standalone migration...");
        await pool.query("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS start_date DATE");
        await pool.query("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS end_date DATE");
        console.log("Success: v2_programs updated with start_date and end_date.");
    } catch (e) {
        console.error("Error during migration:", e.message);
    } finally {
        await pool.end();
    }
}

run();
