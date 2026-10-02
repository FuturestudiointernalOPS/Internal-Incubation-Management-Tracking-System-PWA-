import { v4 as uuidv4 } from "uuid";
import { hashPassword } from "@/server/auth/password";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  upsertContact,
  createAccessRequestNotification,
  assignContactToProgram,
  createParticipantProgramAudit,
  findContactCidByPhone,
  createDuplicatePhoneFlag,
} from "@/models/contacts";
import { fireInvite } from "./fireInvite";

/**
 * Self-service roles: the only roles a caller WITHOUT the role-assignment
 * capability may request. Login derives the session role from contacts.role,
 * so anything beyond this list is a privilege boundary.
 */
const SELF_SERVICE_ROLES = new Set(["participant", "member", "applicant", "unassigned"]);

/** Statuses a self-service submission may legitimately produce. */
const SAFE_STATUSES = ["pending", "approved", "active"];

/**
 * Normalize one inbound contact payload into a persistable row.
 * @returns {{ ok: true, data: object } | { ok: false, error: string, name: string }}
 */
export function normalizeNewContact({ contact, session, canAssignRole }) {
  const rawName = contact.name || contact.fullName || "Unknown Applicant";
  const rawEmail = (contact.email || "").toLowerCase().trim();

  if (!rawEmail) {
    return { ok: false, name: rawName, error: "Email is required" };
  }

  const cid =
    "USER_" +
    uuidv4().split("-")[0].toUpperCase() +
    Math.floor(Math.random() * 10000);

  const groupName = (contact.group_name || "unassigned").toUpperCase();
  const isInternal = groupName === "FUTURE STUDIO";

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

  return {
    ok: true,
    data: {
      cid,
      name: rawName.trim(),
      email: rawEmail,
      phone: contact.phone || null,
      address: contact.address || contact.homeAddress || null,
      dob: contact.dob || null,
      group_name: groupName,
      role: finalRole,
      // password filled by createContacts after async hash
      program_id: session ? contact.program_id || null : null,
      program_name: session ? contact.program_name || null : null,
      image: contact.image || null,
      status: initialStatus,
      deleted: 0,
      gender: contact.gender || null,
      mother_name: contact.mother_name || null,
    },
  };
}

/**
 * Create one or more contacts. Auth gates stay in the controller; this owns
 * role/status normalization, upsert, invite, program assign, phone-dup flags.
 *
 * @returns {{ status: number, body: object }}
 */
export async function createContacts({ contacts: rawContacts, session, canAssignRole }) {
  console.log("--- CONTACT REGISTRATION START ---", {
    count: rawContacts.length,
  });

  const validContacts = [];
  const errors = [];

  for (const contact of rawContacts) {
    const normalized = normalizeNewContact({ contact, session, canAssignRole });
    if (!normalized.ok) {
      errors.push({ name: normalized.name, error: normalized.error });
      continue;
    }
    // Admins never create user passwords. Store an unusable random hash so
    // the account can only gain a real password through the invitation /
    // activation flow (user sets their own password).
    const hashedPassword = await hashPassword(uuidv4());
    validContacts.push({ ...normalized.data, password: hashedPassword });
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

      if (validContact.email) {
        await fireInvite(
          validContact.cid,
          validContact.name,
          validContact.email,
          validContact.role,
          validContact.program_id,
        );
      }

      const programIdsToAssign =
        validContact.program_ids && Array.isArray(validContact.program_ids)
          ? validContact.program_ids
          : validContact.program_id
            ? [validContact.program_id]
            : [];

      for (const programId of programIdsToAssign) {
        try {
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
    return {
      status: 400,
      body: { success: false, error: `Database Error: ${errors[0].error}` },
    };
  }

  if (inserted > 0) {
    Promise.resolve()
      .then(async () => {
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
      })
      .catch(() => {});
  }

  return { status: 200, body: { success: true, inserted, errors } };
}
