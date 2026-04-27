import db, { initDb } from './src/lib/db.js';

async function setup() {
  try {
    await initDb();
    const pmCid = 'USER_DE5B7E656760';
    
    // Assign PM to all programs for testing
    await db.execute("UPDATE v2_programs SET assigned_pm_id = ?", [pmCid]);
    console.log("PM assigned to all programs.");

    // Create a dummy session for testing
    const progRes = await db.execute("SELECT id FROM v2_programs LIMIT 1");
    if (progRes.rows.length > 0) {
      const pid = progRes.rows[0].id;
      await db.execute("INSERT INTO v2_sessions (program_id, title, week_number, status, weight) VALUES (?, ?, ?, ?, ?)", 
        [pid, 'Project Inception', 1, 'completed', 10]);
      
      const sessRes = await db.execute("SELECT id FROM v2_sessions WHERE program_id = ? LIMIT 1", [pid]);
      if (sessRes.rows.length > 0) {
        const sid = sessRes.rows[0].id;
        await db.execute("INSERT INTO v2_document_requirements (program_id, title, session_id, allowed_format, weight) VALUES (?, ?, ?, ?, ?)",
          [pid, 'Initial Pitch Deck', sid, 'pdf', 5]);
      }
      console.log("Mock session created.");
    }

      // Standard Operational Types
      const standardTypes = [
        { category: 'assignment', label: 'Workshop' },
        { category: 'assignment', label: 'Master Class' },
        { category: 'assignment', label: 'Followup' },
        { category: 'deliverable', label: 'PDF' },
        { category: 'deliverable', label: 'Word' },
        { category: 'deliverable', label: 'Plain Text' },
        { category: 'deliverable', label: 'Media' },
        { category: 'deliverable', label: 'Link' }
      ];

      for (const type of standardTypes) {
        await db.execute("INSERT OR IGNORE INTO v2_standard_types (category, label) VALUES (?, ?)", [type.category, type.label]);
      }

      process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

setup();
