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
      await db.execute("INSERT INTO v2_sessions (program_id, title, week_number, status) VALUES (?, ?, ?, ?)", 
        [pid, 'Project Inception', 1, 'completed']);
      console.log("Mock session created.");
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

setup();
