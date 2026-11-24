import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { hasVentureCapability } from "@/services/ventures/permissions";
import { resolveVenturePortfolioAccess } from "@/services/ventures/portfolioAccess";
import {
  getVentureCodeByDbId,
  getInternalNotesViewPermission,
  listActiveStaffAssignmentsByCode,
  listVentureNotes,
  insertVentureNote,
  getVentureNote,
  archiveVentureNote,
  NOTE_KINDS,
} from "@/models/ventureWorkspace";

/**
 * Internal Venture Notes — staff-only (Phase 4).
 *
 * Access rules:
 *  - GLOBAL roles (super_admin): full access (staff notes).
 *  - Delegated staff: an ACTIVE assignment is required. View/create/delete
 *    are evaluated at runtime against the `internal_notes` permission area:
 *      - Venture Manager default → view/create/comment/edit (full)
 *      - Coach/Facilitator default → view/create within their scope
 *  - Venture members/founders: NEVER (404 — no existence leak). Internal
 *    notes are staff instruments, not founder documents.
 *
 * Scope model: a note may carry scope_ref_type/scope_ref_id (milestone,
 * section, workstream). Delegated staff whose assignment is not
 * venture-wide only see unscoped notes + notes matching their scope.
 */

async function resolveCode(ventureId) {
  let code = ventureId;
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const ventureByUuid = await getVentureCodeByDbId(ventureId);
      if (ventureByUuid.rows?.[0]) code = ventureByUuid.rows[0].venture_id;
    } catch (_) {}
  }
  return code;
}


async function scopeMatchesAssignment(assignment, note) {
  if (assignment.scope_type === "venture_wide") return true;
  // Unscoped notes are visible to all assigned staff.
  if (!note.scope_ref_type && !note.scope_ref_id) return true;
  return (
    String(assignment.scope_ref_type || "") === String(note.scope_ref_type || "") &&
    String(assignment.scope_ref_id || "") === String(note.scope_ref_id || "")
  );
}

// Matrix check for internal_notes:view without an object reference — the
// GLOBAL matrix decides whether the responsibility may view the area at all,
// then note-level visibility is applied per assignment scope.
async function responsibilityAllowsNoteView(responsibilityCode) {
  try {
    const definition = await getInternalNotesViewPermission(responsibilityCode);
    return !!definition.rows?.[0]?.allowed;
  } catch (_) {
    return false;
  }
}

async function resolveStaffAssignment(ventureCode, cid) {
  if (!cid) return null;
  const assignmentsResult = await listActiveStaffAssignmentsByCode(ventureCode, cid);
  return assignmentsResult.rows || [];
}

export const GET = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid && !session?.role) return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    const { id } = await params;
    const code = await resolveCode(id);

    const assignments = await resolveStaffAssignment(code, session.cid);
    // The unscoped notes authority is the explicit portfolio READ right.
    const global = (await resolveVenturePortfolioAccess({ session, action: "view" })).allowed;

    // Founders/members (no assignment, no portfolio right): internal notes do not exist for them.
    if (!global && assignments.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    // Delegated staff must have internal_notes:view under at least one of
    // their responsibilities (GLOBAL matrix; scope filter applies after).
    if (!global) {
      let canView = false;
      for (const assignment of assignments) {
        if (await responsibilityAllowsNoteView(assignment.responsibility_code)) { canView = true; break; }
      }
      if (!canView) return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const scopeType = searchParams.get("scope_type");
    const scopeId = searchParams.get("scope_id");
    // Contextual reads (Phase 2): object views (journey stage / milestone /
    // task) load exactly their own notes. Additive — no param = all notes.
    const notesResult = await listVentureNotes({ ventureCode: code, scopeType, scopeId });
    const allNotes = notesResult.rows || [];

    // Scope filtering: global sees everything; delegated staff see notes
    // matching any of their assignments (unscoped notes included).
    const visible = global
      ? allNotes
      : allNotes.filter((note) => assignments.some((assignment) => scopeMatchesAssignment(assignment, note)));

    // Posting is a WRITE: the portfolio READ right does not offer the form.
    const canManage = (await resolveVenturePortfolioAccess({ session, action: "edit" })).allowed;
    const canPost = canManage || (await hasVentureCapability({ ventureId: code, contactId: session.cid, area: "internal_notes", action: "create" }));

    return NextResponse.json({ success: true, notes: visible, can_post: !!canPost, is_global: global });
  },
);

export const POST = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    const { id } = await params;
    const code = await resolveCode(id);
    const assignments = await resolveStaffAssignment(code, session.cid);
    // Writing internal notes requires the explicit portfolio WRITE right.
    const global = (await resolveVenturePortfolioAccess({ session, action: "edit" })).allowed;

    if (!global && assignments.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const text = String(body.body || "").trim();
    if (!title || !text) {
      return NextResponse.json({ success: false, error: "title and body are required." }, { status: 400 });
    }
    const scopeRefType = body.scope_ref_type || null;
    const scopeRefId = body.scope_ref_id ? String(body.scope_ref_id) : null;
    // WHAT the note is. Every note is filed on a milestone either way, so this is
    // the only thing that can tell an activity report from a note written on the
    // milestone itself. Unknown values fall back to a milestone note.
    const noteKind = NOTE_KINDS.includes(String(body.note_kind || "")) ? String(body.note_kind) : "milestone";
    // Vinance 3 rule: internal notes belong to a milestone and never exist
    // outside one — venture-wide, section and workstream scopes are refused.
    if (scopeRefType !== "milestone" || !scopeRefId) {
      return NextResponse.json({ success: false, error: "Internal notes are milestone-scoped: a milestone is required." }, { status: 400 });
    }
    // Attachments (Phase 2): array of { name, url, type?, size? } — links and
    // files kept next to the note they belong to.
    let attachments = null;
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      attachments = body.attachments
        .filter((attachment) => attachment && (attachment.name || attachment.url))
        .slice(0, 20)
        .map((attachment) => ({ name: String(attachment.name || "").slice(0, 255), url: String(attachment.url || "").slice(0, 2000), type: attachment.type ? String(attachment.type).slice(0, 100) : null, size: attachment.size || null }));
    }

    if (!global) {
      // Scope integrity: scoped notes may only be created inside the writer's scope.
      if (scopeRefType || scopeRefId) {
        const inScope = assignments.some(
          (assignment) => assignment.scope_type === "venture_wide" || (String(assignment.scope_ref_type || "") === String(scopeRefType) && String(assignment.scope_ref_id || "") === String(scopeRefId)),
        );
        if (!inScope) {
          return NextResponse.json({ success: false, error: "errors.outsideAssignedScope" }, { status: 403 });
        }
      }
      const allowed = await hasVentureCapability({ ventureId: code, contactId: session.cid, area: "internal_notes", action: "create", scopeRefType, scopeRefId });
      if (!allowed) {
        return NextResponse.json({ success: false, error: "errors.internalNotesCreateDenied" }, { status: 403 });
      }
    }

    const insertResult = await insertVentureNote({
      ventureCode: code,
      authorCid: session.cid,
      authorName: session.name || null,
      title,
      body: text,
      scopeRefType,
      scopeRefId,
      attachments,
      noteKind,
    });
    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      await addVentureHistory({ venture_id: code, event_type: "INTERNAL_NOTE_CREATED", description: `Internal note "${title}" created` });
    } catch (_) {}
    return NextResponse.json({ success: true, id: insertResult.rows?.[0]?.id ?? null });
  },
);

export const DELETE = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    const { id } = await params;
    const code = await resolveCode(id);
    const assignments = await resolveStaffAssignment(code, session.cid);
    // Deleting any note requires the explicit portfolio WRITE right.
    const global = (await resolveVenturePortfolioAccess({ session, action: "edit" })).allowed;
    if (!global && assignments.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const body = await req.json();
    const noteId = body.note_id;
    if (!noteId) return NextResponse.json({ success: false, error: "note_id is required." }, { status: 400 });

    const noteResult = await getVentureNote(noteId, code);
    const note = noteResult.rows?.[0];
    if (!note) return NextResponse.json({ success: false, error: "Note not found." }, { status: 404 });

    if (!global) {
      // Author may retract their own note; otherwise the matrix must grant delete.
      const isAuthor = String(note.author_cid || "") === String(session.cid);
      const allowed = isAuthor || (await hasVentureCapability({ ventureId: code, contactId: session.cid, area: "internal_notes", action: "delete" }));
      if (!allowed) {
        return NextResponse.json({ success: false, error: "errors.noteDeleteDenied" }, { status: 403 });
      }
    }

    await archiveVentureNote(noteId);
    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      await addVentureHistory({ venture_id: code, event_type: "INTERNAL_NOTE_ARCHIVED", description: `Internal note archived` });
    } catch (_) {}
    return NextResponse.json({ success: true });
  },
);
