import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { normalizeGroupName, INTERNAL_GROUP } from "@/lib/authorization/membership";
import { readRegistryContacts } from "@/services/contacts/registryRead";
import { softDeleteRegistryContact } from "@/services/contacts/deletion";
import { registerContacts } from "@/services/contacts/registration";
import {
  buildContactUpdate,
  planContactProgramSync,
  findMissingProgram,
  applyContactProgramMembership,
  completeContactUpdate,
} from "@/services/contacts/update";
import {
  updateContactFields,
  deleteContactPrograms,
  ensureContactProgramMembership,
} from "@/models/contacts";
export const dynamic = "force-dynamic";

/**
 * CONTACTS API — PERSONNEL REGISTRY
 * Hardened for Gated Onboarding and Real-time Alerts.
 * Decisions live in `@/services/contacts`; this file is auth + response shape.
 */

export async function POST(req) {
  try {
    await initDb();
    // Auth is optional — public forms create contacts without login.
    const session = await getSession();
    if (session) {
      const capError = await requireAuthorization("contacts", "create");
      if (capError) return capError;
    }

    const assignRoleError = await requireAuthorization(
      "permissions",
      "assign_capabilities",
    );
    const canAssignRole = Boolean(session) && !assignRoleError;

    const body = await req.json();
    const contacts = Array.isArray(body) ? body : [body];

    const wantsInternal = contacts.some(
      (contact) => normalizeGroupName(contact?.group_name) === INTERNAL_GROUP,
    );
    if (wantsInternal) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    console.log("--- CONTACT REGISTRATION START ---", {
      count: contacts.length,
    });

    const { inserted, errors } = await registerContacts({
      contacts,
      session,
      canAssignRole,
    });

    if (inserted === 0 && errors.length > 0) {
      console.error("All registrations failed:", errors[0].error);
      return NextResponse.json(
        { success: false, error: `Database Error: ${errors[0].error}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, inserted, errors });
  } catch (error) {
    console.error("CRITICAL CONTACTS ERROR:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "edit");
    if (capError) return capError;

    const data = await req.json();

    if (normalizeGroupName(data?.group_name) === INTERNAL_GROUP) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const assignRoleError = await requireAuthorization("permissions", "assign_capabilities");
    const canAssignRole = !assignRoleError;
    const session = await getSession();

    // `archived_at` / `archived_by` record WHO archived and WHEN — the caller
    // sends only the `archived` intent; the server fills both from the session.
    let actor;
    if (data.archived !== undefined) {
      const session = await getSession();
      actor = session?.name || session?.email || session?.cid || "unknown";
    }

    const built = buildContactUpdate({ data, canAssignRole, actor });
    if (built.noFields) {
      return NextResponse.json({
        success: true,
        message: "No fields to update.",
      });
    }

    const updateResult = await updateContactFields(built.fieldsToUpdate, built.args);

    // Sync participant_programs if program_ids array is provided
    const plan = planContactProgramSync(data);

    if (plan.rolePromotion) {
      // Role is being changed to a non-participant role: they are no longer a
      // participant, so drop the enrollment. The conflict guard is skipped — the
      // role is changing on purpose.
      await deleteContactPrograms(data.cid);
    } else if (plan.programIds) {
      // Verify all programs exist before assigning
      const missing = await findMissingProgram(plan.programIds);
      if (missing) {
        return NextResponse.json(
          {
            success: false,
            error: `Program "${missing}" not found. Create it first before assigning.`,
          },
          { status: 404 },
        );
      }

      // Same-program conflict guard (Phase 2A): reject the update before any
      // membership mutation if the person is a facilitator in a target program.
      for (const programId of plan.programIds) {
        const conflictError = await assertNoParticipantFacilitatorConflict(
          programId,
          data.cid,
          data.email || null,
        );
        if (conflictError) return conflictError;
      }

      await applyContactProgramMembership({
        cid: data.cid,
        programIds: plan.programIds,
        assignedBy: data.assigned_by,
      });
    } else if (data.program_id) {
      // Single program_id fallback — ensure at least this one exists
      try {
        // Same-program conflict guard (Phase 2A).
        const conflictError = await assertNoParticipantFacilitatorConflict(
          data.program_id,
          data.cid,
          data.email || null,
        );
        if (conflictError) return conflictError;
        await ensureContactProgramMembership(data.cid, data.program_id);
      } catch (error) {
        console.error(`PUT program sync error for ${data.cid}:`, error.message);
      }
    }

    // If status changed to active/approved, clear the admin notifications
    await completeContactUpdate({ cid: data.cid, status: data.status });

    return NextResponse.json({
      success: true,
      rowsAffected: updateResult.rowsAffected,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const roleFilter = searchParams.get("role");
    const groupFilter = searchParams.get("group");
    const cidFilter = searchParams.get("cid");

    const capError = await requireAuthorization("contacts", "view");
    const canReadDirectory = !capError;

    const outcome = await readRegistryContacts({
      session,
      canReadDirectory,
      statusFilter,
      roleFilter,
      groupFilter,
      cidFilter,
    });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, contacts: outcome.contacts });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Soft-delete a contact (never physically deletes).
 */
export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "delete");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "Contact ID (cid) is required." },
        { status: 400 },
      );
    }

    const session = await getSession();
    const deletedBy =
      session?.name || session?.email || session?.cid || "unknown";

    // '__deleted_' || cid || '__' || email is unique because cid is the
    // primary key, so it can never collide with another row (or with a real
    // address), and the original email stays visible inside the placeholder.
    const deleted = await softDeleteRegistryContact(deletedBy, cid);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Contact not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact permanently deleted.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
