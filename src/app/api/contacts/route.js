import { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, getSession, assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { normalizeGroupName, INTERNAL_GROUP } from "@/lib/authorization/membership";
import { attachInvitationStatus } from "@/lib/invitations";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  createPasswordSetupToken,
  markContactInvited,
  upsertContact,
  createAccessRequestNotification,
  assignContactToProgram,
  createParticipantProgramAudit,
  findContactCidByPhone,
  createDuplicatePhoneFlag,
  updateContactFields,
  deleteContactPrograms,
  getProgramById,
  removeContactProgramsExcept,
  clearContactPrograms,
  addContactProgramMembership,
  recordParticipantProgramAudit,
  ensureContactProgramMembership,
  getContactIdentityByCid,
  markAdminNotificationsRead,
  getContactByCid,
  getArchivedContacts,
  getContactsForSuperAdmin,
  getContactsForStaff,
  getParticipantProgramCids,
  getContactRoleAssignmentCids,
  softDeleteContact,
} from "@/models/contacts";
export const dynamic = "force-dynamic";

/**
 * Generates an invite token and sends activation email. Non-blocking.
 */
async function fireInvite(cid, name, email, role, _groupId) {
  try {
    await ensureTokenHashColumns();
    const token = uuidv4();
    const tokenHash = hashToken(token);

    await createPasswordSetupToken(token, tokenHash, cid);

    await markContactInvited(cid).catch(() => {}); // Column may not exist yet — non-critical
    // Send email synchronously so Vercel doesn't kill the worker
    const { sendInviteEmail } = await import("@/lib/email");
    await sendInviteEmail({ to: email, name, role, token });
  } catch (error) {
    console.error("Invite fire failed:", error.message || error);
  }
}

/**
 * CONTACTS API — PERSONNEL REGISTRY
 * Hardened for Gated Onboarding and Real-time Alerts.
 */

export async function POST(req) {
  try {
    await initDb();
    // Auth is optional — public forms create contacts without login.
    // If authenticated, the resolver enforces the capability (eligibility
    // boundary included); unauthenticated submissions keep working.
    const session = await getSession();
    if (session) {
      const capError = await requireAuthorization("contacts", "create");
      if (capError) return capError;
    }

    const body = await req.json();
    const contacts = Array.isArray(body) ? body : [body];

    // Protected group boundary: creating a FUTURE STUDIO contact creates an
    // internal member (auto-role staff). Only org_membership.manage holders
    // may do that — generic contacts.create must never grant it.
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

    const validContacts = [];
    const errors = [];

    for (const contact of contacts) {
      // Mapping for Public Application Form
      const rawName = contact.name || contact.fullName || "Unknown Applicant";
      const rawEmail = (contact.email || "").toLowerCase().trim();

      if (!rawEmail) {
        errors.push({ name: rawName, error: "Email is required" });
        continue;
      }

      const cid =
        "USER_" +
        uuidv4().split("-")[0].toUpperCase() +
        Math.floor(Math.random() * 10000);

      // Admins never create user passwords. Store an unusable random hash so
      // the account can only gain a real password through the invitation /
      // activation flow (user sets their own password).
      const hashedPassword = await bcrypt.hash(uuidv4(), 10);

      // Gated Status Logic (UPPERCASE NORMALIZATION)
      const groupName = (contact.group_name || "unassigned").toUpperCase();
      const isInternal = groupName === "FUTURE STUDIO";

      // Use provided status, or default: approved for staff, pending for participants
      let initialStatus =
        contact.status ||
        (isInternal || contact.role === "participant" ? "pending" : "approved");

      // Strict Role Normalization
      let finalRole = contact.role;
      if (!finalRole || finalRole === "unassigned") {
        finalRole = isInternal ? "staff" : "unassigned";
      }

      validContacts.push({
        cid,
        name: rawName.trim(),
        email: rawEmail,
        phone: contact.phone || null,
        address: contact.address || contact.homeAddress || null,
        dob: contact.dob || null,
        group_name: groupName,
        role: finalRole,
        password: hashedPassword,
        program_id: contact.program_id || null,
        program_name: contact.program_name || null,
        image: contact.image || null,
        status: initialStatus,
        deleted: 0,
        gender: contact.gender || null,
        mother_name: contact.mother_name || null,
      });
    }

    let inserted = 0;
    for (const validContact of validContacts) {
      try {
        console.log(`Saving contact: ${validContact.email} as ${validContact.status}`);

        await upsertContact(validContact);

        if (validContact.status === "pending") {
          console.log("Triggering Admin Notification for:", validContact.name);
          await createAccessRequestNotification(validContact.name);
        }

        // Fire invite for ALL new contacts so they receive activation email
        if (validContact.email) {
          await fireInvite(
            validContact.cid,
            validContact.name,
            validContact.email,
            validContact.role,
            validContact.program_id,
          );
        }

        // If program_ids or program_id provided, sync to participant_programs
        const programIdsToAssign =
          validContact.program_ids && Array.isArray(validContact.program_ids)
            ? validContact.program_ids
            : validContact.program_id
              ? [validContact.program_id]
              : [];

        for (const programId of programIdsToAssign) {
          try {
            // Same-program conflict guard (Phase 2A): skip programs where the
            // person already holds a facilitator assignment.
            const conflictError = await assertNoParticipantFacilitatorConflict(
              programId,
              validContact.cid,
              validContact.email,
            );
            if (conflictError) {
              errors.push({
                email: validContact.email,
                program_id: programId,
                error: "errors.roleConflictParticipantFacilitator",
              });
              continue;
            }
            await assignContactToProgram(validContact.cid, programId);

            await createParticipantProgramAudit(validContact.cid, programId, "system");
          } catch (error) {
            console.error(
              `Failed to assign ${validContact.cid} to program ${programId}:`,
              error.message,
            );
          }
        }

        inserted++;
      } catch (error) {
        console.error(
          `SQL Save Error for ${validContact.email}:`,
          error.message,
        );
        errors.push({ email: validContact.email, error: error.message });
      }
    }

    if (inserted === 0 && errors.length > 0) {
      console.error("All registrations failed:", errors[0].error);
      return NextResponse.json(
        { success: false, error: `Database Error: ${errors[0].error}` },
        { status: 400 },
      );
    }

    // Fire duplicate detection for new contacts (non-blocking)
    if (inserted > 0) {
      Promise.resolve().then(async () => {
        for (const validContact of validContacts) {
          if (!validContact.phone) continue;
          try {
            const existing = await findContactCidByPhone(
              validContact.phone,
              validContact.cid,
              validContact.email,
            );
            if (existing.rows.length > 0) {
              await createDuplicatePhoneFlag(validContact.cid, existing.rows[0].cid);
            }
          } catch (_) {}
        }
      }).catch(() => {});
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

    if (!data.cid) {
      return NextResponse.json(
        { success: false, error: "Contact ID (cid) is required for update." },
        { status: 400 },
      );
    }

    // Protected group boundary: moving a contact into FUTURE STUDIO via a
    // generic contact edit is an organizational-membership action.
    if (normalizeGroupName(data?.group_name) === INTERNAL_GROUP) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const fieldsToUpdate = [];
    const args = [];

    // `archived_at` and `archived_by` are deliberately NOT caller-settable: they
    // record WHO archived a contact and WHEN. The caller sends the single intent
    // `archived: true|false` (handled below) and the server writes both, so a
    // caller holding `contacts.edit` cannot attribute an archive to somebody else
    // or date it themselves.
    const updatableColumns = [
      "name",
      "email",
      "phone",
      "address",
      "dob",
      "group_name",
      "role",
      "program_id",
      "program_name",
      "image",
      "status",
      "deleted",
      "gender",
      "mother_name",
    ];

    for (const column of updatableColumns) {
      if (data[column] !== undefined) {
        let value = data[column];
        if (typeof value === "string") value = value.trim();

        if (column === "email") {
          fieldsToUpdate.push(`${column} = ?`);
          args.push(value.toLowerCase());
        } else if (column === "group_name") {
          // Normalize group names to UPPERCASE at write time (matches the
          // membership layer) so case variants can never be re-created.
          fieldsToUpdate.push("group_name = ?");
          args.push(String(value || "").trim().toUpperCase());
        } else {
          fieldsToUpdate.push(`${column} = ?`);
          args.push(column === "deleted" ? (value ? 1 : 0) : value);
        }
      }
    }

    // Archive / restore: one intent, recorded by the server. The moment is the
    // server's clock and the actor is the session, never the request body.
    if (data.archived !== undefined) {
      const session = await getSession();
      const actor = session?.name || session?.email || session?.cid || "unknown";
      fieldsToUpdate.push("archived_at = ?", "archived_by = ?");
      if (data.archived) args.push(new Date().toISOString(), actor);
      else args.push(null, null);
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No fields to update.",
      });
    }

    args.push(data.cid);

    const updateResult = await updateContactFields(fieldsToUpdate, args);

    // Sync participant_programs if program_ids array is provided
    const NON_PARTICIPANT_ROLES = ["facilitator", "staff", "super_admin", "investor", "founder", "program_manager"];
    const isRolePromotion = data.role && NON_PARTICIPANT_ROLES.includes(data.role);

    if (isRolePromotion) {
      // Role is being changed to a non-participant role.
      // Automatically remove from participant_programs — they are no longer a participant.
      // Skip the conflict guard entirely since we're intentionally changing their role.
      await deleteContactPrograms(data.cid);
    } else if (Array.isArray(data.program_ids)) {
      // Verify all programs exist before assigning
      for (const programId of data.program_ids) {
        const programResult = await getProgramById(programId);
        if (programResult.rows.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Program "${programId}" not found. Create it first before assigning.`,
            },
            { status: 404 },
          );
        }
      }

      // Same-program conflict guard (Phase 2A): reject the update before any
      // membership mutation if the person is a facilitator in a target program.
      for (const programId of data.program_ids) {
        const conflictError = await assertNoParticipantFacilitatorConflict(
          programId,
          data.cid,
          data.email || null,
        );
        if (conflictError) return conflictError;
      }

      // Remove existing assignments not in the new list
      if (data.program_ids.length > 0) {
        await removeContactProgramsExcept(data.cid, data.program_ids);
      } else {
        await clearContactPrograms(data.cid);
      }

      // Add new assignments
      for (const programId of data.program_ids) {
        try {
          await addContactProgramMembership(data.cid, programId);

          await recordParticipantProgramAudit(
            data.cid,
            programId,
            data.assigned_by || "system",
          );
        } catch (error) {
          console.error(
            `PUT program sync error for ${data.cid}, program ${programId}:`,
            error.message,
          );
        }
      }
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

    // If status changed to active/approved, fire invite and clear notifications
    if (data.status === "active" || data.status === "approved") {
      try {
        const identityResult = await getContactIdentityByCid(data.cid);
        if (identityResult.rows.length > 0) {
          const contactRow = identityResult.rows[0];

          // Fire invite for approved staff (participants already invited on registration)
          // Commented out — invite is now sent on registration, not on approval
          // if (contactRow.role !== "participant") {
          //   fireInvite(data.cid, contactRow.name, contactRow.email, contactRow.role, null).catch(() => {});
          // }

          // Clear notifications
          await markAdminNotificationsRead(contactRow.name);
        }
      } catch (error) {
        console.error("Auto-Purge Failure:", error);
      }
    }

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
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const authError = await requireAuth();
    if (authError) return authError;
    // Phase 1.2: directory and cross-user reads require the contacts.view
    // capability (resolver + CRM eligibility). Every session keeps the right
    // to read its OWN contact record, so participants/founders/members can
    // always self-serve their profile without a profile seed.

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const roleFilter = searchParams.get("role");
    const groupFilter = searchParams.get("group");
    const cidFilter = searchParams.get("cid");

    const capError = await requireAuthorization("contacts", "view");
    const canReadDirectory = !capError;

    let result;
    if (!canReadDirectory) {
      // Own record only — a caller-chosen cid is ignored unless it is the
      // session's own cid (self lookup).
      if (cidFilter && String(cidFilter) !== String(session.cid)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      result = await getContactByCid(cidFilter || session.cid);
    } else if (statusFilter === "archived" && session.role === "super_admin") {
      // Archived contacts (archived but not soft-deleted)
      result = await getArchivedContacts();
    } else if (cidFilter) {
      result = await getContactByCid(cidFilter);
    } else if (session.role === "super_admin") {
      result = await getContactsForSuperAdmin(roleFilter, statusFilter, groupFilter);
    } else {
      // Staff/PM (with contacts.view): active contacts only, with the
      // role-appropriate status window (PMs also see pending contacts so they
      // can find unapproved people and assign them as facilitators).
      result = await getContactsForStaff(session.role, groupFilter);
    }
    const rows = result.rows || [];
    const contactCids = rows.map((row) => row.cid).filter(Boolean);
    let participantCids = new Set();
    let assignmentCids = new Set();
    if (contactCids.length > 0) {
      // Best-effort: these tables may not exist in older schemas.
      try {
        const participantProgramsResult = await getParticipantProgramCids(contactCids);
        participantCids = new Set(
          participantProgramsResult.rows.map((row) => row.participant_id),
        );
      } catch (_) {}
      try {
        const contactRoleAssignmentsResult =
          await getContactRoleAssignmentCids(contactCids);
        assignmentCids = new Set(
          contactRoleAssignmentsResult.rows.map((row) => row.contact_cid),
        );
      } catch (_) {}
    }
    const contacts = (await attachInvitationStatus(rows)).map(
      ({ password: _password, ...safeContact }) => ({
        ...safeContact,
        // Derived flags: a participant enrollment OR the legacy role value.
        is_participant:
          participantCids.has(safeContact.cid) ||
          safeContact.role === "participant",
        has_assignment: assignmentCids.has(safeContact.cid),
      }),
    );
    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Soft-delete a contact (never physically deletes).
 * Sets deleted_at/deleted_by/deleted and frees the email by replacing it with
 * a unique placeholder that keeps the original address for audit, so a new
 * contact can be created later with the same email without tripping the
 * contacts_email_key unique constraint. The contact disappears from all views.
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

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    const deletedBy = session?.name || session?.email || session?.cid || "unknown";

    // '__deleted_' || cid || '__' || email is unique because cid is the
    // primary key, so it can never collide with another row (or with a real
    // address), and the original email stays visible inside the placeholder.
    const result = await softDeleteContact(deletedBy, cid);

    if (result.rowsAffected === 0) {
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
