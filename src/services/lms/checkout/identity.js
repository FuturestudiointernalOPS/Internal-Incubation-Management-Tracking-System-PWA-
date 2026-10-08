/**
 * CHECKOUT — the payer's identity and course access writes.
 *
 * The purchase account/enrollment writes, and the revoke path (suspend, never
 * delete). Decisions here, statements in `@/models/lms/checkoutStore`.
 */

import { normalizeRegistrationEmail } from "@/models/lms/registrations";
import {
  selectPurchaseContact,
  insertPurchaseContactRow,
  insertPurchaseEnrollmentRow,
  selectPurchaseEnrollment,
  suspendEnrollment,
} from "@/models/lms/checkoutStore";

export async function findContactForPurchase(email) {
  const res = await selectPurchaseContact(normalizeRegistrationEmail(email));
  return res.rows[0] || null;
}

export async function insertPurchaseContact({ cid, name, email, phone, language = "en" }) {
  return insertPurchaseContactRow({
    cid,
    name,
    email,
    phone: phone || null,
    language: language || "en",
  });
}

export async function insertPurchaseEnrollment(courseId, userCid) {
  return insertPurchaseEnrollmentRow(courseId, userCid);
}

/**
 * Take the course access back. The enrollment is SUSPENDED — the state the rest
 * of the platform already treats as "no access" — so My Learning stops listing
 * the course while the payment, the registration and the audit trail all stay.
 * Only the enrollment this checkout created (source 'purchase') is touched,
 * never an admin- or program-granted one. Idempotent.
 */
export async function revokePurchaseAccess({ courseId, userCid }) {
  if (!courseId || !userCid) return { revoked: false };

  const found = await selectPurchaseEnrollment(String(courseId), String(userCid));
  const enrollment = found.rows[0];
  if (!enrollment) return { revoked: false };

  const res = await suspendEnrollment(enrollment.id);
  return { revoked: (res.rowsAffected || 0) > 0 };
}