import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth";
import { createHandler } from "@/lib/api/createHandler";
import {
  listProjectDiscussions,
  postProjectDiscussion,
} from "@/services/projects/collaboration";

/**
 * PROJECT DISCUSSIONS API (Ticket 4.3) — controller layer.
 *
 * GET  /api/projects/discuss?project_id=X
 *   - Returns all discussion messages for a project, oldest first
 *
 * POST /api/projects/discuss
 *   - Creates a new discussion message in the project context
 *   - Body: { project_id, sender_id, sender_name, body }
 *   - Notifies all project members (type: "project_discussion")
 *
 * The notification fan-out (owner, members, @mentions) lives in
 * `@/services/projects/collaboration`.
 */

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");

  if (!project_id) {
    return NextResponse.json(
      { success: false, error: "project_id is required" },
      { status: 400 },
    );
  }

  // Auth + membership check
  const authError = await requireProjectAccess(project_id);
  if (authError) return authError;

  const result = await listProjectDiscussions(project_id);
  return NextResponse.json({ success: true, messages: result.messages });
});

export const POST = createHandler(async (req) => {
  const body = await req.json();
  const { project_id, sender_id, sender_name, body: messageBody } = body;

  if (!project_id || !sender_id || !messageBody || !messageBody.trim()) {
    return NextResponse.json(
      { success: false, error: "project_id, sender_id, and body are required" },
      { status: 400 },
    );
  }

  // Auth + membership check
  const authError = await requireProjectAccess(project_id);
  if (authError) return authError;

  const result = await postProjectDiscussion({
    projectId: project_id,
    senderId: sender_id,
    senderName: sender_name,
    body: messageBody,
  });

  return NextResponse.json({
    success: true,
    id: result.id,
    created_at: result.created_at,
  });
});
