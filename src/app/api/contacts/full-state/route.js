import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { reconcileProgramGroups } from "@/lib/contact-group-sync";
import { attachInvitationStatus } from "@/lib/invitations";

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
    const pmId = searchParams.get("pm_id");
    const statusFilter = searchParams.get("status");

    console.log(
      "--- FETCHING PERSONNEL STATE ---",
      pmId ? `(Scoped for PM: ${pmId})` : "(Global)",
      statusFilter ? `(Status: ${statusFilter})` : "",
    );

    let contactsRes;
    let familiesList;
    let teamsRows;

    if (pmId) {
      // 1. Identify assigned programs and segments
      const progRes = await db.execute({
        sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ?",
        args: [pmId],
      });
      const myProgs = progRes.rows;
      const myProgIds = myProgs.map((p) => p.id);
      const myProgNames = myProgs.map((p) => p.name.toUpperCase());

      // 2. Fetch scoped contacts (include v2_participants for full registry)
      if (myProgIds.length > 0 || myProgNames.length > 0) {
        const idPlaceholders = myProgIds.map(() => "?").join(",") || "NULL";
        const namePlaceholders = myProgNames.map(() => "?").join(",") || "NULL";

        const archiveClause = statusFilter === "archived"
          ? "AND archived_at IS NOT NULL"
          : "AND archived_at IS NULL";

        contactsRes = await db.execute({
          sql: `SELECT * FROM contacts
                WHERE (cid IN (
                        SELECT participant_id FROM participant_programs
                        WHERE CAST(program_id AS TEXT) IN (${idPlaceholders})
                      )
                OR UPPER(TRIM(group_name)) IN (${namePlaceholders}))
                AND deleted_at IS NULL
                ${archiveClause}
                ORDER BY created_at DESC`,
          args: [...myProgIds, ...myProgNames],
        });

        // Also fetch participants via participant_programs (authoritative
        // membership) — skip when viewing archived.
        if (statusFilter !== "archived") {
          const ppRes = await db.execute({
            sql: `SELECT c.*
                  FROM participant_programs pp
                  JOIN contacts c ON pp.participant_id = c.cid
                  WHERE CAST(pp.program_id AS TEXT) IN (${idPlaceholders})
                    AND c.deleted = 0
                    AND c.deleted_at IS NULL`,
            args: [...myProgIds],
          });
          const ppRows = ppRes.rows || [];
          if (ppRows.length > 0) {
            const existingEmails = new Set(
              (contactsRes.rows || [])
                .map((c) => c.email?.toLowerCase())
                .filter(Boolean),
            );
            for (const c of ppRows) {
              if (!existingEmails.has(c.email?.toLowerCase())) {
                contactsRes.rows.push({ ...c, source: "participant_programs" });
              }
            }
          }
        }

        // 3. Fetch scoped families/segments
        const famRes = await db.execute({
          sql: `SELECT * FROM families
                WHERE program_id IN (${idPlaceholders})
                OR UPPER(TRIM(name)) IN (${namePlaceholders})`,
          args: [...myProgIds, ...myProgNames],
        });
        familiesList = famRes.rows;

        // 4. Fetch scoped teams
        const teamRes = await db.execute({
          sql: `SELECT id, name, group_name, program_id FROM v2_teams
                WHERE program_id IN (${idPlaceholders})`,
          args: [...myProgIds],
        });
        teamsRows = teamRes.rows;
      } else {
        contactsRes = { rows: [] };
        familiesList = [];
        teamsRows = [];
      }
    } else {
      // Global View (Super Admin)
      const archiveClause = statusFilter === "archived"
        ? "AND archived_at IS NOT NULL"
        : "AND archived_at IS NULL";
      contactsRes = await db.execute(
        `SELECT * FROM contacts WHERE deleted_at IS NULL ${archiveClause} ORDER BY created_at DESC`,
      );
      const famRes = await db.execute(
        "SELECT * FROM families ORDER BY name ASC",
      );
      familiesList = famRes.rows;
      const teamRes = await db.execute(
        "SELECT id, name, group_name FROM v2_teams",
      );
      teamsRows = teamRes.rows;
    }

    // NORMALIZATION: Ensure FUTURE STUDIO is in the filter list (Uppercase Protocol)
    if (!familiesList.find((f) => f.name.toUpperCase() === "FUTURE STUDIO")) {
      familiesList.unshift({
        name: "FUTURE STUDIO",
        registration_id: "R-FS-001",
      });
    }

    // Data Sanitization: Normalize all contact group names to uppercase
    const normalizedContacts = (contactsRes.rows || []).map((c) => ({
      ...c,
      group_name: c.group_name ? c.group_name.toUpperCase() : "UNASSIGNED",
    }));

    // Derive invitation/account status (Not Invited / Sent / Activated / Expired)
    // and strip the password hash so it is never sent to the browser.
    const contactsWithInvitation = (await attachInvitationStatus(normalizedContacts)).map(
      ({ password, ...safeContact }) => safeContact,
    );

    // Attach activation EMAIL status from platform_email_log — the same
    // source of truth the Runs page uses — so Contacts and Runs agree on
    // whether an activation email has actually been sent. Never derived
    // from approval status or account status.
    const cids = [...new Set(contactsWithInvitation.map((c) => c.cid).filter(Boolean))];
    const activationByCid = {};
    if (cids.length > 0) {
      try {
        const placeholders = cids.map(() => "?").join(",");
        const elRes = await db.execute({
          sql: `SELECT el.contact_cid, el.status, el.sent_at, el.created_at, el.error
                FROM platform_email_log el
                WHERE el.email_type = 'activation' AND el.contact_cid IN (${placeholders})
                ORDER BY el.id ASC`,
          args: cids,
        });
        for (const row of elRes.rows) {
          const cur = activationByCid[row.contact_cid] || { latest: null, lastSentAt: null };
          cur.latest = row;
          if (row.status === "sent") cur.lastSentAt = row.sent_at || row.created_at;
          activationByCid[row.contact_cid] = cur;
        }
      } catch (_) {}
    }
    const contacts = contactsWithInvitation.map((c) => {
      const act = activationByCid[c.cid] || null;
      return {
        ...c,
        activation_email_status: act?.latest?.status || null,
        activation_email_sent_at: act?.lastSentAt || null,
        activation_email_error: act?.latest?.error || null,
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
