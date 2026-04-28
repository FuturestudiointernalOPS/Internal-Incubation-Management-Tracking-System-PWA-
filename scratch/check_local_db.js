import { createClient } from '@libsql/client';

const url = "file:local.db";

async function testLocal() {
    console.log("Testing local.db in ImpactOS-FutureStudio...");
    const client = createClient({ url });
    try {
        const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        console.log("Tables:", res.rows.map(r => r.name).join(", "));
        
        if (res.rows.find(r => r.name === 'contacts')) {
            const count = await client.execute("SELECT COUNT(*) as count FROM contacts");
            console.log("Contacts Count:", count.rows[0].count);
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

testLocal();
