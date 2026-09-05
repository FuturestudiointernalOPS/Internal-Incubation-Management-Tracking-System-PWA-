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
async function fireInvite(cid, name, email, role, groupId) {
  try {
    await ensureTokenHashColumns();
    const token = uuidv4();
    const tokenHash = hashToken(token);

    await createPasswordSetupToken(token, tokenHash, cid);

    await markContactInvited(cid).catch(() => {}); // Column may not exist yet — non-critical
    // Send email synchronously so Vercel doesn't kill the worker
    const { sendInviteEmail } = await import("@/lib/email");
    await sendInviteEmail({ to: email, name, role, token });
  } catch (e) {
    console.error("Invite fire failed:", e.message || e);
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
      (c) => normalizeGroupName(c?.group_name) === INTERNAL_GROUP,
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

    for (const c of contacts) {
      // Mapping for Public Application Form
      const rawName = c.name || c.fullName || "Unknown Applicant";
      const rawEmail = (c.email || "").toLowerCase().trim();

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
      const groupName = (c.group_name || "unassigned").toUpperCase();
      const isInternal = groupName === "FUTURE STUDIO";

      // Use provided status, or default: approved for staff, pending for participants
      let initialStatus =
        c.status ||
        (isInternal || c.role === "participant" ? "pending" : "approved");

      // Strict Role Normalization
      let finalRole = c.role;
      if (!finalRole || finalRole === "unassigned") {
        finalRole = isInternal ? "staff" : "unassigned";
      }

      validContacts.push({
        cid,
        name: rawName.trim(),
        email: rawEmail,
        phone: c.phone || null,
        address: c.address || c.homeAddress || null,
        dob: c.dob || null,
        group_name: groupName,
        role: finalRole,
        password: hashedPassword,
        program_id: c.program_id || null,
        program_name: c.program_name || null,
        image: c.image || null,
        status: initialStatus,
        deleted: 0,
        gender: c.gender || null,
        mother_name: c.mother_name || null,
      });
    }

    let inserted = 0;
    for (const vc of validContacts) {
      try {
        console.log(`Saving contact: ${vc.email} as ${vc.status}`);

        await upsertContact(vc);

        if (vc.status === "pending") {
          console.log("Triggering Admin Notification for:", vc.name);
          await createAccessRequestNotification(vc.name);
        }

        // Fire invite for ALL new contacts so they receive activation email
        if (vc.email) {
          await fireInvite(vc.cid, vc.name, vc.email, vc.role, vc.program_id);
        }

        // If program_ids or program_id provided, sync to participant_programs
        const programIdsToAssign =
          vc.program_ids && Array.isArray(vc.program_ids)
            ? vc.program_ids
            : vc.program_id
              ? [vc.program_id]
              : [];

        for (const pid of programIdsToAssign) {
          try {
            // Same-program conflict guard (Phase 2A): skip programs where the
            // person already holds a facilitator assignment.
            const conflictError = await assertNoParticipantFacilitatorConflict(
              pid,
              vc.cid,
              vc.email,
            );
            if (conflictError) {
              errors.push({ email: vc.email, program_id: pid, error: "errors.roleConflictParticipantFacilitator" });
              continue;
            }
            await assignContactToProgram(vc.cid, pid);

            await createParticipantProgramAudit(vc.cid, pid, "system");
          } catch (e) {
            console.error(
              `Failed to assign ${vc.cid} to program ${pid}:`,
              e.message,
            );
          }
        }

        inserted++;
      } catch (err) {
        console.error(`SQL Save Error for ${vc.email}:`, err.message);
        errors.push({ email: vc.email, error: err.message });
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
        for (const vc of validContacts) {
          if (!vc.phone) continue;
          try {
            const existing = await findContactCidByPhone(vc.phone, vc.cid, vc.email);
            if (existing.rows.length > 0) {
              await createDuplicatePhoneFlag(vc.cid, existing.rows[0].cid);
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
      "archived_at",
      "archived_by",
      "gender",
      "mother_name",
    ];

    for (const col of updatableColumns) {
      if (data[col] !== undefined) {
        let val = data[col];
        if (typeof val === "string") val = val.trim();

        if (col === "email") {
          fieldsToUpdate.push(`${col} = ?`);
          args.push(val.toLowerCase());
        } else if (col === "group_name") {
          // Normalize group names to UPPERCASE at write time (matches the
          // membership layer) so case variants can never be re-created.
          fieldsToUpdate.push("group_name = ?");
          args.push(String(val || "").trim().toUpperCase());
        } else if (col === "archived_at" || col === "archived_by") {
          // Allow NULL for restore, or timestamp/text for archive
          fieldsToUpdate.push(`${col} = ?`);
          args.push(val || null);
        } else {
          fieldsToUpdate.push(`${col} = ?`);
          args.push(col === "deleted" ? (val ? 1 : 0) : val);
        }
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No fields to update.",
      });
    }

    args.push(data.cid);

    const match = await updateContactFields(fieldsToUpdate, args);

    // Sync participant_programs if program_ids array is provided
    const NON_PARTICIPANT_ROLES = ["facilitator", "teacher", "staff", "admin", "developer", "super_admin", "investor", "founder", "program_manager"];
    const isRolePromotion = data.role && NON_PARTICIPANT_ROLES.includes(data.role);

    if (isRolePromotion) {
      // Role is being changed to a non-participant role.
      // Automatically remove from participant_programs — they are no longer a participant.
      // Skip the conflict guard entirely since we're intentionally changing their role.
      await deleteContactPrograms(data.cid);
    } else if (Array.isArray(data.program_ids)) {
      // Verify all programs exist before assigning
      for (const pid of data.program_ids) {
        const check = await getProgramById(pid);
        if (check.rows.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Program "${pid}" not found. Create it first before assigning.`,
            },
            { status: 404 },
          );
        }
      }

      // Same-program conflict guard (Phase 2A): reject the update before any
      // membership mutation if the person is a facilitator in a target program.
      for (const pid of data.program_ids) {
        const conflictError = await assertNoParticipantFacilitatorConflict(
          pid,
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
      for (const pid of data.program_ids) {
        try {
          await addContactProgramMembership(data.cid, pid);

          await recordParticipantProgramAudit(data.cid, pid, data.assigned_by || "system");
        } catch (e) {
          console.error(
            `PUT program sync error for ${data.cid}, program ${pid}:`,
            e.message,
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
      } catch (e) {
        console.error(`PUT program sync error for ${data.cid}:`, e.message);
      }
    }

    // If status changed to active/approved, fire invite and clear notifications
    if (data.status === "active" || data.status === "approved") {
      try {
        const userRes = await getContactIdentityByCid(data.cid);
        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];

          // Fire invite for approved staff (participants already invited on registration)
          // Commented out — invite is now sent on registration, not on approval
          // if (u.role !== "participant") {
          //   fireInvite(data.cid, u.name, u.email, u.role, null).catch(() => {});
          // }

          // Clear notifications
          await markAdminNotificationsRead(u.name);
        }
      } catch (e) {
        console.error("Auto-Purge Failure:", e);
      }
    }

    return NextResponse.json({
      success: true,
      rowsAffected: match.rowsAffected,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
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

    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
      "founder",
    ]);
    if (authError) return authError;
    // Read access is gated by the role allowlist above. Participants/founders
    // are additionally scoped to their own contact below, so no extra
    // capability check is required here (avoids 403s for roles whose access
    // profile has not been seeded yet).

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const roleFilter = searchParams.get("role");
    const groupFilter = searchParams.get("group");
    const cidFilter = searchParams.get("cid");

    let result;
    if (cidFilter) {
      result = await getContactByCid(cidFilter);
    } else if (session.role === "participant" || session.role === "founder") {
      result = await getContactByCid(session.cid);
    } else if (statusFilter === "archived" && session.role === "super_admin") {
      // Archived contacts (archived but not soft-deleted)
      result = await getArchivedContacts();
    } else if (session.role === "super_admin") {
      result = await getContactsForSuperAdmin(roleFilter, statusFilter, groupFilter);
    } else {
      // Staff/Teacher: active only. Program managers also see pending contacts
      // so they can find unapproved people and assign them as facilitators.
      result = await getContactsForStaff(session.role, groupFilter);
    }
    const rows = result.rows || [];
    const cids = rows.map((r) => r.cid).filter(Boolean);
    let participantCids = new Set();
    let assignmentCids = new Set();
    if (cids.length > 0) {
      // Best-effort: these tables may not exist in older schemas.
      try {
        const ppRes = await getParticipantProgramCids(cids);
        participantCids = new Set(ppRes.rows.map((r) => r.participant_id));
      } catch (_) {}
      try {
        const crRes = await getContactRoleAssignmentCids(cids);
        assignmentCids = new Set(crRes.rows.map((r) => r.contact_cid));
      } catch (_) {}
    }
    const contacts = (await attachInvitationStatus(rows)).map(
      ({ password, ...safeContact }) => ({
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
