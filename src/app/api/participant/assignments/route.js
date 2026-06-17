import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getSessionCid() {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  return session?.cid || null;
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const cid = await getSessionCid();
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const { searchParams } = new URL(req.url);
    const filterProgramId = searchParams.get("program_id");

    const contactRes = await db.execute({
      sql: "SELECT cid, program_id, group_name FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }
    const contact = contactRes.rows[0];

    const programIds = new Set();
    if (contact.program_id) {
      String(contact.program_id)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => programIds.add(id));
    }
    if (contact.group_name) {
      const famRes = await db.execute({
        sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
        args: [contact.group_name],
      });
      famRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
    }
    // Path 4: participant_programs junction table
    try {
      const ppRes = await db.execute({
        sql: "SELECT program_id FROM participant_programs WHERE participant_id = ?",
        args: [cid],
      });
      ppRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
    } catch (_) {}
    // Path 5: v2_participants (direct participant enrollments)
    try {
      const vpRes = await db.execute({
        sql: "SELECT program_id FROM v2_participants WHERE email = ?",
        args: [session.email],
      });
      vpRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
    } catch (_) {}

    const allAssignments = [];
    for (const pid of programIds) {
      if (filterProgramId && pid !== filterProgramId) continue;

      const [progRes, delRes, subRes] = await Promise.all([
        db.execute({
          sql: "SELECT id, name FROM v2_programs WHERE id = ?",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_submissions WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
      ]);

      const program = progRes.rows[0];
      if (!program) continue;
      const deliverables = delRes.rows || [];
      const submissions = subRes.rows || [];

      for (const d of deliverables) {
        const sub = submissions.find((s) => s.document_id === d.id);
        allAssignments.push({
          id: d.id,
          title: d.title,
          description: d.description,
          allowedFormat: d.allowed_format,
          weight: d.weight,
          programId: pid,
          programName: program.name,
          dueDate: d.created_at,
          submission: sub
            ? {
                id: sub.id,
                status: sub.status,
                fileUrl: sub.file_url,
                score: sub.score,
                submittedAt: sub.created_at,
              }
            : null,
        });
      }
    }

    const now = new Date();
    allAssignments.sort((a, b) => {
      const aOverdue = !a.submission && new Date(a.dueDate) < now ? 1 : 0;
      const bOverdue = !b.submission && new Date(b.dueDate) < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return new Date(b.dueDate) - new Date(a.dueDate);
    });

    return NextResponse.json({
      success: true,
      assignments: allAssignments,
      count: allAssignments.length,
    });
  } catch (error) {
    console.error("Assignments API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const cid = await getSessionCid();
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const { program_id, deliverable_id, file_url } = await req.json();
    if (!program_id || !deliverable_id) {
      return NextResponse.json(
        { success: false, error: "Program ID and deliverable ID required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "INSERT INTO v2_submissions (participant_id, program_id, document_id, file_url, status) VALUES (?, ?, ?, ?, 'pending')",
      args: [cid, program_id, deliverable_id, file_url || null],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assignment Submit Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
