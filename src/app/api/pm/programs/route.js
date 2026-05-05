import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
export const dynamic = "force-dynamic";

/**
 * PROGRAMS API — OPERATIONAL INTELLIGENCE
 * Handles program lifecycle, completion metrics, and resource association.
 */

export async function GET(req) {
  try {
    await initDb();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get('assigned_pm_id');
    const showArchived = url.searchParams.get('show_archived') === 'true';

    // 1. Fetch Basic Programs
    let baseQuery = `
      SELECT p.*, 
             c1.name as pm_name, 
             c2.name as assistant_name,
             k.title as note_title
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
      WHERE p.is_archived = ?
    `;
    
    const args = [showArchived ? 1 : 0];
    if (assignedPmId) {
       baseQuery += " AND (p.assigned_pm_id = ? OR p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?))";
       args.push(assignedPmId, `%${assignedPmId}%`, assignedPmId);
    }
    baseQuery += " ORDER BY p.created_at DESC";

    const programsRes = await db.execute({ sql: baseQuery, args });
    const programs = programsRes.rows;

    if (programs.length === 0) {
      return NextResponse.json({ success: true, programs: [] });
    }

    // 2. Fetch Aggregate Metrics (Grouped)
    // This is significantly faster than per-row subqueries
    const [sessions, participants, docs, reports] = await Promise.all([
      db.execute("SELECT program_id, COUNT(*) as count, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM v2_sessions GROUP BY program_id"),
      db.execute("SELECT program_id, COUNT(*) as count FROM v2_participants GROUP BY program_id"),
      db.execute("SELECT program_id, COUNT(*) as count, SUM(is_completed) as completed FROM v2_document_requirements GROUP BY program_id"),
      db.execute("SELECT program_id, COUNT(DISTINCT week_number) as weeks FROM v2_weekly_reports GROUP BY program_id")
    ]);

    // Map metrics for O(1) lookup
    const metrics = {
      sessions: Object.fromEntries(sessions.rows.map(r => [r.program_id, r])),
      participants: Object.fromEntries(participants.rows.map(r => [r.program_id, r.count])),
      docs: Object.fromEntries(docs.rows.map(r => [r.program_id, r])),
      reports: Object.fromEntries(reports.rows.map(r => [r.program_id, r.weeks]))
    };

    // 3. Assemble Final Data
    const enrichedPrograms = programs.map(p => {
      const s = metrics.sessions[p.id] || { count: 0, completed: 0 };
      const d = metrics.docs[p.id] || { count: 0, completed: 0 };
      const r_weeks = metrics.reports[p.id] || 0;

      // Calculate Completion Index in JS to offload DB
      const sessionsWeight = s.completed * 5.0;
      const docsWeight = d.completed * 2.0;
      const reportsWeight = r_weeks * 10.0;
      
      const totalPossibleWeight = (s.count * 5.0) + (d.count * 2.0) + (p.duration_weeks * 10.0);
      const completion_index = totalPossibleWeight > 0 
        ? ((sessionsWeight + docsWeight + reportsWeight) / totalPossibleWeight) * 100 
        : 0;

      return {
        ...p,
        sessions_count: s.count,
        participants_count: metrics.participants[p.id] || 0,
        docs_total: d.count,
        docs_completed: d.completed,
        reports_count: r_weeks,
        completion_index: Math.round(completion_index)
      };
    });
    
    return NextResponse.json({ success: true, programs: enrichedPrograms });
  } catch (error) {
    console.error("GET Programs Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { name, description, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, materials } = await req.json();
    const id = "P-" + new Date().getFullYear() + "-" + uuidv4().split('-')[0].toUpperCase();

    await db.execute({
      sql: `INSERT INTO v2_programs (id, name, description, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, is_archived, materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name, description, note_id || null, assigned_pm_id || null, assigned_assistant_id || null, duration_weeks || 4, 'active', 0, JSON.stringify(materials || [])]
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("POST Program Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, name, description, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, materials } = await req.json();

    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

    await db.execute({
      sql: `UPDATE v2_programs 
            SET name = ?, description = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, duration_weeks = ?, status = ?, materials = ?
            WHERE id = ?`,
      args: [name, description, note_id || null, assigned_pm_id || null, assigned_assistant_id || null, duration_weeks || 4, status, JSON.stringify(materials || []), id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Program Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();

    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

    await db.execute({
      sql: "DELETE FROM v2_programs WHERE id = ?",
      args: [id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

