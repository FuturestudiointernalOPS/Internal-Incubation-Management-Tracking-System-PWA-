import { NextResponse } from 'next/server';
import db, { initDb } from '@/lib/db';

export async function POST(req) {
   try {
      await initDb();
      const payload = await req.json();
      const { program_id, action } = payload;

      if (!program_id) return NextResponse.json({ success: false, error: "Program ID missing" }, { status: 400 });

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

      if (action === 'anchor_material') {
         const { session_id, file_name } = payload;
         // Fetch existing materials
         const currentRes = await db.execute({
            sql: "SELECT materials FROM v2_sessions WHERE id = ?",
            args: [session_id]
         });
         let materials = [];
         try {
            const raw = currentRes.rows[0]?.materials;
            materials = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
         } catch(e) { materials = []; }
         
         const newMaterial = { name: file_name, timestamp: new Date().toISOString(), status: 'anchored' };
         const updated = JSON.stringify([...materials, newMaterial]);

         await db.execute({
            sql: "UPDATE v2_sessions SET materials = ? WHERE id = ?",
            args: [updated, session_id]
         });
         return NextResponse.json({ success: true });
      }

      if (action === 'submit_pm_report') {
         const { session_id, week_number, summary, status, pm_id } = payload;
         await db.execute({
            sql: `INSERT INTO v2_weekly_reports 
                  (program_id, week_number, teacher_id, teacher_name, report_type, summary, status) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [program_id, week_number, pm_id, 'Program Manager', 'pm', summary, status]
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
      const { id, sessionId, field, value, handlerName, type } = payload;
      
      const targetId = id || sessionId;

      if (field && targetId) {
        let sql = "";
        let args = [];
        if (field === 'scheduled_date') { sql = "UPDATE v2_sessions SET scheduled_date = ? WHERE id = ?"; args = [value || null, targetId]; }
        else if (field === 'end_date') { sql = "UPDATE v2_sessions SET end_date = ? WHERE id = ?"; args = [value || null, targetId]; }
        else if (field === 'handler_id') { sql = "UPDATE v2_sessions SET handler_id = ?, handler_name = ? WHERE id = ?"; args = [value || null, handlerName || null, targetId]; }
        
        if (sql) {
          await db.execute({ sql, args });
          return NextResponse.json({ success: true });
        }
      }

      // Legacy full update support
      if (type === 'session') {
         const { title, description, status, week_number, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name } = payload;
         await db.execute({
            sql: "UPDATE v2_sessions SET title = ?, description = ?, status = ?, week_number = ?, weight = 1, scheduled_date = ?, end_date = ?, start_time = ?, end_time = ?, assignment_type = ?, task_type = ?, handler_id = ?, handler_name = ? WHERE id = ?",
            args: [title, description, status, week_number, scheduled_date || null, end_date || null, start_time || null, end_time || null, assignment_type || null, task_type || null, handler_id || null, handler_name || null, targetId]
         });
      } else {
         const { title, description, allowed_format } = payload;
         await db.execute({
            sql: "UPDATE v2_document_requirements SET title = ?, description = ?, allowed_format = ?, weight = 1 WHERE id = ?",
            args: [title, description, allowed_format, targetId]
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
      const { id, type } = await req.json();

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
