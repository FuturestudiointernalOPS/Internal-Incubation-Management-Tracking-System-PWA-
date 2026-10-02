/**
 * CONTACT REGISTRATION — the create use-case (single or bulk).
 *
 * Role and status are server-controlled boundaries: login derives the session
 * role from `contacts.role`, so only a caller holding the role-assignment
 * capability may choose them; an unauthenticated self-service submission never
 * can. Admins never create user passwords — an unusable random hash is stored so
 * the account can only gain a real password through the activation flow. A
 * program enrollment is NOT a self-service field either: only an authenticated
 * caller may name a program.
 *
 * Writes go through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { v4 as uuidv4 } from "uuid";
import { hashPassword } from "@/server/auth/password";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  createPasswordSetupToken,
  markContactInvited,
  upsertContact,
  createAccessRequestNotification,
  findContactCidByPhone,
} from "@/models/contacts/contactStore";
import {
  assignContactToProgram,
  createParticipantProgramAudit,
} from "@/models/contacts/programMembership";
import {
  createDuplicatePhoneFlag,
} from "@/models/contacts/duplicates";

/**
 * Self-service roles: the only roles a caller WITHOUT the role-assignment
 * capability may request. Login derives the session role from contacts.role,
 * so anything beyond this list is a privilege boundary.
 */
const SELF_SERVICE_ROLES = new Set(["participant", "member", "applicant", "unassigned"]);

/** Statuses a self-service submission may legitimately produce. */
const SAFE_STATUSES = ["pending", "approved", "active"];

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
    await sendInviteEmail({ to: email, name, role, token, contact_cid: cid });
  } catch (error) {
    console.error("Invite fire failed:", error.message || error);
  }
}

/**
 * Create the given contacts. Returns `{ inserted, errors }`.
 */
export async function registerContacts({ contacts, session, canAssignRole }) {
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
    const hashedPassword = await hashPassword(uuidv4());

    // Gated Status Logic (UPPERCASE NORMALIZATION)
    const groupName = (contact.group_name || "unassigned").toUpperCase();
    const isInternal = groupName === "FUTURE STUDIO";

    // Strict Role Normalization. Privileged callers keep the original
    // behaviour; everyone else may only request a self-service role, so a
    // public submission can never grant an elevated identity. `isInternal`
    // is reachable only after the FUTURE STUDIO org-membership gate above.
    const requestedRole =
      typeof contact.role === "string" ? contact.role.trim() : "";
    let finalRole;
    if (canAssignRole) {
      finalRole = requestedRole;
      if (!finalRole || finalRole === "unassigned") {
        finalRole = isInternal ? "staff" : "unassigned";
      }
    } else {
      finalRole = SELF_SERVICE_ROLES.has(requestedRole)
        ? requestedRole
        : isInternal
          ? "staff"
          : "unassigned";
    }

    // Use provided status, or default: approved for staff, pending for
    // participants. Non-privileged callers are limited to the safe set, and a
    // public (unauthenticated) registration is always gated behind approval.
    let initialStatus;
    if (canAssignRole) {
      initialStatus =
        contact.status ||
        (isInternal || finalRole === "participant" ? "pending" : "approved");
    } else if (!session) {
      initialStatus = "pending";
    } else {
      initialStatus = SAFE_STATUSES.includes(contact.status)
        ? contact.status
        : isInternal || finalRole === "participant"
          ? "pending"
          : "approved";
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
      // Program enrollment is NOT a self-service field: an anonymous public
      // submission must not be able to drop its new contact into any program.
      // Only an authenticated caller may name a program here.
      program_id: session ? contact.program_id || null : null,
      program_name: session ? contact.program_name || null : null,
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

  return { inserted, errors };
}
