import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { initDb } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  upsertContact,
  createPasswordSetupToken,
  markContactInvited,
  findContactCidByPhone,
  findContactByEmail,
} from "@/models/contacts";

export const dynamic = "force-dynamic";

/**
 * /api/people — MEMBERSHIP, DECIDED ON THE EMAIL ADDRESS.
 *
 * ── WHY EMAIL IS THE KEY ────────────────────────────────────────────────────
 *
 * A name is not an identity. Two people share one; one person spells it two
 * ways. An email is unique — `contacts.email` is UNIQUE in the schema — so
 * "is this human already here?" is a question only an email can answer without
 * guessing. That is what removes the ambiguity: there is ONE question, asked
 * once, and exactly one of two answers.
 *
 *   GET  /api/people?email=…   → is this address already a member?
 *   POST /api/people           → it is not; add them and invite them
 *
 * The reviewer was previously asked to choose between "select a member" and
 * "add a person", which is a decision they had no way to make without first
 * looking. Now they type the address and the system says which situation they
 * are in. One field, one answer.
 *
 * ── WHAT IS REQUIRED ────────────────────────────────────────────────────────
 *
 * Name and email. The name always exists — it came from the tracker — and the
 * email is the address the invitation is sent to. The phone number is part of
 * the profile when it is known and is NEVER an invitation channel: invitations
 * go by email, only by email.
 *
 * ── AN EXISTING EMAIL IS NEVER OVERWRITTEN ──────────────────────────────────
 *
 * `upsertContact` carries `ON CONFLICT(email) DO UPDATE`, which is right for the
 * flows that mean "refresh this contact" and catastrophic here: it would rewrite
 * a sitting member's role and status from a tracker row. A Super Admin whose
 * email appeared in a spreadsheet would be demoted to `member` and set
 * `pending`. So the address is checked FIRST and an existing person is returned
 * untouched — this endpoint may only ever CREATE.
 *
 * The role is fixed to `member` server-side and is NEVER read from the request:
 * `contacts.role` decides what a session may do, so accepting a role from a
 * caller would be a privilege boundary. A collaborator is a member; anything
 * more is granted afterwards through the Access Profile system.
 */

/** Only a person who may create contacts may ask who exists. */
async function gate() {
  const authError = await requireAuth();
  if (authError) return authError;
  return requireAuthorization("contacts", "create");
}

const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * GET /api/people?email=… — does this address already belong to someone?
 *
 * Answers with the person when it does, and `found: false` when it does not.
 * The caller needs both answers: one means "link this assignment to them", the
 * other means "offer the invitation".
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await gate();
    if (capError) return capError;

    const email = cleanEmail(new URL(req.url).searchParams.get("email"));
    if (!email) {
      return NextResponse.json({ success: false, error: "errors.invalidEmail" }, { status: 400 });
    }

    const result = await findContactByEmail(email);
    const contact = result.rows?.[0] || null;

    return NextResponse.json({
      success: true,
      email,
      found: Boolean(contact),
      contact: contact
        ? { cid: contact.cid, name: contact.name, email: contact.email, role: contact.role, status: contact.status }
        : null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await gate();
    if (capError) return capError;

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").replace(/\s+/g, " ").trim();
    const email = cleanEmail(body?.email);
    // Optional: collected when it is known, never a reason to refuse.
    const phone = String(body?.phone || "").replace(/\s+/g, " ").trim();

    if (!name || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "errors.personRequiresNameEmail",
          missing: [...(name ? [] : ["name"]), ...(email ? [] : ["email"])],
        },
        { status: 400 },
      );
    }
    if (!looksLikeEmail(email)) {
      return NextResponse.json({ success: false, error: "errors.invalidEmail" }, { status: 400 });
    }

    // THE IDENTITY QUESTION, ASKED ONCE. An address that already belongs to
    // someone IS that someone — return them, change nothing about them.
    const byEmail = await findContactByEmail(email).catch(() => ({ rows: [] }));
    const existingByEmail = byEmail.rows?.[0] || null;
    if (existingByEmail) {
      return NextResponse.json({
        success: true,
        cid: existingByEmail.cid,
        existing: true,
        invited: false,
        contact: { cid: existingByEmail.cid, name: existingByEmail.name, email: existingByEmail.email },
      });
    }

    // A phone number that already belongs to someone IS that someone too.
    // Creating a second person for the same human is how duplicates start.
    if (phone) {
      const byPhone = await findContactCidByPhone(phone).catch(() => ({ rows: [] }));
      const existingCid = byPhone.rows?.[0]?.cid || null;
      if (existingCid) {
        return NextResponse.json({ success: true, cid: existingCid, existing: true, invited: false });
      }
    }

    const session = await getSession();
    const cid = "USER_" + uuidv4().split("-")[0].toUpperCase() + Math.floor(Math.random() * 10000);
    // An unusable password: the account only gains a real one through activation.
    const hashedPassword = await hashPassword(uuidv4());

    await upsertContact({
      cid,
      name,
      email,
      phone: phone || null,
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

    return NextResponse.json({
      success: true,
      cid,
      existing: false,
      invited,
      contact: { cid, name, email },
      added_by: session?.cid || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
