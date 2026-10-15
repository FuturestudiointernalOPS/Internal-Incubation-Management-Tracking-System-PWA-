/**
 * services/ventures/sessionInvitees — the people a Venture session is announced
 * to by e-mail, and what they read.
 *
 * A session invitee is an E-MAIL, not necessarily an account: a guest, an
 * external coach, a partner. The address may belong to an ImpactOS account — in
 * which case the session is also pushed to that person's own calendar (their
 * Future Studio calendar, once they have connected one) — or to nobody, and
 * then the e-mail itself carries an "add to calendar" link and an .ics file.
 *
 * Every notice is best-effort: a failed e-mail or calendar push never fails the
 * write. The one thing that DOES fail loudly is the table itself — see
 * `ensureInviteeSchema` below: an invitation nobody could record must never be
 * confirmed as sent.
 *
 * SQL lives in `@/models/ventureSessionInviteesStore`; the e-mail and the
 * calendar use their own facades; nothing here runs SQL.
 */
import { selectContactByEmail } from "@/models/contactLookupStore";
import { runVentureMigration } from "@/models/ventureSchemaStore";
import {
  deleteInvitee,
  selectInvitedSessionsForContact,
  selectInviteeById,
  selectInviteesBySession,
  selectInviteesBySessionIds,
  upsertInvitee,
} from "@/models/ventureSessionInviteesStore";
import { buildGoogleCalendarUrl, buildIcsEvent } from "@/lib/calendarIcs";
import { sendStandaloneEmail } from "@/lib/email";
import inviteeSchema from "./schema/sessionInvitees";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The invitee table, ensured ONCE per process, at the point invitees are used.
 *
 * `venture_session_invitees` used to be created only by `ensureVentureSchema()`,
 * which runs on the Venture intake and admin paths — never on the booking path.
 * In production the table therefore did not exist at all: the INSERT threw, the
 * route swallowed the throw, and an invitation that was never written looked
 * exactly like one whose e-mail had gone missing.
 *
 * These are the same three statements the full bootstrap replays, kept in one
 * place (`./schema/sessionInvitees`, also part of `ensureVentureSchema`). A
 * failure is NOT memoized — the next attempt retries — and it is logged, because
 * a broken invitation is something the booker has to be told about, not a
 * silent success.
 */
let inviteeSchemaEnsured = null;

function ensureInviteeSchema() {
  if (!inviteeSchemaEnsured) {
    inviteeSchemaEnsured = (async () => {
      for (const sql of inviteeSchema) await runVentureMigration(sql);
    })().catch((error) => {
      console.error("[session-invitation] the invitee table could not be created:", error?.message || error);
      inviteeSchemaEnsured = null;
      throw error;
    });
  }
  return inviteeSchemaEnsured;
}

/** A raw e-mail → its normalized form, or null when it is not an address. */
export function normalizeInviteEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export async function listSessionInvitees(sessionId) {
  await ensureInviteeSchema();
  const res = await selectInviteesBySession(sessionId);
  return res.rows || [];
}

/**
 * The invitees of several sessions at once, as the sessions panel reads them.
 * The table is ensured here too: a READ must not be the first thing that ever
 * touches it, or a panel 500s on a database the bookings have not reached yet.
 */
export async function listInviteesBySessionIds(sessionIds) {
  await ensureInviteeSchema();
  const res = await selectInviteesBySessionIds(sessionIds);
  return res.rows || [];
}

export async function getSessionInvitee(inviteeId) {
  await ensureInviteeSchema();
  const res = await selectInviteeById(inviteeId);
  return res.rows?.[0] || null;
}

/** The sessions an account was invited to, as the personal calendar reads them. */
export async function listInvitedSessionsForContact(contactCid) {
  if (!contactCid) return [];
  await ensureInviteeSchema();
  const res = await selectInvitedSessionsForContact(contactCid);
  return res.rows || [];
}

/** The calendar-ready event of a session (title, memo, place, window). */
function sessionEvent(session) {
  const description = [
    session.description ? `Memo: ${session.description}` : "",
    session.coach_name ? `With: ${session.coach_name}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `session-${session.id}@impactos`,
    title: session.title || "Venture session",
    description,
    location: session.location || null,
    url: session.meeting_link || null,
    startIso: session.start_time,
    endIso: session.end_time,
  };
}

/**
 * Add (or refresh) one invitee and e-mail them the invitation. Returns
 * `{ ok: true, invitee }` or `{ ok: false, error }` (the controller sends 400).
 *
 * @param {object} args
 * @param {number} args.sessionId
 * @param {object} args.session      the session row (for the invitation content)
 * @param {string} [args.ventureLabel] the Venture's name (for the e-mail)
 * @param {string} args.email
 * @param {string} [args.name]
 * @param {string} [args.actorCid]
 */
export async function addSessionInvitee({ sessionId, session, ventureLabel, email, name, actorCid }) {
  const clean = normalizeInviteEmail(email);
  if (!clean) return { ok: false, error: "A valid e-mail address is required." };

  // The table this writes to exists by the time the write happens — a missing
  // one is a loud failure, never an invitation that quietly did not happen.
  await ensureInviteeSchema();

  // An address that belongs to an account is bound to it: the session can then
  // also reach that person's calendar, and their display name fills in.
  let contactCid = null;
  let displayName = name ? String(name).trim() : null;
  try {
    const contact = await selectContactByEmail(clean);
    const row = contact.rows?.[0];
    if (row) {
      contactCid = row.cid || null;
      displayName = displayName || row.name || null;
    }
  } catch (_) {
    // A lookup failure never blocks the invitation.
  }

  const inserted = await upsertInvitee({ sessionId, email: clean, name: displayName, contactCid, createdBy: actorCid || null });
  const invitee = inserted.rows?.[0] || { session_id: sessionId, email: clean, name: displayName, contact_cid: contactCid };

  // The transport RETURNS its failure — it does not throw — so the result has to
  // be kept: an invitation that never left must not look like one that did, or
  // the booking says "notified by email" for an inbox that stays empty.
  let emailResult = { sent: false, error: null };
  try {
    const result = await emailSessionInvitation({ session, ventureLabel, invitee });
    emailResult = {
      sent: result?.success === true,
      error: result?.success === true ? null : result?.error || result?.note || "errors.somethingWrong",
    };
  } catch (error) {
    emailResult = { sent: false, error: error?.message || String(error) };
  }

  // An account that connected a calendar gets the session through its own sync
  // source (the invite is a session the person is part of). Best-effort.
  if (contactCid) {
    try {
      const { syncUser } = await import("@/services/integrations/googleCalendar");
      await syncUser(contactCid);
    } catch (_) {}
  }
  return { ok: true, invitee, emailResult };
}

/** Remove one invitee. Their calendar loses the session on its next sync. */
export async function removeSessionInvitee(inviteeId) {
  await ensureInviteeSchema();
  await deleteInvitee(inviteeId);
  return { ok: true };
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

/** The invitation e-mail: the session, its memo, a "add to calendar" button and an .ics. */
export async function emailSessionInvitation({ session, ventureLabel, invitee }) {
  if (!session || !invitee?.email) {
    // A skip is a DECISION, not an accident — but silence made it look like a
    // lost email: no log row is written when the send never starts, so a guest
    // who is not written to and a guest whose mail vanished were
    // indistinguishable. Say why, and report it as the failure it is.
    console.warn(
      "[session-invitation] SKIPPED — not sent: " +
        (!session ? "the session could not be read" : "no recipient address"),
    );
    return { skipped: true, error: "errors.somethingWrong" };
  }
  const when = session.start_time ? new Date(session.start_time).toUTCString() : "";
  const googleUrl = buildGoogleCalendarUrl(sessionEvent(session));
  const lines = [
    `${session.title || "A session"}${ventureLabel ? ` — ${ventureLabel}` : ""}`,
    when ? `When: ${when}` : "",
    session.location ? `Where: ${session.location}` : "",
    session.meeting_link ? `Join: ${session.meeting_link}` : "",
    session.description ? `\n${session.description}` : "",
  ].filter(Boolean);
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">
      <p>You are invited to a Venture session on ImpactOS.</p>
      <p style="white-space:pre-wrap;">${escapeHtml(lines.join("\n"))}</p>
      ${googleUrl ? `<p><a href="${googleUrl}" style="background:#ff6a00;color:#000;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold;">Add to my calendar</a></p>` : ""}
      <p>An .ics file is attached — open it in any calendar app to add the session.</p>
    </div>`;
  const ics = buildIcsEvent(sessionEvent(session));
  const attachments = ics
    ? [{ filename: "session.ics", content: ics, contentType: "text/calendar" }]
    : undefined;
  return sendStandaloneEmail({
    to: invitee.email,
    subject: `Invitation: ${session.title || "Venture session"}`,
    html,
    contact_cid: invitee.contact_cid || null,
    email_type: "session_invitation",
    note: `Session invitation #${session.id}`,
    attachments,
    // GMAIL first, explicitly. This mail carries the .ics, and only the Gmail
    // transport can attach a file — the Resend sender has no attachment
    // support, so a fallback drops the calendar file silently. Pinning it here
    // also survives someone setting EMAIL_PRIMARY_PROVIDER=resend globally.
    provider: "gmail",
  });
}
