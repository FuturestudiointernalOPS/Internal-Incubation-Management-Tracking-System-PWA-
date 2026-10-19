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

/**
 * The calendar-ready event of a session (title, memo, place, window, organiser).
 *
 * The ORGANISER is what makes an invitation legible once it is IN someone's
 * calendar: without it the event appears anonymously, and the guest cannot see
 * who asked them to be there. It is the connected person who sent the
 * invitation — not the platform's own sending address.
 */
function sessionEvent(session, inviter) {
  const description = [
    inviter?.name ? `Invited by: ${inviter.name}` : "",
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
    organizerName: inviter?.name || null,
    organizerEmail: inviter?.email || null,
  };
}

/**
 * "15 Oct 2026, 07:45 UTC" — the same instant the e-mail always showed (it is
 * pinned to UTC on purpose: the stored wall clock is what the organiser typed,
 * and moving it to a local zone here would silently shift it).
 */
function formatWhen(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date) + " UTC";
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
 * @param {string} [args.actorName]  the connected person who sends the invitation
 * @param {string} [args.actorEmail] …and their own address, so the guest's
 *   calendar can show who organised it
 */
export async function addSessionInvitee({ sessionId, session, ventureLabel, email, name, actorCid, actorName, actorEmail }) {
  const clean = normalizeInviteEmail(email);
  if (!clean) return { ok: false, error: "A valid e-mail address is required." };

  // The table this writes to exists by the time the write happens — a missing
  // one is a loud failure, never an invitation that quietly did not happen.
  await ensureInviteeSchema();

  // Who is inviting: the signed-in person, read from their session, not guessed
  // from the session row. It travels in the e-mail and in the .ics.
  const inviter = {
    name: actorName ? String(actorName).trim() || null : null,
    email: actorEmail ? String(actorEmail).trim() || null : null,
  };

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
    const result = await emailSessionInvitation({ session, ventureLabel, invitee, inviter });
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

/**
 * The invitation e-mail.
 *
 * It leads with the two things a guest actually needs:
 *  1. WHO invited them — the connected person who sent it, in the greeting, the
 *     heading line and (for the calendar) as the event's organiser;
 *  2. WHEN it is — the window, in the same instant the app shows.
 *
 * It then carries everything needed to be IN their own calendar: a one-click
 * Google Calendar button, and the .ics the button cannot help with (Outlook,
 * Apple Calendar, a desktop client). The .ics names the organiser too, so the
 * event does not land in their calendar as an anonymous block.
 */
export async function emailSessionInvitation({ session, ventureLabel, invitee, inviter }) {
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

  const who = inviter?.name ? String(inviter.name).trim() : null;
  const event = sessionEvent(session, inviter);
  const when = formatWhen(session.start_time);
  const googleUrl = buildGoogleCalendarUrl(event);
  const ics = buildIcsEvent(event);

  const detailRows = [
    ["When", when],
    ["Venture", ventureLabel],
    ["Where", session.location],
  ].filter(([, value]) => Boolean(value));
  if (session.meeting_link) {
    detailRows.push([
      "Join",
      `<a href="${escapeHtml(session.meeting_link)}" style="color:#c2410c;">${escapeHtml(session.meeting_link)}</a>`,
    ]);
  }

  const html = `
    <div style="background:#f4f5f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e5e8;border-radius:14px;padding:28px;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">ImpactOS &middot; Venture session</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#111827;">Invitation for a session</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#1f2937;">
          ${who ? `<strong>${escapeHtml(who)}</strong> invited you to a session.` : "You have been invited to a session."}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
          <tr>
            <td style="padding:0 0 10px;font-size:16px;font-weight:bold;line-height:1.4;" colspan="2">${escapeHtml(session.title || "Venture session")}</td>
          </tr>
          ${detailRows
            .map(
              ([label, value]) => `<tr>
            <td style="padding:4px 14px 4px 0;vertical-align:top;color:#6b7280;white-space:nowrap;">${label}</td>
            <td style="padding:4px 0;vertical-align:top;">${value}</td>
          </tr>`,
            )
            .join("")}
        </table>
        ${
          session.description
            ? `<div style="margin:20px 0 0;padding:12px 14px;background:#f9fafb;border-left:3px solid #ff6a00;border-radius:6px;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">Memo</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap;">${escapeHtml(session.description)}</p>
        </div>`
            : ""
        }
        ${
          googleUrl
            ? `<p style="margin:24px 0 0;"><a href="${googleUrl}" style="display:inline-block;background:#ff6a00;color:#111827;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Add to my calendar</a></p>`
            : ""
        }
        <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
          An .ics file is attached — open it in Google Calendar, Outlook or Apple Calendar to add this session to your own calendar.
        </p>
      </div>
    </div>`;

  const attachments = ics
    ? [{ filename: "session-invitation.ics", content: ics, contentType: "text/calendar" }]
    : undefined;
  return sendStandaloneEmail({
    to: invitee.email,
    subject: "Invitation for a session",
    html,
    contact_cid: invitee.contact_cid || null,
    email_type: "session_invitation",
    note: `Session invitation #${session.id}`,
    attachments,
    // The guest's inbox should say WHO asked them, not just which platform the
    // mail came from — the address stays the platform's (deliverability), the
    // display name is the connected person who booked.
    fromName: who || undefined,
    // GMAIL first, explicitly. This mail carries the .ics, and only the Gmail
    // transport can attach a file — the Resend sender has no attachment
    // support, so a fallback drops the calendar file silently. Pinning it here
    // also survives someone setting EMAIL_PRIMARY_PROVIDER=resend globally.
    provider: "gmail",
  });
}
