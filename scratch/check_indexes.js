const db = require('./src/lib/db').default;

async function checkIndexes() {
    const tables = [
        'v2_participants', 'v2_teams', 'v2_sessions', 'v2_events', 
        'v2_kpis', 'v2_document_requirements', 'v2_weekly_reports', 
        'v2_submissions', 'v2_groups', 'v2_program_staff'
    ];
    
    for (const table of tables) {
        try {
            const res = await db.execute(`PRAGMA index_list(${table})`);
            console.log(`Table: ${table}`);
            console.log(res.rows);
        } catch (e) {
            console.log(`Table: ${table} - ERROR: ${e.message}`);
        }
    }
}

// checkIndexes();
console.log("Database indexing check script ready.");
