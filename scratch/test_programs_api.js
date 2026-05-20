const db = require('./lib/db').default;

async function test() {
    try {
        console.log("Testing GET /api/v2/pm/programs logic...");
        const res = await db.execute({
            sql: `
                SELECT p.*, 
                     c1.name as pm_name, 
                     c2.name as assistant_name,
                     k.title as note_title,
                     (SELECT name FROM v2_groups WHERE program_id = p.id LIMIT 1) as group_name,
                     (SELECT url FROM v2_groups WHERE program_id = p.id LIMIT 1) as group_url,
                     (SELECT project_description FROM v2_groups WHERE program_id = p.id LIMIT 1) as group_desc,
                     (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id) as sessions_count,
                     (SELECT COUNT(*) FROM v2_participants WHERE program_id = p.id) as participants_count,
                     (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id) as docs_total,
                     (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id AND is_completed = 1) as docs_completed,
                     (SELECT COUNT(*) FROM v2_weekly_reports WHERE program_id = p.id) as reports_count,
                     COALESCE((SELECT 
                        ( (COUNT(CASE WHEN s.status = 'completed' THEN 1 END) * 5.0) + 
                          (COALESCE((SELECT SUM(is_completed) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) +
                          (COALESCE((SELECT COUNT(DISTINCT week_number) * 10.0 FROM v2_weekly_reports WHERE program_id = p.id), 0))
                        ) / 
                        ( (COUNT(s.id) * 5.0 + COALESCE((SELECT COUNT(*) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) + (p.duration_weeks * 10.0) + 0.0001
                        ) * 100.0
                      FROM v2_sessions s WHERE s.program_id = p.id
                     ), 0) as completion_index
                FROM v2_programs p
                LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
                LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
                LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
                WHERE (p.is_archived = 0 OR (p.is_archived IS NULL AND 0 = 0))
                LIMIT 5
            `,
            args: []
        });
        console.log("Success! Returned " + res.rows.length + " programs.");
    } catch (e) {
        console.error("FAILED with error:", e.message);
    }
}

test();
