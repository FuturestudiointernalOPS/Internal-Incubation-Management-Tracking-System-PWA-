/* =====================================================================================
   ⚠️ 🛑 WARNING: DO NOT EDIT OR USE THIS V2 FILE FOR NEW FEATURES! 🛑 ⚠️
   =====================================================================================
   This Version 2 (V2) API route is ACTIVE AND CURRENTLY USED BY V1.
   Do not delete it or break its functionality, as V1 depends on it.

   However, DO NOT add new features here. All new development should happen in V1.
   ===================================================================================== */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  getV2InviteWithProgramNameByHashOrToken,
  backfillV2InviteTokenHashOnValidate,
  getV2InviteByHashOrToken,
  backfillV2InviteTokenHashOnAccept,
  getContactByEmailForV2InviteAccept,
  updateContactByEmailForV2InviteAccept,
  insertContactForV2InviteAccept,
  getV2ParticipantByEmailAndProgram,
  updateV2ParticipantTeamByEmailAndProgram,
  insertV2ParticipantForInviteAccept,
} from "@/models/authFlows";

// GET: Validate the token and return program/group info for the UI
export async function GET(req, { params }) {
  try {
    await ensureTokenHashColumns();
    const { token } = await params; // Destructure carefully
    const tokenHash = hashToken(token);

    const result = await getV2InviteWithProgramNameByHashOrToken(tokenHash, token);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired Future Studio Invite Link." }, { status: 404 });
    }

    const invite = result.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!invite.token_hash) {
      await backfillV2InviteTokenHashOnValidate(tokenHash, token).catch(() => {});
    }
    return NextResponse.json({
      invite: {
        program_id: invite.program_id,
        program_name: invite.program_name,
        group_name: invite.group_name,
        role: invite.role
      }
    });
  } catch (error) {
    console.error("[Token Validation Error]:", error);
    return NextResponse.json({ error: "Failed to validate token" }, { status: 500 });
  }
}

// POST: Accept invite and register user
export async function POST(req, { params }) {
  try {
    await ensureTokenHashColumns();
    const { token } = await params;
    const { name, email, phone, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }

    // 1. Validate Invite
    const tokenHash = hashToken(token);
    const inviteCheck = await getV2InviteByHashOrToken(tokenHash, token);

    if (inviteCheck.rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired Future Studio Invite Link." }, { status: 404 });
    }
    const invite = inviteCheck.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!invite.token_hash) {
      await backfillV2InviteTokenHashOnAccept(tokenHash, token).catch(() => {});
    }

    // 2. Hash Password & Prepare User (Ticket 2 - Auth System)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const cid = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // 3. Upsert User into Contacts
    let contactId;
    const existingUser = await getContactByEmailForV2InviteAccept(email);

    if (existingUser.rows.length > 0) {
      // User exists, update their profile with the new invite credentials and group
      await updateContactByEmailForV2InviteAccept(
        name,
        phone,
        hashedPassword,
        invite.role,
        invite.group_name,
        invite.team_id,
        email,
      );
      contactId = existingUser.rows[0].cid;
    } else {
      // Create new user
      await insertContactForV2InviteAccept(
        cid,
        name,
        email,
        phone,
        hashedPassword,
        invite.role,
        invite.group_name,
        invite.team_id,
      );
      contactId = cid;
    }

    // 4. Map user to v2_participants to prevent duplicate joins
    const participantCheck = await getV2ParticipantByEmailAndProgram(email, invite.program_id);

    if (participantCheck.rows.length > 0) {
      // Update existing participant record if they are re-joining with a team
      await updateV2ParticipantTeamByEmailAndProgram(invite.team_id, email, invite.program_id);
    } else {
      await insertV2ParticipantForInviteAccept(invite.program_id, name, email, phone, invite.team_id);
    }

    return NextResponse.json({
      message: "Successfully joined the team!",
      user: { cid: contactId, name, email, role: invite.role }
    });

  } catch (error) {
    console.error("[Invite Acceptance Error]:", error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
