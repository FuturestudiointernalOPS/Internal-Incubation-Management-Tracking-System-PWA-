
const { initDb, default: db } = require('../src/lib/db');
(async () => {
  try {
    await initDb();
    const query = `
      SELECT p.*, 
             c1.name as pm_name, 
             c2.name as assistant_name,
             k.title as note_title,
             (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id) as sessions_count,
             (SELECT COUNT(*) FROM v2_participants WHERE program_id = p.id) as participants_count,
             (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id) as docs_total,
             (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id AND is_completed = 1) as docs_completed,
             (SELECT COUNT(*) FROM v2_weekly_reports WHERE program_id = p.id) as reports_count,
             (SELECT 
                ( (COUNT(CASE WHEN s.status = 'completed' THEN 1 END) * 5.0) + 
                  (COALESCE((SELECT SUM(is_completed) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) +
                  (COALESCE((SELECT COUNT(DISTINCT week_number) * 10.0 FROM v2_weekly_reports WHERE program_id = p.id), 0))
                ) / 
                ( (NULLIF(COUNT(s.id), 0) * 5.0 + COALESCE((SELECT COUNT(*) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) + (p.duration_weeks * 10.0) + 0.0001
                ) * 100.0
              FROM v2_sessions s WHERE s.program_id = p.id
             ) as completion_index
              FROM v2_programs p
              LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
              LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
              LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
              WHERE p.is_archived = ?
    `;
    const res = await db.execute({ sql: query, args: [0] });
    console.log('Query Succeeded, Results:', res.rows.length);
  } catch(e) {
    console.error('Query Failed:', e.message);
  }
})();
