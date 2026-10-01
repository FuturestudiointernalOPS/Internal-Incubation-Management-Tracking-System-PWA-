/**
 * Programs — program teams (SERVICE layer).
 *
 * The domain work behind `/api/pm/teams`: the roster read with the
 * credential-stripping rule, the team creation with its member linking and
 * credential e-mails, and the PATCH action dispatch. The CONTROLLER keeps
 * authentication, the capability/scope gates and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import { sendStandaloneEmail } from "@/lib/email";
import {
  generateTeamPassword,
  generateTeamUsername,
  stripTeamCredentials,
} from "@/lib/teamCredentials";
import {
  createTeam,
  getNewTeamContactMembers,
  getNewTeamParticipantMembers,
  getTeamById,
  getTeamContactMembers,
  getTeams,
  getTeamParticipantMembers,
  linkContactsToNewTeam,
  linkContactsToTeam,
  linkParticipantsToNewTeam,
  linkParticipantsToTeam,
  removeContactFromTeam,
  removeParticipantFromTeam,
  setTeamVentureReady,
  updateTeamHandler,
} from "@/models/teams";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Split a mixed member-id list into v2_participants (UUID) and contacts (cid). */
function classifyMemberIds(memberIds) {
  const list = Array.isArray(memberIds) ? memberIds : [];
  return {
    uuidIds: list.filter((id) => id && UUID_RE.test(id.toString())),
    contactIds: list.filter((id) => id && !UUID_RE.test(id.toString())),
  };
}

/**
 * A program's team roster. Shared team credentials are management data: a
 * delegated reader gets the roster without username/password.
 */
export async function listProgramTeams({ programId, canSeeCredentials }) {
  const result = await getTeams(programId);
  return canSeeCredentials
    ? result.rows
    : (result.rows || []).map(stripTeamCredentials);
}

/** The credential e-mail a newly-created unit sends to its members. */
async function sendTeamCredentialEmails(members, name, username, password) {
  for (const member of members) {
    try {
      await sendStandaloneEmail({
        to: member.email,
        subject: `Unit Credentials Secured: ${name}`,
        body: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #FF6600;">Unit Deployment: ${name}</h2>
                  <p>Hello ${member.name},</p>
                  <p>You have been assigned to <strong>${name}</strong>. Here are the shared access credentials for your unit:</p>
                  <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Unit Username:</strong> ${username}</p>
                    <p style="margin: 5px 0;"><strong>Unit Password:</strong> ${password}</p>
                  </div>
                  <p>Use these credentials to access the program dashboard. All members of your unit will share these credentials.</p>
                  <a href="${(await import("@/lib/appUrl")).resolveAppUrl()}/login" style="display: inline-block; background: #FF6600; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Login to Command Center</a>
                </div>
              `,
        isHtml: true,
        email_type: "team_credentials",
      });
    } catch (error) {
      console.error(`Email delivery failed for ${member.email}:`, error);
    }
  }
}

/** The assignment-confirmation e-mail a team update sends to added members. */
async function sendTeamAssignmentEmails(members, team) {
  for (const member of members) {
    try {
      await sendStandaloneEmail({
        to: member.email,
        subject: `Unit Assignment Confirmed: ${team.name}`,
        body: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #FF6600;">Unit Assignment: ${team.name}</h2>
              <p>Hello ${member.name},</p>
              <p>You have been assigned to <strong>${team.name}</strong>. Here are your shared access credentials:</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 5px 0;"><strong>Unit Username:</strong> ${team.team_username}</p>
                <p style="margin: 5px 0;"><strong>Unit Password:</strong> ${team.password}</p>
              </div>
              <p>Use these credentials to access the program dashboard.</p>
              <a href="${(await import("@/lib/appUrl")).resolveAppUrl()}/login" style="display: inline-block; background: #FF6600; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Login to Command Center</a>
            </div>
          `,
        isHtml: true,
        email_type: "team_credentials",
      });
    } catch {}
  }
}

/**
 * Create a team, link its members and e-mail them the shared credentials.
 *
 * A failed member-linking step must not lose the team: the team is returned with
 * a `linkingWarning` instead.
 *
 * @returns {Promise<{team: Object, linkingWarning: string|null}>}
 */
export async function createTeamWithMembers({ payload }) {
  const {
    program_id,
    name,
    handler_id,
    handler_name,
    member_ids,
    group_name,
    leader_id,
    is_management_group,
  } = payload;

  // Generate Team Username and Password from a cryptographic source (SECRET-3).
  const generatedUsername = generateTeamUsername(name);
  const generatedPassword = generateTeamPassword();
  const teamId = crypto.randomUUID();

  // 1. Create Team Record (name = sub-team, group_name = parent group, approved by default).
  const result = await createTeam({
    id: teamId,
    program_id,
    name,
    handler_id,
    handler_name,
    password: generatedPassword,
    team_username: generatedUsername,
    group_name,
    leader_id,
  });

  const team = result.rows[0];

  // 2. Link members to the team.
  let linkingWarning = null;
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    try {
      const { uuidIds, contactIds } = classifyMemberIds(member_ids);

      if (uuidIds.length > 0) {
        await linkParticipantsToNewTeam(team.id, uuidIds);
      }
      if (contactIds.length > 0) {
        await linkContactsToNewTeam(team.id, contactIds);
      }

      // 3. Send e-mails.
      const allMembers = [];
      if (uuidIds.length > 0) {
        const participantMembersResult = await getNewTeamParticipantMembers(uuidIds);
        allMembers.push(...participantMembersResult.rows);
      }
      if (contactIds.length > 0) {
        const contactMembersResult = await getNewTeamContactMembers(contactIds);
        allMembers.push(...contactMembersResult.rows);
      }

      // Management groups (facilitator cohort groups) do NOT send shared team
      // credentials — there is no shared team login for these groups.
      if (!is_management_group) {
        await sendTeamCredentialEmails(allMembers, name, generatedUsername, generatedPassword);
      }
    } catch (linkErr) {
      console.error("Team member linking failed:", linkErr.message);
      linkingWarning = `Team created but member linking failed: ${linkErr.message}`;
    }
  }

  return { team, linkingWarning };
}

/**
 * Apply a team PATCH: the update_handler / remove_member / set_venture_ready
 * shortcuts, or the member-link + e-mail flow.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function applyTeamPatch({ payload }) {
  const {
    team_id,
    member_ids,
    member_id,
    action,
    handler_id,
    handler_name,
    is_venture_ready,
    is_management_group,
  } = payload;

  // Support update_handler action (reassign the team's facilitator/oversight).
  if (action === "update_handler" && team_id) {
    await updateTeamHandler(team_id, handler_id, handler_name);
    return { status: 200, body: { success: true } };
  }

  // Support remove_member action (unassign a participant from a team).
  if (action === "remove_member" && team_id && member_id) {
    if (UUID_RE.test(String(member_id))) {
      await removeParticipantFromTeam(member_id, team_id);
    } else {
      await removeContactFromTeam(member_id, team_id);
    }
    return { status: 200, body: { success: true } };
  }

  // Support set_venture_ready action (used by venture approval workflow).
  if (action === "set_venture_ready" && team_id) {
    await setTeamVentureReady(team_id, is_venture_ready);
    return { status: 200, body: { success: true } };
  }

  if (!team_id || !member_ids || !Array.isArray(member_ids)) {
    return { status: 400, body: { success: false, error: "Missing parameters." } };
  }

  // Fetch team details for e-mail notification.
  const teamRes = await getTeamById(team_id);
  const team = teamRes.rows[0];
  if (!team) {
    return { status: 404, body: { success: false, error: "Team not found." } };
  }

  // Link members to the team — classify by UUID vs contact CID.
  const { uuidIds, contactIds } = classifyMemberIds(member_ids);

  if (uuidIds.length > 0) {
    await linkParticipantsToTeam(team.id, uuidIds);
  }
  if (contactIds.length > 0) {
    await linkContactsToTeam(team.id, contactIds);
  }

  const allMembers = [];
  if (uuidIds.length > 0) {
    const participantMembersResult = await getTeamParticipantMembers(uuidIds);
    allMembers.push(...participantMembersResult.rows);
  }
  if (contactIds.length > 0) {
    const contactMembersResult = await getTeamContactMembers(contactIds);
    allMembers.push(...contactMembersResult.rows);
  }

  if (!is_management_group) {
    await sendTeamAssignmentEmails(allMembers, team);
  }

  return { status: 200, body: { success: true } };
}
