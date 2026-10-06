/**
 * LMS service — the public registration surfaces.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the group lookup
 * with its families→v2_groups fallback, the "an existing email is not proof of
 * ownership" rule, the same-program facilitator/participant conflict guard, the
 * canonical membership sync, and the registration-window lookup that the public
 * registration page needs. Every statement lives in `@/models/platformConfig`.
 * No SQL, no HTTP: a refusal is a value ({ ok: false, status, error }) the HTTP
 * boundary turns into a response.
 */

import { v4 as uuidv4 } from "uuid";
import { hashPassword } from "@/server/auth/password";
import { assertNoParticipantFacilitatorConflict } from "@/server/authz/guards";
import {
  findContactCidByEmail,
  findFamilyForGroupInfo,
  findRegistrationGroupInFamilies,
  findRegistrationGroupInV2Groups,
  findV2GroupForGroupInfo,
  getProgramRegistrationWindow,
  insertContactForRegistration,
  insertParticipantForRegistration,
  insertParticipantProgramMembership,
} from "@/models/platformConfig";

/**
 * Register a participant through a public group link.
 *
 * Field presence and the password length are the controller's validation; this
 * decides the rest: resolve the group (families first, then v2_groups), accept
 * the submission whether or not the email already exists, but NEVER rewrite an
 * existing account's credentials from an anonymous form, enforce the
 * same-program facilitator conflict, and keep the canonical membership table in
 * sync.
 */
export async function registerParticipantViaGroupLink({ name, email, password, phone, groupId }) {
  // Find the group in families or v2_groups.
  let groupResult = await findRegistrationGroupInFamilies(groupId);
  if (groupResult.rows.length === 0) {
    groupResult = await findRegistrationGroupInV2Groups(groupId);
  }
  if (groupResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Group not found." };
  }

  const group = groupResult.rows[0];
  const normalizedEmail = email.trim().toLowerCase();
  const existingContact = await findContactCidByEmail(normalizedEmail);
  const cid = "USR-" + uuidv4().split("-")[0].toUpperCase();

  // An existing email is NOT proof of ownership: never rewrite an account's
  // password, name or group from an anonymous form. The submission is still
  // accepted (and reviewed); the existing account keeps its own credentials.
  if (existingContact.rows.length === 0) {
    const hashedPassword = await hashPassword(password, { rounds: 12 });
    await insertContactForRegistration(cid, name, normalizedEmail, phone, hashedPassword, group.name);
  }

  if (group.program_id) {
    try {
      const contactCid = existingContact.rows.length > 0 ? existingContact.rows[0].cid : cid;
      // Same-program conflict guard (Phase 2A): a facilitator in this program
      // cannot register as a participant in the same program.
      const conflictError = await assertNoParticipantFacilitatorConflict(
        group.program_id,
        contactCid,
        normalizedEmail,
      );
      if (conflictError) {
        return { ok: false, status: 409, reason: "role_conflict" };
      }
      await insertParticipantForRegistration(group.program_id, contactCid, name, normalizedEmail, phone);
      // Keep the canonical membership table (participant_programs) in sync so
      // group-link registrations show up in the Program Participants view once
      // the contact's account becomes active.
      await insertParticipantProgramMembership(contactCid, group.program_id);
    } catch (error) {
      console.warn("Failed to add participant:", error.message);
    }
  }

  return {
    ok: true,
    user: {
      cid: existingContact.rows.length > 0 ? existingContact.rows[0].cid : cid,
      name,
      email: normalizedEmail,
      role: "participant",
    },
  };
}

/**
 * The public group info the registration page needs: the group (families first,
 * then v2_groups) and its program's registration window. A group that is in
 * neither table is a 404.
 */
export async function buildPublicGroupInfo({ groupId }) {
  let group = null;

  const result = await findFamilyForGroupInfo(groupId);
  if (result.rows.length > 0) group = result.rows[0];

  if (!group) {
    const v2GroupResult = await findV2GroupForGroupInfo(groupId);
    if (v2GroupResult.rows.length > 0) group = v2GroupResult.rows[0];
  }

  if (!group) {
    return { ok: false, status: 404, error: "Group not found" };
  }

  let registration_window = null;
  if (group.program_id) {
    const programResult = await getProgramRegistrationWindow(group.program_id);
    if (programResult.rows.length > 0) {
      registration_window = programResult.rows[0].registration_window;
    }
  }

  return { ok: true, group: { ...group, registration_window } };
}
