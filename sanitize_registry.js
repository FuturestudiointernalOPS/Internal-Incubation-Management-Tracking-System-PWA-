const { createClient } = require('@libsql/client');

async function cleanup() {
    const db = createClient({ url: 'file:c:/Gwin Prod/ImpactOS-FutureStudio/local.db' });
    
    // 1. Move formats to media
    await db.execute("UPDATE v2_standard_types SET category = 'media' WHERE label IN ('Word', 'Plain Text')");
    
    // 2. Move assignments to tasks
    await db.execute("UPDATE v2_standard_types SET category = 'task' WHERE category = 'assignment'");
    
    // 3. Delete lowercase duplicates
    await db.execute("DELETE FROM v2_standard_types WHERE label IN ('workshop', 'followup')");

    console.log('Registry Sanitized.');
}

cleanup();
