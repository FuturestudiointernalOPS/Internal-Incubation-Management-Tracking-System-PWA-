import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  describeVentureMemberInvitation,
  completeVentureMemberInvitation,
} from "@/models/ventureMemberInvitations";

/**
 * The venture member invitation link — PUBLIC on purpose.
 *
 * The person was invited by email and may have no account yet, so the link
 * itself is the credential (a single-use, expiring token). It exposes only the
 * Venture name, the intended role and the invited address — never a record.
 *
 *   GET  — validate the link and describe what is being accepted
 *   POST — accept it: create/find the person, optionally set a password so an
 *          outside guest can sign in, and record the membership
 */

const ERROR_MESSAGES = {
  invalid: "This invitation link is not valid.",
  expired: "This invitation link has expired. Ask the Venture to send a new one.",
  revoked: "This invitation was withdrawn.",
  already: "This invitation has already been accepted.",
  weak_password: "Password must be at least 6 characters.",
  identity_conflict:
    "This email matches more than one person on record. Please contact Future Studio.",
  identity_unresolved: "We could not record your contact details. Please try again.",
};

export async function GET(req, { params }) {
  try {
    await initDb();
    const { token } = await params;

    const result = await describeVentureMemberInvitation(token);
    if (result.error) {
      return NextResponse.json(
        { success: false, code: result.error, error: ERROR_MESSAGES[result.error] || ERROR_MESSAGES.invalid },
        { status: result.error === "invalid" ? 404 : 410 },
      );
    }

    return NextResponse.json({ success: true, invite: result.invitation });
  } catch (e) {
    console.error("GET /api/venture-member-invites/[token] error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to validate the invitation." },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { token } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await completeVentureMemberInvitation({
      token,
      name: typeof body.name === "string" ? body.name : null,
      password: typeof body.password === "string" && body.password ? body.password : null,
    });

    if (!result.ok) {
      const status = result.error === "invalid" ? 404 : result.error === "weak_password" ? 400 : 410;
      return NextResponse.json(
        { success: false, code: result.error, error: ERROR_MESSAGES[result.error] || ERROR_MESSAGES.invalid },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      already_member: !!result.already_member,
      member_type: result.member_type || null,
    });
  } catch (e) {
    console.error("POST /api/venture-member-invites/[token] error:", e);
    return NextResponse.json(
      { success: false, error: "We could not accept the invitation. Please try again." },
      { status: 500 },
    );
  }
}
