import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { reconcileProgramGroups } from "@/lib/contact-group-sync";
import { attachInvitationStatus } from "@/lib/invitations";
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
 * CONTACTS FULL-STATE API — CENTRAL REGISTRY FEED
 * Aggregates contacts, groups, and families for the Personnel Dashboard.
 */

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    // Self-heal existing records: fill missing group/program links idempotently
    // so previously-approved participants/facilitators stop showing as UNASSIGNED.
    await reconcileProgramGroups();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    // Scope: the PM parameter comes from the request, and the branch WITHOUT it
    // reads the whole registry. A non-management holder of contacts.view may
    // only read their OWN scope; the global feed is for staff / Super Admin.
    const session = await getSession();
    let pmId = searchParams.get("pm_id");
    if (!["super_admin", "staff", "program_manager"].includes(session?.role)) {
      if (pmId && String(pmId) !== String(session?.cid)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      pmId = session?.cid || null;
    }

    console.log(
      "--- FETCHING PERSONNEL STATE ---",
      pmId ? `(Scoped for PM: ${pmId})` : "(Global)",
      statusFilter ? `(Status: ${statusFilter})` : "",
    );

    let contactsResult;
    let familiesList;
    let teamsRows;

    if (pmId) {
      // 1. Identify assigned programs and segments
      const programsResult = await getPmAssignedPrograms(pmId);
      const myPrograms = programsResult.rows;
      const myProgramIds = myPrograms.map((program) => program.id);
      const myProgramNames = myPrograms.map((program) => program.name.toUpperCase());

      // 2. Scoped contacts, participants, families and teams all depend only on
      //    the programs just read, so they go out together.
      if (myProgramIds.length > 0 || myProgramNames.length > 0) {
        const wantsParticipants = statusFilter !== "archived";
        const [scopedContacts, participantsResult, familiesResult, teamsResult] =
          await Promise.all([
            getContactsScopedByProgramsAndGroups(
              myProgramIds,
              myProgramNames,
              statusFilter,
            ),
            // Participants via participant_programs (authoritative membership)
            // — skipped when viewing archived.
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
      // Global View (Super Admin) — three independent reads, one wave.
      const [registryContacts, familiesResult, teamsResult] = await Promise.all([
        getRegistryContacts(statusFilter),
        getFamiliesList(),
        getRegistryTeams(),
      ]);
      contactsResult = registryContacts;
      familiesList = familiesResult.rows;
      teamsRows = teamsResult.rows;
    }

    // NORMALIZATION: Ensure FUTURE STUDIO is in the filter list (Uppercase Protocol)
    if (!familiesList.find((family) => family.name.toUpperCase() === "FUTURE STUDIO")) {
      // Synthetic row: no `families` record stands behind it, so it has no
      // database id. It is listed by id on screen, and a row without one is
      // what React warns about, so it carries a stable id of its own (family
      // ids are generated numbers, so a string label cannot collide with one).
      familiesList.unshift({
        id: "FUTURE-STUDIO",
        name: "FUTURE STUDIO",
        registration_id: "R-FS-001",
      });
    }

    // Data Sanitization: Normalize all contact group names to uppercase
    const normalizedContacts = (contactsResult.rows || []).map((contact) => ({
      ...contact,
      group_name: contact.group_name
        ? contact.group_name.toUpperCase()
        : "UNASSIGNED",
    }));

    // Invitation/token status and activation EMAIL status are independent — both
    // keyed on the same contact ids — so they go out in one wave instead of one
    // after the other. attachInvitationStatus maps 1:1 (it never drops a row), so
    // the ids are the same before and after it; the email-log read stays
    // best-effort.
    const contactCids = [
      ...new Set(normalizedContacts.map((contact) => contact.cid).filter(Boolean)),
    ];

    const [invitationStatuses, emailLogResult] = await Promise.all([
      attachInvitationStatus(normalizedContacts),
      contactCids.length > 0
        ? getActivationEmailLogForContacts(contactCids).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ]);

    // Strip the password hash so it is never sent to the browser.
    const contactsWithInvitation = invitationStatuses.map(
      ({ password: _password, ...safeContact }) => safeContact,
    );

    // Attach activation EMAIL status from platform_email_log — the same
    // source of truth the Runs page uses — so Contacts and Runs agree on
    // whether an activation email has actually been sent. Never derived
    // from approval status or account status.
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

    return NextResponse.json({
      success: true,
      contacts,
      families: familiesList,
      teams: teamsRows,
    });
  } catch (error) {
    console.error("Registry State Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
