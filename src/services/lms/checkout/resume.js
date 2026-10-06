/**
 * CHECKOUT — the way back for an EXISTING registration.
 *
 * The resume link ("come back and finish"), its expiry, and the lookup that
 * tells the fallback door which registration an email refers to. A resume token
 * never grants access on its own — only the verified payment does.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/lms/registrations`.
 */

import { v4 as uuidv4 } from "uuid";
import { hashToken } from "@/lib/token-hashing";
import {
  normalizeRegistrationEmail,
  findRegistrationByCourseAndEmail,
  listRegistrationsByEmail,
  getRegistrationByResumeTokenHash,
  setResumeToken,
} from "@/models/lms/registrations";

/**
 * Resolve the payment context from a resume token. The token is NOT consumed on
 * read, so reloading the page still works; it merely expires (48h) or is
 * replaced when a newer link is issued. It never grants access on its own — only
 * the verified payment does.
 */
export async function resolveResumeToken(token) {
  const value = String(token || "").trim();
  if (!value) return null;
  const registration = await getRegistrationByResumeTokenHash(hashToken(value));
  if (!registration) return null;
  const expiresAt = new Date(registration.resume_token_expires_at || 0).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return registration;
}

const RESUME_TOKEN_TTL_HOURS = 48;

/**
 * Mint the "come back and finish" link for the person who owns this email. Only
 * the HASH is stored; the raw link is returned once, to be emailed.
 */
export async function issueResumeLink(registration) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + RESUME_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await setResumeToken(registration.id, { tokenHash: hashToken(token), expiresAt });
  return token;
}

/**
 * Which registration an email refers to, for the fallback door. Paid wins (the
 * person wants in); otherwise the most recent unpaid attempt (they want to pay).
 */
export async function findResumableRegistration({ email, courseId = null }) {
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!cleanEmail) return null;

  if (courseId) {
    const byCourse = await findRegistrationByCourseAndEmail(courseId, cleanEmail);
    if (byCourse) return byCourse;
  }
  const all = await listRegistrationsByEmail(cleanEmail);
  return all.find((row) => row.status === "paid") || all[0] || null;
}