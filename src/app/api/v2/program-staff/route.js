// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, isAssignedPmForProgram } from "@/lib/auth";
import { buildFullFacilitatorPermissions } from "@/lib/facilitator-permissions";

/**
 * PM-scope guard: staff may only manage a program's staff/facilitators when
 * they are the assigned PM of that program (Phase 10 model — PM is a function
 * layered on Staff). SA and legacy bypass roles pass through.
 */
async function assertPmScope(programId) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "errors.authRequired" },
      { status: 401 },
    );
  }
  if (session.role === "super_admin") return null;
  if (["program_manager", "teacher"].includes(session.role)) return null;
  if (session.role === "staff") {
    const isPm = await isAssignedPmForProgram(programId, session.cid);
    if (isPm) return null;
  }
  return NextResponse.json(
    { success: false, error: "errors.insufficientPermissions" },
    { status: 403 },
  );
}

async function logFacilitatorTimeline(staffId, programId, eventType, description, extra = {}) {
  try {
    const session = await getSession();
    await db.execute({
      sql: "INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata) VALUES (?, ?, ?, 'programs', ?, ?, ?::jsonb)",
      args: [staffId, eventType, description, String(programId || ""), session?.cid || "system", JSON.stringify(extra)],
    });
  } catch (_) {}
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staff_id");
    const programId = searchParams.get("program_id");

    // Staff may only read their own assignments or assignments of a program
    // they are the assigned PM of (never the whole table).
    const session = await getSession();
    if (session?.role === "staff") {
      if (staffId && String(staffId) !== String(session.cid)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      if (programId) {
        const scopeError = await assertPmScope(programId);
        if (scopeError) return scopeError;
      } else if (!staffId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    let query = `
      SELECT ps.*, p.name as program_name, p.status as program_status
      FROM v2_program_staff ps
      JOIN v2_programs p ON ps.program_id = p.id
    `;
    let args = [];

    if (staffId) {
      query += " WHERE ps.staff_id = ?";
      args = [staffId];
    } else if (programId) {
      query += " WHERE ps.program_id = ?";
      args = [programId];
    }

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ success: true, assignments: res.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { program_id, staff_id, role, permissions } = await req.json();
    const roleLower = String(role || "").toLowerCase();

    const session = await getSession();
    if (session?.role === "staff") {
      const scopeError = await assertPmScope(program_id);
      if (scopeError) return scopeError;
    }

    // Same safeguard as the v1 program-staff and bulk-invite paths: an empty
    // permissions payload must never silently strip a facilitator's access.
    const finalPermissions =
      permissions && Object.keys(permissions).length > 0
        ? permissions
        : roleLower === "facilitator"
          ? buildFullFacilitatorPermissions()
          : {};

    if (roleLower === "facilitator") {
      const contactRes = await db.execute({ sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1", args: [staff_id] });
      const contactEmail = contactRes.rows[0]?.email || "";
      const conflict = await db.execute({
        sql: `SELECT 1 FROM participant_programs WHERE participant_id::text = ? AND program_id::text = ?
              UNION
              SELECT 1 FROM v2_participants WHERE program_id::text = ? AND (email = ? OR user_id = ?)
              LIMIT 1`,
        args: [String(staff_id), String(program_id), String(program_id), contactEmail, String(staff_id)],
      });
      if (conflict.rows.length > 0) {
        return NextResponse.json({ success: false, error: "errors.roleConflictParticipantFacilitator" }, { status: 409 });
      }
    }

    const res = await db.execute({
      sql: "INSERT INTO v2_program_staff (program_id, staff_id, role, permissions) VALUES (?, ?, ?, ?::jsonb) ON CONFLICT (program_id, staff_id) DO UPDATE SET role = EXCLUDED.role, permissions = COALESCE(EXCLUDED.permissions, v2_program_staff.permissions), updated_at = NOW() RETURNING id",
      args: [program_id, staff_id, role || "staff", JSON.stringify(finalPermissions)],
    });
    if (roleLower === "facilitator") {
      await logFacilitatorTimeline(staff_id, program_id, "facilitator_assigned", "Assigned as facilitator to program", { role });
    }

    // Mirror into the generalized assignment record (additive, idempotent) so
    // PM-managed program-staff assignments keep parity with the V1 program-staff
    // path and the bulk-invite path. Non-fatal: never breaks the PM flow.
    try {
      const actor = await getSession();
      const mirrorRole = String(role || "staff").toLowerCase();
      await db.execute({
        sql: `INSERT INTO contact_roles
                (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
              SELECT c.cid, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, ?
              FROM contacts c
              WHERE (c.cid = ? OR LOWER(c.email) = LOWER(?))
                AND c.deleted = 0
                AND NOT EXISTS (
                  SELECT 1 FROM contact_roles cr
                  WHERE cr.contact_cid = c.cid
                    AND cr.role = ?
                    AND cr.context_type = 'program'
                    AND cr.context_id = ?
                    AND cr.is_current = true
                )`,
        args: [
          mirrorRole,
          String(program_id),
          mirrorRole,
          JSON.stringify(finalPermissions),
          actor?.cid || "system",
          staff_id,
          staff_id,
          mirrorRole,
          String(program_id),
        ],
      });
    } catch (_) {}

    return NextResponse.json({ success: true, id: res.rows[0]?.id ?? res.lastInsertRowid });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { id, role, permissions } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const target = await db.execute({
      sql: "SELECT role, program_id FROM v2_program_staff WHERE id = ?",
      args: [id],
    });
    if (session?.role === "staff" && target.rows[0]?.program_id) {
      const scopeError = await assertPmScope(target.rows[0].program_id);
      if (scopeError) return scopeError;
    }

    const fields = [];
    const args = [];
    if (role !== undefined) {
      fields.push("role = ?");
      args.push(role);
    }
    if (permissions !== undefined) {
      const targetIsFacilitator =
        String(target.rows[0]?.role || "").toLowerCase() === "facilitator";
      const hasPerms =
        permissions &&
        typeof permissions === "object" &&
        Object.keys(permissions).length > 0;
      const resolved = hasPerms
        ? permissions
        : targetIsFacilitator
          ? buildFullFacilitatorPermissions()
          : {};
      fields.push("permissions = ?");
      args.push(JSON.stringify(resolved));
    }
    if (fields.length === 0) {
      return NextResponse.json({ success: true, message: "No fields to update." });
    }
    fields.push("updated_at = NOW()");
    args.push(id);
    await db.execute({
      sql: `UPDATE v2_program_staff SET ${fields.join(", ")} WHERE id = ?`,
      args,
    });
    const row = await db.execute({ sql: "SELECT staff_id, program_id, role, permissions FROM v2_program_staff WHERE id = ?", args: [id] });
    if (row.rows[0]) {
      await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_role_changed", "Facilitator program assignment updated", { role: row.rows[0].role, permissions: permissions || null });

      // Mirror the final assignment state into the generalized record.
      try {
        const assignment = row.rows[0];
        const cidRes = await db.execute({
          sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
          args: [assignment.staff_id, assignment.staff_id],
        });
        const contactCid = cidRes.rows[0]?.cid;
        if (contactCid) {
          const finalRole = assignment.role || "staff";
          const finalPerms = JSON.stringify(assignment.permissions || {});
          const mirrorUpdate = await db.execute({
            sql: `UPDATE contact_roles
                  SET title = ?, capability_overrides = ?::jsonb
                  WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
            args: [finalRole, finalPerms, contactCid, String(assignment.program_id)],
          });
          if (mirrorUpdate.rowsAffected === 0) {
            await db.execute({
              sql: `INSERT INTO contact_roles
                      (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                    VALUES (?, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, 'system')`,
              args: [contactCid, finalRole, String(assignment.program_id), finalRole, finalPerms],
            });
          }
        }
      } catch (_) {}
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { id } = await req.json();
    const row = await db.execute({ sql: "SELECT staff_id, program_id FROM v2_program_staff WHERE id = ?", args: [id] });
    const session = await getSession();
    if (session?.role === "staff" && row.rows[0]?.program_id) {
      const scopeError = await assertPmScope(row.rows[0].program_id);
      if (scopeError) return scopeError;
    }
    await db.execute({
      sql: "DELETE FROM v2_program_staff WHERE id = ?",
      args: [id],
    });
    if (row.rows[0]) {
      await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_removed", "Removed from program (assignment only — CRM record untouched)");

      // Preserve assignment history in the generalized record: mark ended.
      try {
        const cidRes = await db.execute({
          sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
          args: [row.rows[0].staff_id, row.rows[0].staff_id],
        });
        const contactCid = cidRes.rows[0]?.cid;
        if (contactCid) {
          await db.execute({
            sql: `UPDATE contact_roles
                  SET is_current = false, ended_at = NOW(), status = 'removed'
                  WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
            args: [contactCid, String(row.rows[0].program_id)],
          });
        }
      } catch (_) {}
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
