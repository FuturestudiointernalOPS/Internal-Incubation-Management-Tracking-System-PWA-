import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession, requireAssignmentAccess, hasProgramManagementAccess } from "@/lib/auth";
import { createSession, listSessions } from "@/models/workspace";

export const POST = createHandler({ roles: ["staff", "super_admin", "program_manager", "teacher", "facilitator"] }, async (req) => {
  const body = await req.json();
  const { program_id, title, week_number, type, teacher_id, start_at } = body;

  if (!program_id || !title) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Server-side enforcement: non-management roles must be assigned and hold sessions.conduct
  const session = await getSession();
  if (session && !hasProgramManagementAccess(session.role)) {
    const facError = await requireAssignmentAccess({
      resource: "program",
      contextId: program_id,
      capability: "sessions.conduct",
      minLevel: 1,
    });
    if (facError) return facError;
  }

  const res = await createSession(
    program_id,
    title,
    week_number || 1,
    type || "Masterclass",
    teacher_id || null,
    start_at || null,
  );

  return NextResponse.json({
    success: true,
    session: {
      id: Number(res.rows[0]?.id ?? res.lastInsertRowid),
      program_id,
      title,
      week_number,
      type,
      teacher_id,
    },
  });
});

export const GET = createHandler({ roles: ["staff", "super_admin", "program_manager", "teacher", "facilitator"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get("program_id");

  // Server-side enforcement for facilitators
  if (program_id) {
    const session = await getSession();
    if (session && !hasProgramManagementAccess(session.role)) {
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
        capability: "sessions.conduct",
        minLevel: 1,
      });
      if (facError) return facError;
    }
  }

  const { rows } = await listSessions(program_id);
  return NextResponse.json({ success: true, sessions: rows });
});
