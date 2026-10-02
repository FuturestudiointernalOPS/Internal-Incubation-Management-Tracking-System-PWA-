import { attachInvitationStatus } from "@/lib/invitations";
import { reconcileProgramGroups } from "@/services/contacts/contactGroupSync";
import {
  getPmAssignedPrograms,
  getContactsScopedByProgramsAndGroups,
  getEnrolledProgramParticipants,
  getFamiliesScopedByProgramsAndGroups,
  getTeamsScopedByPrograms,
  getRegistryContacts,
  getFamiliesList,
  getRegistryTeams,
  getActivationEmailLogForContacts,
} from "@/models/contacts";

/**
 * Aggregate contacts, families, and teams for the Personnel Dashboard.
 * Capability + PM-scope clamp stay in the controller; pass the resolved pmId.
 *
 * @returns {{ status: number, body: object }}
 */
export async function getContactsFullState({ pmId, statusFilter }) {
  await reconcileProgramGroups();

  console.log(
    "--- FETCHING PERSONNEL STATE ---",
    pmId ? `(Scoped for PM: ${pmId})` : "(Global)",
    statusFilter ? `(Status: ${statusFilter})` : "",
  );

  let contactsResult;
  let familiesList;
  let teamsRows;

  if (pmId) {
    const programsResult = await getPmAssignedPrograms(pmId);
    const myPrograms = programsResult.rows;
    const myProgramIds = myPrograms.map((program) => program.id);
    const myProgramNames = myPrograms.map((program) => program.name.toUpperCase());

    if (myProgramIds.length > 0 || myProgramNames.length > 0) {
      const wantsParticipants = statusFilter !== "archived";
      const [scopedContacts, participantsResult, familiesResult, teamsResult] =
        await Promise.all([
          getContactsScopedByProgramsAndGroups(
            myProgramIds,
            myProgramNames,
            statusFilter,
          ),
          wantsParticipants
            ? getEnrolledProgramParticipants(myProgramIds)
            : Promise.resolve({ rows: [] }),
          getFamiliesScopedByProgramsAndGroups(myProgramIds, myProgramNames),
          getTeamsScopedByPrograms(myProgramIds),
        ]);

      contactsResult = scopedContacts;

      const participantRows = (participantsResult && participantsResult.rows) || [];
      if (participantRows.length > 0) {
        const existingEmails = new Set(
          (contactsResult.rows || [])
            .map((contact) => contact.email?.toLowerCase())
            .filter(Boolean),
        );
        for (const participantRow of participantRows) {
          if (!existingEmails.has(participantRow.email?.toLowerCase())) {
            contactsResult.rows.push({
              ...participantRow,
              source: "participant_programs",
            });
          }
        }
      }

      familiesList = familiesResult.rows;
      teamsRows = teamsResult.rows;
    } else {
      contactsResult = { rows: [] };
      familiesList = [];
      teamsRows = [];
    }
  } else {
    const [registryContacts, familiesResult, teamsResult] = await Promise.all([
      getRegistryContacts(statusFilter),
      getFamiliesList(),
      getRegistryTeams(),
    ]);
    contactsResult = registryContacts;
    familiesList = familiesResult.rows;
    teamsRows = teamsResult.rows;
  }

  if (!familiesList.find((family) => family.name.toUpperCase() === "FUTURE STUDIO")) {
    familiesList.unshift({
      id: "FUTURE-STUDIO",
      name: "FUTURE STUDIO",
      registration_id: "R-FS-001",
    });
  }

  const normalizedContacts = (contactsResult.rows || []).map((contact) => ({
    ...contact,
    group_name: contact.group_name
      ? contact.group_name.toUpperCase()
      : "UNASSIGNED",
  }));

  const contactCids = [
    ...new Set(normalizedContacts.map((contact) => contact.cid).filter(Boolean)),
  ];

  const [invitationStatuses, emailLogResult] = await Promise.all([
    attachInvitationStatus(normalizedContacts),
    contactCids.length > 0
      ? getActivationEmailLogForContacts(contactCids).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
  ]);

  const contactsWithInvitation = invitationStatuses.map(
    ({ password: _password, ...safeContact }) => safeContact,
  );

  const activationByCid = {};
  for (const row of emailLogResult.rows) {
    const activationEntry = activationByCid[row.contact_cid] || {
      latest: null,
      lastSentAt: null,
    };
    activationEntry.latest = row;
    if (row.status === "sent")
      activationEntry.lastSentAt = row.sent_at || row.created_at;
    activationByCid[row.contact_cid] = activationEntry;
  }
  const contacts = contactsWithInvitation.map((contact) => {
    const activation = activationByCid[contact.cid] || null;
    return {
      ...contact,
      activation_email_status: activation?.latest?.status || null,
      activation_email_sent_at: activation?.lastSentAt || null,
      activation_email_error: activation?.latest?.error || null,
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      contacts,
      families: familiesList,
      teams: teamsRows,
    },
  };
}
