import db, { initDb } from '@/lib/db';

export async function POST(req) {
   try {
    await initDb();
      const payload = await req.json();
      const { program_id, action, role, cid } = payload;
      
      if (!program_id) return NextResponse.json({ success: false, error: "Program ID missing" }, { status: 400 });

      // --- RBAC ENFORCEMENT (V2.8 SECURITY) ---
      if (role !== 'super_admin') {
         const authCheck = await db.execute({
            sql: "SELECT id FROM v2_programs WHERE id = ? AND assigned_pm_id = ?",
            args: [program_id, cid]
         });
         if (authCheck.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Mission Authority Violation: You are not authorized to modify this curriculum." }, { status: 403 });
         }
      }


      if (action === 'add_session') {
         const { title, description, week_number, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name } = payload;
         const result = await db.execute({
            sql: "INSERT INTO v2_sessions (program_id, title, description, week_number, status, weight, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
            args: [program_id, title, description, week_number || 1, 'not started', 1, scheduled_date || null, end_date || null, start_time || null, end_time || null, assignment_type || null, task_type || null, handler_id || null, handler_name || null]
         });
         return NextResponse.json({ success: true, id: result.rows[0].id });
      }

      if (action === 'add_requirement') {
         const { title, description, session_id, allowed_format } = payload;
         await db.execute({
            sql: "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            args: [program_id, title, description || null, session_id || null, allowed_format || 'pdf', 1]
         });
         return NextResponse.json({ success: true });
      }

      if (action === 'toggle_status') {
         const { id, status } = payload;
         await db.execute({
            sql: "UPDATE v2_sessions SET status = ? WHERE id = ?",
            args: [status, id]
         });
         return NextResponse.json({ success: true });
      }

      if (action === 'toggle_deliverable') {
         const { id, is_completed } = payload;
         await db.execute({
            sql: "UPDATE v2_document_requirements SET is_completed = ? WHERE id = ?",
            args: [is_completed ? 1 : 0, id]
         });
         return NextResponse.json({ success: true });
      }

      if (action === 'assign_team') {
         const { id, team_id } = payload;
         await db.execute({
            sql: "UPDATE v2_sessions SET team_id = ? WHERE id = ?",
            args: [team_id || null, id]
         });
         return NextResponse.json({ success: true });
      }

      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

   } catch (e) {
      console.error(e);
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
   }
}

export async function PUT(req) {
   try {
    await initDb();
      const payload = await req.json();
      const { id, program_id, role, cid, title, description, status, week_number, type, allowed_format, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name } = payload;
      
      // --- RBAC ENFORCEMENT ---
      if (role !== 'super_admin') {
         const authCheck = await db.execute({
            sql: "SELECT id FROM v2_programs WHERE id = ? AND assigned_pm_id = ?",
            args: [program_id, cid]
         });
         if (authCheck.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
         }
      }

      if (type === 'session') {
         await db.execute({
            sql: "UPDATE v2_sessions SET title = ?, description = ?, status = ?, week_number = ?, weight = 1, scheduled_date = ?, end_date = ?, start_time = ?, end_time = ?, assignment_type = ?, task_type = ?, handler_id = ?, handler_name = ? WHERE id = ?",
            args: [title, description, status, week_number, scheduled_date || null, end_date || null, start_time || null, end_time || null, assignment_type || null, task_type || null, handler_id || null, handler_name || null, id]
         });
      } else {
         await db.execute({
            sql: "UPDATE v2_document_requirements SET title = ?, description = ?, allowed_format = ?, weight = 1 WHERE id = ?",
            args: [title, description, allowed_format, id]
         });
      }

      return NextResponse.json({ success: true });
   } catch (e) {
      console.error(e);
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
   }
}

export async function DELETE(req) {
   try {
    await initDb();
      const { id, program_id, type, role, cid } = await req.json();

      // --- RBAC ENFORCEMENT ---
      if (role !== 'super_admin') {
         const authCheck = await db.execute({
            sql: "SELECT id FROM v2_programs WHERE id = ? AND assigned_pm_id = ?",
            args: [program_id, cid]
         });
         if (authCheck.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
         }
      }

      if (type === 'session') {
         await db.execute({ sql: "DELETE FROM v2_sessions WHERE id = ?", args: [id] });
         await db.execute({ sql: "DELETE FROM v2_document_requirements WHERE session_id = ?", args: [id] });
      } else {
         await db.execute({ sql: "DELETE FROM v2_document_requirements WHERE id = ?", args: [id] });
      }

      return NextResponse.json({ success: true });
   } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
   }
}
