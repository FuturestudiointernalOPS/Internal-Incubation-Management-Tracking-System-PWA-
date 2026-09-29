import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { initDb } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  upsertContact,
  createPasswordSetupToken,
  markContactInvited,
  findContactCidByPhone,
} from "@/models/contacts";

export const dynamic = "force-dynamic";

/**
 * POST /api/people — ADD A REAL IMPACTOS PERSON, AND INVITE THEM.
 *
 * This is the only way a person enters the platform, and it is deliberately NOT
 * part of the tracker importer: importing a name must never create an account.
 * The two are different things, and they have to stay different things.
 *
 * WHAT IS REQUIRED: Name + Email + Phone. All three, always. A person added with
 * a name alone would be a half-record that looks complete — which is exactly the
 * confusion this endpoint exists to prevent. (A tracker keeps names. This
 * endpoint makes members.)
 *
 * INVITATIONS GO BY EMAIL, AND ONLY BY EMAIL. The phone number is part of the
 * person's profile; it is never an invitation channel. The account is created
 * `pending` with an unusable random password, and the person can only gain access
 * by following the emailed activation link and choosing their own password — so
 * this endpoint can never hand out a working credential.
 *
 * The role is fixed to `member` server-side and is NEVER read from the request.
 * `contacts.role` decides what a session may do, so accepting a role from a
 * caller is a privilege boundary. A collaborator is a member; anything more is
 * granted afterwards through the Access Profile system.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    // Creating a person is governed by the capability that governs people.
    const capError = await requireAuthorization("contacts", "create");
    if (capError) return capError;

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").replace(/\s+/g, " ").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").replace(/\s+/g, " ").trim();

    // All three, or nothing. No partial people.
    const missing = [];
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!phone) missing.push("phone");
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: "errors.personRequiresNameEmailPhone", missing },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "errors.invalidEmail" }, { status: 400 });
    }

    // A phone number that already belongs to someone IS that someone. Creating a
    // second person for the same person is how duplicates start.
    const byPhone = await findContactCidByPhone(phone).catch(() => ({ rows: [] }));
    const existingCid = byPhone.rows?.[0]?.cid || null;
    if (existingCid) {
      return NextResponse.json({ success: true, cid: existingCid, existing: true, invited: false });
    }

    const session = await getSession();
    const cid = "USER_" + uuidv4().split("-")[0].toUpperCase() + Math.floor(Math.random() * 10000);
    // An unusable password: the account only gains a real one through activation.
    const hashedPassword = await hashPassword(uuidv4());

    await upsertContact({
      cid,
      name,
      email,
      phone,
      address: null,
      dob: null,
      group_name: null,
      role: "member", // fixed server-side — never taken from the request
      password: hashedPassword,
      program_id: null,
      program_name: null,
      image: null,
      status: "pending",
      deleted: 0,
      gender: null,
      mother_name: null,
    });

    // The invitation. Mirrors the platform's existing invite flow (see
    // POST /api/contacts): a hashed setup token, the contact marked invited, and
    // the activation email sent synchronously so a serverless worker cannot be
    // killed before it leaves.
    let invited = false;
    try {
      await ensureTokenHashColumns();
      const token = uuidv4();
      await createPasswordSetupToken(token, hashToken(token), cid);
      await markContactInvited(cid).catch(() => {});
      const { sendInviteEmail } = await import("@/lib/email");
      await sendInviteEmail({ to: email, name, role: "member", token, contact_cid: cid });
      invited = true;
    } catch (error) {
      // The person exists and is reachable; the invitation can be resent from the
      // people screen. Reported rather than swallowed.
      console.error("[POST /api/people] invite failed:", error?.message);
    }

    return NextResponse.json({ success: true, cid, existing: false, invited, added_by: session?.cid || null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
