import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, isAssignedPmForProgram } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail, sendLoginEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  buildFullFacilitatorPermissions,
  parsePermissions,
} from "@/lib/facilitator-permissions";
import {
  addFacilitatorAssignedTimelineEvent,
  addFacilitatorContactRole,
  addFacilitatorInvitedTimelineEvent,
  createFacilitatorContact,
  createFacilitatorInviteToken,
  fillContactProgramLink,
  findContactByEmailForInvite,
  findParticipantConflictForFacilitatorInvite,
  getProgramForFacilitatorInvite,
  invalidatePasswordSetupTokens,
  isAlreadyFacilitatorInProgram,
  upsertFacilitatorProgramStaff,
} from "@/models/facilitation";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function analyzeEmail(email, programId) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !EMAIL_RE.test(clean)) {
    return { email: clean, status: "invalid" };
  }

  const existing = await findContactByEmailForInvite(clean);
  const row = existing.rows[0];
  const accountActivated = !!(row && String(row.password || "").trim());
  const contactCid = row?.cid || "";

  if (contactCid) {
    const dup = await isAlreadyFacilitatorInProgram(programId, contactCid);
    if (dup.rows.length > 0) {
      return {
        email: clean,
        status: "already_facilitator",
        contactCid,
        name: row.name || "",
      };
    }
  }

  const conflict = await findParticipantConflictForFacilitatorInvite(
    contactCid,
    programId,
    clean,
  );
  if (conflict.rows.length > 0) {
    return {
      email: clean,
      status: "conflict",
      contactCid,
      name: row?.name || "",
    };
  }

  return {
    email: clean,
    status: contactCid ? "existing_contact" : "new_contact",
    contactCid,
    name: row?.name || "",
    accountActivated,
  };
}

export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { program_id, program_name, emails, preview } = body;

    // Staff may only bulk-invite facilitators for programs they are the
    // assigned PM of (PM is a function layered on Staff).
    if (session?.role === "staff") {
      const isPm = await isAssignedPmForProgram(program_id, session.cid);
      if (!isPm) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    if (!program_id || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: "program_id and emails are required" },
        { status: 400 },
      );
    }

    const programId = String(program_id);
    const progRes = await getProgramForFacilitatorInvite(programId);
    const program = progRes.rows[0];
    const progName = program_name || program?.name || programId;

    let defaultPerms = parsePermissions(program?.facilitator_default_permissions);
    if (Object.keys(defaultPerms).length === 0) {
      defaultPerms = buildFullFacilitatorPermissions();
    }

    const seen = new Set();
    const results = [];

    for (const raw of emails) {
      const analysis = await analyzeEmail(raw, programId);
      if (seen.has(analysis.email)) continue;
      seen.add(analysis.email);

      // Preview mode only reports what would happen.
      if (preview) {
        results.push(analysis);
        continue;
      }

      if (analysis.status !== "existing_contact" && analysis.status !== "new_contact") {
        results.push(analysis);
        continue;
      }

      let contactCid = analysis.contactCid;
      if (!contactCid) {
        contactCid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
        await createFacilitatorContact(contactCid, analysis.email);
      }

      // Facilitator relationship inherits the program default permissions.
      await upsertFacilitatorProgramStaff(programId, contactCid, defaultPerms);

      // Link the contact to this program (fill-only) and record the contextual
      // facilitator role without overwriting the person's global role.
      await fillContactProgramLink(programId, contactCid);
      try {
        await addFacilitatorContactRole(
          contactCid,
          programId,
          defaultPerms,
          session?.cid || "system",
        );
      } catch (_) {}

      // Reuse the existing activation token flow; never duplicate a contact.
      await invalidatePasswordSetupTokens(contactCid);
      const token = uuidv4();
      const tokenHash = hashToken(token);
      await createFacilitatorInviteToken(token, tokenHash, contactCid);

      if (analysis.accountActivated) {
        await sendLoginEmail({
          to: analysis.email,
          name: analysis.name || "",
          role: "facilitator",
          programName: progName,
        });
      } else {
        await sendInviteEmail({
          to: analysis.email,
          name: analysis.name || "",
          role: "facilitator",
          token,
          programName: progName,
        });
      }

      // CRM history: assignment + invitation.
      const actorId = session?.cid || "system";
      try {
        await addFacilitatorAssignedTimelineEvent(
          contactCid,
          progName,
          programId,
          actorId,
        );
      } catch (_) {}
      try {
        await addFacilitatorInvitedTimelineEvent(
          contactCid,
          progName,
          programId,
          actorId,
        );
      } catch (_) {}

      results.push({
        email: analysis.email,
        status: analysis.accountActivated ? "invited" : "activation_sent",
        cid: contactCid,
        name: analysis.name || "",
      });
    }

    return NextResponse.json({ success: true, results, count: results.length });
  } catch (error) {
    console.error("[Bulk facilitator invite] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
