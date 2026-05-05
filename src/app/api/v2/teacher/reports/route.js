import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';

export async function GET(req) {
   try {
      const db = await initDb();
      const { searchParams } = new URL(req.url);
      const program_id = searchParams.get('program_id');
      const week_number = searchParams.get('week_number');

      let sql = "SELECT * FROM v2_weekly_reports WHERE 1=1";
      const args = [];

      if (program_id) {
         sql += " AND program_id = ?";
         args.push(program_id);
      }
      if (week_number) {
         sql += " AND week_number = ?";
         args.push(parseInt(week_number));
      }

      sql += " ORDER BY created_at DESC";

      const reports = await db.execute({ sql, args });
      return NextResponse.json({ success: true, reports: reports.rows });
   } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
   }
}

export async function POST(req) {
   try {
      const db = await initDb();
      const body = await req.json();
      const { program_id, week_number, teacher_id, teacher_name, reception_score, progress_notes, student_reception, action_taken } = body;

      // Check if report already exists for this week/program/teacher to update instead of insert
      const existing = await db.execute({
         sql: "SELECT id FROM v2_weekly_reports WHERE program_id = ? AND week_number = ? AND teacher_id = ?",
         args: [program_id, week_number, teacher_id]
      });

      if (existing.rows.length > 0) {
         await db.execute({
            sql: `UPDATE v2_weekly_reports SET 
                  reception_score = ?, 
                  progress_notes = ?, 
                  student_reception = ?, 
                  action_taken = ?,
                  updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
            args: [reception_score, progress_notes, student_reception, action_taken, existing.rows[0].id]
         });

         // Log Activity
         await db.execute({
            sql: "INSERT INTO activity_logs (user, action, module, status) VALUES (?, ?, ?, ?)",
            args: [teacher_name, `Updated Weekly Report (Week ${week_number})`, 'Programs', 'success']
         });

         return NextResponse.json({ success: true, id: existing.rows[0].id, action: 'updated' });
      } else {
         const result = await db.execute({
            sql: `INSERT INTO v2_weekly_reports 
                  (program_id, week_number, teacher_id, teacher_name, reception_score, progress_notes, student_reception, action_taken) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [program_id, week_number, teacher_id, teacher_name, reception_score || 5, progress_notes, student_reception, action_taken]
         });

         // Log Activity
         await db.execute({
            sql: "INSERT INTO activity_logs (user, action, module, status) VALUES (?, ?, ?, ?)",
            args: [teacher_name, `Created Weekly Report (Week ${week_number})`, 'Programs', 'success']
         });

         return NextResponse.json({ success: true, id: Number(result.lastInsertRowid), action: 'inserted' });
      }
   } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
   }
}
