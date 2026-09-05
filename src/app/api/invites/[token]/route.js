import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  resolveInviteToken,
  backfillInviteTokenHashOnValidate,
  getPasswordSetupToken,
  backfillInviteTokenHashOnAccept,
  getContactProfileByCid,
  findContactByEmail,
  activateContactWithPassword,
  createContactFromInvite,
  markInviteTokenUsed,
  addActiveProgramEnrollment,
} from "@/models/groups";

export const dynamic = "force-dynamic";

// GET /api/invites/[token] — validate invite token
export async function GET(req, { params }) {
  try {
    await ensureTokenHashColumns();
    const { token } = await params;
    const tokenHash = hashToken(token);
    const result = await resolveInviteToken(tokenHash, token);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });
    }

    const row = result.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!row.token_hash) {
      await backfillInviteTokenHashOnValidate(tokenHash, row.id).catch(() => {});
    }

    const now = new Date();
    const expires = new Date(row.expires_at);
    if (expires < now) {
      return NextResponse.json({ error: "Invite link has expired." }, { status: 410 });
    }

    return NextResponse.json({
      invite: {
        token: row.token,
        contact_cid: row.contact_cid,
        expires_at: row.expires_at,
      },
    });
  } catch (e) {
    console.error("Invite GET error:", e);
    return NextResponse.json({ error: "Failed to validate invite." }, { status: 500 });
  }
}

// POST /api/invites/[token] — accept invite & create contact account
export async function POST(req, { params }) {
  try {
    await ensureTokenHashColumns();
    const { token } = await params;
    const { name, email, password, phone } = await req.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Validate token
    const tokenHash = hashToken(token);
    const tokenResult = await getPasswordSetupToken(tokenHash, token);

    if (tokenResult.rows.length === 0 || tokenResult.rows[0].used) {
      return NextResponse.json({ error: "Invalid or already used invite link." }, { status: 400 });
    }

    const row = tokenResult.rows[0];
    const contactCid = row.contact_cid;

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!row.token_hash) {
      await backfillInviteTokenHashOnAccept(tokenHash, row.id).catch(() => {});
    }

    // Look up contact details from contacts table
    const contactRes = await getContactProfileByCid(contactCid);
    const contact = contactRes.rows[0] || {};
    const contactEmail = (email || contact.email || "").trim().toLowerCase();
    const contactName = (name || contact.name || "").trim();
    const contactRole = contact.role || "participant";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if contact already exists
    const existCheck = await findContactByEmail(contactEmail);

    if (existCheck.rows.length > 0) {
      // Update existing contact with password + program_id
      await activateContactWithPassword(hashedPassword, contactName, contactEmail);
    } else {
      // Create new contact
      await createContactFromInvite(
        contactCid,
        contactName,
        contactEmail,
        phone,
        hashedPassword,
        contactRole,
      );
    }

    // Mark token as used
    await markInviteTokenUsed(row.id);

    // Add participant to the program via participant_programs (authoritative
    // membership). The legacy v2_participants write was removed (Phase 3).
    if (contact.program_id) {
      try {
        // Same-program conflict guard (Phase 2A): a facilitator in this program
        // cannot also be activated as a participant in the same program.
        const conflictError = await assertNoParticipantFacilitatorConflict(
          contact.program_id,
          contactCid,
          contactEmail,
        );
        if (conflictError) return conflictError;
        await addActiveProgramEnrollment(contactCid, contact.program_id);
      } catch (e) {
        console.warn("Failed to add participant to program:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Registration complete. You can now login.",
      user: { cid: contactCid, name: contactName, email: contactEmail, role: contactRole },
    });
  } catch (e) {
    console.error("Invite POST error:", e);
    return NextResponse.json({ error: "Registration failed. " + (e.message || "") }, { status: 500 });
  }
}
