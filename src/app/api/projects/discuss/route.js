import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth";
import { createHandler } from "@/lib/api/createHandler";
import {
  getProjectDiscussionMessages,
  createProjectDiscussionMessage,
  getProjectMemberCids,
  getProjectOwnerAndName,
  createProjectDiscussionNotification,
  findContactsByNames,
} from "@/models/projectCollaboration";

/**
 * PROJECT DISCUSSIONS API (Ticket 4.3)
 *
 * GET  /api/projects/discuss?project_id=X
 *   - Returns all discussion messages for a project, oldest first
 *
 * POST /api/projects/discuss
 *   - Creates a new discussion message in the project context
 *   - Body: { project_id, sender_id, sender_name, body }
 *   - Notifies all project members (type: "project_discussion")
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

  const result = await getProjectDiscussionMessages(project_id);

  return NextResponse.json({ success: true, messages: result.rows });
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

  const result = await createProjectDiscussionMessage(
    sender_id,
    "Project Discussion",
    messageBody,
    project_id,
  );

  const row = result.rows[0] || {};

  // Notify all project members (except sender)
  try {
    const membersRes = await getProjectMemberCids(project_id);

    // Also get project owner
    const projectRes = await getProjectOwnerAndName(project_id);

    const projectName = projectRes.rows[0]?.name || "a project";
    const notified = new Set();

    const insertNotif = async (recipientId, title, message, type) => {
      await createProjectDiscussionNotification(
        recipientId,
        title,
        message,
        type,
      );
    };

    // Notify project owner
    const ownerId = projectRes.rows[0]?.owner_id;
    if (ownerId && ownerId !== sender_id) {
      notified.add(ownerId);
      await insertNotif(
        ownerId,
        "New Discussion Message",
        `${sender_name || "Someone"} posted in "${projectName}"`,
        "project_discussion",
      );
    }

    // Notify all members
    for (const member of membersRes.rows) {
      if (member.user_cid === sender_id) continue;
      if (notified.has(member.user_cid)) continue;
      notified.add(member.user_cid);
      await insertNotif(
        member.user_cid,
        "New Discussion Message",
        `${sender_name || "Someone"} posted in "${projectName}"`,
        "project_discussion",
      );
    }

    // Handle @mentions
    const mentionRegex = /@(\w[\w\s.-]*?\w)\b/g;
    let match;
    const mentionedNames = new Set();
    while ((match = mentionRegex.exec(messageBody)) !== null) {
      mentionedNames.add(match[1].trim().toLowerCase());
    }

    if (mentionedNames.size > 0) {
      const namesArray = [...mentionedNames];
      const mentionRes = await findContactsByNames(namesArray);

      for (const mentioned of mentionRes.rows) {
        if (notified.has(mentioned.cid)) continue;
        if (mentioned.cid === sender_id) continue;
        await insertNotif(
          mentioned.cid,
          "Mention in Discussion",
          `${sender_name || "Someone"} mentioned you in "${projectName}"`,
          "mention",
        );
      }
    }
  } catch (_) {
    // Notification failure is non-fatal
  }

  return NextResponse.json({
    success: true,
    id: Number(row.id),
    created_at: row.created_at,
  });
});
