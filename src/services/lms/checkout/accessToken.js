/**
 * CHECKOUT — the one-time password link and the payer's own window.
 *
 * Only the HASH of a token is ever stored (a database leak yields no usable
 * takeover link), and a link is only served inside a short window after the
 * payment. Decisions here, statements in `@/models/lms/checkoutStore`.
 */

import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { LMS_CHECKOUT_ACCESS_WINDOW_MINUTES } from "@/models/lms/constants";
import { invalidateAccessTokens, insertAccessToken } from "@/models/lms/checkoutStore";

/**
 * A one-time link where the person chooses their OWN password. Only the HASH is
 * stored: a database leak yields no usable takeover link. The previous unused
 * token is invalidated, so only the newest link works.
 */
export async function issueAccessToken(contactCid) {
  try {
    await ensureTokenHashColumns();
  } catch (_) {
    // Self-healing is best-effort; a failure must not block the enrollment.
  }
  await invalidateAccessTokens(contactCid).catch(() => {});

  const token = uuidv4();
  // NO `token_type`: that column belongs to the invite/reset flow, whose
  // constraint only admits 'staff_invite', 'participant_invite',
  // 'password_reset' and 'family_invite' (and which some environments never
  // created at all). Writing 'lms_purchase' there made the INSERT fail, so the
  // whole access step was recorded as failed and a paid learner received a
  // receipt with no way to choose a password. Nothing ever reads the type back
  // — the setup link is validated by its own hash, expiry and `used` flag — so
  // this insert deliberately omits it, exactly like the family/resend invite
  // helpers.
  await insertAccessToken(hashToken(token), contactCid);
  return token;
}

export function accessWindowMinutes() {
  const configured = Number(process.env.CHECKOUT_ACCESS_WINDOW_MINUTES);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return LMS_CHECKOUT_ACCESS_WINDOW_MINUTES;
}

/**
 * The payer's own tab may be handed a link only while the moment is fresh.
 * Past the window the answer is "check your email", so a reference that leaked
 * elsewhere is worthless.
 */
export function accessWindowOpen(registration) {
  if (!registration?.paid_at || registration.status !== "paid") return false;
  const paidAt = new Date(registration.paid_at).getTime();
  if (!Number.isFinite(paidAt)) return false;
  return Date.now() - paidAt <= accessWindowMinutes() * 60 * 1000;
}

function learningPath(courseId) {
  return `/participant/learning/${courseId}`;
}

export function loginUrl(courseId) {
  return `/login?next=${encodeURIComponent(learningPath(courseId))}`;
}

/** The one-time password link carries WHERE to land afterwards, so choosing a
 * password drops the payer straight into their course instead of a home screen. */
export function setupPasswordUrl(token, courseId) {
  return `/setup-password/${token}?next=${encodeURIComponent(learningPath(courseId))}`;
}