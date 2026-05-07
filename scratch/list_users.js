import db from '../src/lib/db.js';

async function listUsers() {
  try {
    const res = await db.execute("SELECT id, email, password, role FROM contacts WHERE status = 'active' OR role = 'super_admin' LIMIT 100");
    
    const users = {
      super_admin: [],
      program_manager: [],
      teacher: [],
      staff: [],
      participant: []
    };

    for (const row of res.rows) {
      if (row.role === 'super_admin' && users.super_admin.length < 2) users.super_admin.push(row);
      else if (row.role === 'project_manager' && users.program_manager.length < 2) users.program_manager.push(row);
      else if (row.role === 'teacher' && users.teacher.length < 2) users.teacher.push(row);
      else if (row.role === 'staff' && users.staff.length < 2) users.staff.push(row);
      else if (row.role === 'participant' && users.participant.length < 2) users.participant.push(row);
    }
    
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

listUsers();
