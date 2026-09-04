import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasVentureCapability } from "@/lib/venturePermissions";

/**
 * Internal Venture Notes — staff-only (Phase 4).
 *
 * Access rules:
 *  - GLOBAL roles (super_admin/developer/admin): full access (staff notes).
 *  - Delegated staff: an ACTIVE assignment is required. View/create/delete
 *    are evaluated at runtime against the `internal_notes` permission area:
 *      - Lead Manager default → view/create/comment/edit (full)
 *      - Coach/Facilitator default → view/create within their scope
 *  - Venture members/founders: NEVER (404 — no existence leak). Internal
 *    notes are staff instruments, not founder documents.
 *
 * Scope model: a note may carry scope_ref_type/scope_ref_id (milestone,
 * section, workstream). Delegated staff whose assignment is not
 * venture-wide only see unscoped notes + notes matching their scope.
 */

const GLOBAL_ROLES = ["super_admin", "developer", "admin"];

async function resolveCode(ventureId) {
  let code = ventureId;
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const byId = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [ventureId] });
      if (byId.rows?.[0]) code = byId.rows[0].venture_id;
    } catch (_) {}
  }
  return code;
}

async function isGlobal(session) {
  return !!session && GLOBAL_ROLES.includes(session.role);
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

// Matrix check for internal_notes:view without an object reference — a
// responsibility may grant/deny the whole area regardless of scope, then
// note-level visibility is applied per assignment scope.
async function responsibilityAllowsNoteView(ventureCode, responsibilityCode) {
  try {
    const ov = await db.execute({
      sql: "SELECT allowed FROM venture_permission_overrides WHERE venture_id = ? AND responsibility_code = ? AND area = 'internal_notes' AND action = 'view'",
      args: [ventureCode, responsibilityCode],
    });
    if (ov.rows?.[0]) return !!ov.rows[0].allowed;
    const def = await db.execute({
      sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = 'internal_notes' AND action = 'view'",
      args: [responsibilityCode],
    });
    return !!def.rows?.[0]?.allowed;
  } catch (_) {
    return false;
  }
}

async function resolveStaffAssignment(ventureCode, cid) {
  if (!cid) return null;
  const r = await db.execute({
    sql: "SELECT id, scope_type, scope_ref_type, scope_ref_id, responsibility_code FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' ORDER BY id DESC",
    args: [ventureCode, cid],
  });
  return r.rows || [];
}

export const GET = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid && !session?.role) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { id } = await params;
    const code = await resolveCode(id);

    const assignments = await resolveStaffAssignment(code, session.cid);

    // Founders/members (no assignment, no global role): internal notes do not exist for them.
    if (!isGlobal(session) && assignments.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    const global = isGlobal(session);

    // Delegated staff must have internal_notes:view under at least one of
    // their responsibilities (matrix + overrides; scope filter applies after).
    if (!global) {
      let canView = false;
      for (const a of assignments) {
        if (await responsibilityAllowsNoteView(code, a.responsibility_code)) { canView = true; break; }
      }
      if (!canView) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    const r = await db.execute({
      sql: "SELECT * FROM venture_notes WHERE venture_id = ? AND is_archived = FALSE ORDER BY created_at DESC",
      args: [code],
    });
    const all = r.rows || [];

    // Scope filtering: global sees everything; delegated staff see notes
    // matching any of their assignments (unscoped notes included).
    const visible = global
      ? all
      : all.filter((n) => assignments.some((a) => scopeMatchesAssignment(a, n)));

    const canPost = global || (await hasVentureCapability(db, { ventureId: code, contactId: session.cid, area: "internal_notes", action: "create" }));

    return NextResponse.json({ success: true, notes: visible, can_post: !!canPost, is_global: global });
  },
);

export const POST = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { id } = await params;
    const code = await resolveCode(id);
    const assignments = await resolveStaffAssignment(code, session.cid);

    if (!isGlobal(session) && assignments.length === 0) {
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

    if (!isGlobal(session)) {
      // Scope integrity: scoped notes may only be created inside the writer's scope.
      if (scopeRefType || scopeRefId) {
        const inScope = assignments.some(
          (a) => a.scope_type === "venture_wide" || (String(a.scope_ref_type || "") === String(scopeRefType) && String(a.scope_ref_id || "") === String(scopeRefId)),
        );
        if (!inScope) {
          return NextResponse.json({ success: false, error: "This note is outside your assigned scope." }, { status: 403 });
        }
      }
      const allowed = await hasVentureCapability(db, { ventureId: code, contactId: session.cid, area: "internal_notes", action: "create", scopeRefType, scopeRefId });
      if (!allowed) {
        return NextResponse.json({ success: false, error: "Your assignment does not allow creating internal notes." }, { status: 403 });
      }
    }

    const res = await db.execute({
      sql: "INSERT INTO venture_notes (venture_id, author_cid, author_name, title, body, scope_ref_type, scope_ref_id) VALUES (?,?,?,?,?,?,?) RETURNING id",
      args: [code, session.cid, session.name || null, title, text, scopeRefType, scopeRefId],
    });
    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: code, event_type: "INTERNAL_NOTE_CREATED", description: `Internal note "${title}" created` });
    } catch (_) {}
    return NextResponse.json({ success: true, id: res.rows?.[0]?.id ?? null });
  },
);

export const DELETE = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { id } = await params;
    const code = await resolveCode(id);
    const assignments = await resolveStaffAssignment(code, session.cid);
    if (!isGlobal(session) && assignments.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const body = await req.json();
    const noteId = body.note_id;
    if (!noteId) return NextResponse.json({ success: false, error: "note_id is required." }, { status: 400 });

    const noteRes = await db.execute({ sql: "SELECT * FROM venture_notes WHERE id = ? AND venture_id = ?", args: [noteId, code] });
    const note = noteRes.rows?.[0];
    if (!note) return NextResponse.json({ success: false, error: "Note not found." }, { status: 404 });

    if (!isGlobal(session)) {
      // Author may retract their own note; otherwise the matrix must grant delete.
      const isAuthor = String(note.author_cid || "") === String(session.cid);
      const allowed = isAuthor || (await hasVentureCapability(db, { ventureId: code, contactId: session.cid, area: "internal_notes", action: "delete" }));
      if (!allowed) {
        return NextResponse.json({ success: false, error: "Not allowed to delete this note." }, { status: 403 });
      }
    }

    await db.execute({ sql: "UPDATE venture_notes SET is_archived = TRUE, updated_at = NOW() WHERE id = ?", args: [noteId] });
    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: code, event_type: "INTERNAL_NOTE_ARCHIVED", description: `Internal note archived` });
    } catch (_) {}
    return NextResponse.json({ success: true });
  },
);
