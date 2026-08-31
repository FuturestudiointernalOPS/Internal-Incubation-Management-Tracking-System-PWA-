import { randomBytes } from "crypto";
import db from "@/lib/db";
import { LmsError } from "./errors";

/**
 * LMS certificates (Phase 5).
 *
 * Design rules (see docs/LMS_ARCHITECTURE.md + the Phase 5 spec):
 *   - Completion is authoritative on lms_enrollments (status + completed_at).
 *     Certificates are a CONSEQUENCE — issuance is server-side only, driven by
 *     a completed enrollment, never by client flags.
 *   - Idempotent: one certificate per completed enrollment (DB UNIQUE on
 *     enrollment_id + an existing-record check). Retried issuance returns the
 *     existing certificate instead of creating a duplicate.
 *   - The certificate records a snapshot of the learner name and course title
 *     at issuance so historical integrity survives later renames.
 *   - The public-facing certificate_number (CERT-<YYYY>-<NNNNNN>) is unique and
 *     human-readable but NEVER the internal DB id. Public verification uses a
 *     separate random verification_token so the URL is not enumerable.
 *   - V1 status lifecycle: valid -> revoked. Revocation never deletes the
 *     record — the historical record must remain auditable.
 */

const CERT_NUMBER_PREFIX = "CERT";
const LEARNER_NAME_FALLBACK = "Learner";

function parseCertificate(row) {
  if (!row) return null;
  return {
    id: row.id,
    certificate_number: row.certificate_number,
    verification_token: row.verification_token,
    enrollment_id: row.enrollment_id,
    course_id: row.course_id,
    user_cid: row.user_cid,
    learner_name: row.learner_name,
    course_title: row.course_title,
    issued_at: row.issued_at,
    status: row.status,
    revoked_at: row.revoked_at,
  };
}

/**
 * Fields deliberately exposed by the PUBLIC verification endpoint.
 * Everything else (internal ids, user identity, enrollment data, the
 * verification token itself) is private.
 */
function toPublicCertificate(cert) {
  return {
    certificate_number: cert.certificate_number,
    learner_name: cert.learner_name,
    course_title: cert.course_title,
    issued_at: cert.issued_at,
    status: cert.status,
  };
}

async function getCertificateByEnrollment(enrollmentId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_certificates WHERE enrollment_id = ?",
    args: [enrollmentId],
  });
  return parseCertificate(res.rows[0]);
}

export async function getCertificateById(certificateId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_certificates WHERE id = ?",
    args: [certificateId],
  });
  return parseCertificate(res.rows[0]);
}

/** Next certificate number for the current year: CERT-<YYYY>-<NNNNNN>. */
async function nextCertificateNumber() {
  const year = new Date().getUTCFullYear();
  const res = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM lms_certificates WHERE certificate_number LIKE ?",
    args: [`${CERT_NUMBER_PREFIX}-${year}-%`],
  });
  const count = Number((res.rows[0] && res.rows[0].n) || 0);
  return `${CERT_NUMBER_PREFIX}-${year}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Server-side, idempotent certificate issuance for ONE completed enrollment.
 *
 * - Requires a persisted `completed` enrollment — the caller derives that from
 *   the authoritative completion engine; this service re-verifies it so a
 *   client can never force issuance.
 * - If a certificate already exists for the enrollment, returns it unchanged
 *   (retry-safe: a technical failure + retry never duplicates).
 * - The certificate_number is derived from a per-year count; the DB UNIQUE
 *   constraint guards concurrent issuance (retry with a fresh number).
 *
 * @returns {{ certificate: object, created: boolean }}
 */
export async function issueCertificate({ enrollment, course, learnerName }) {
  if (!enrollment || !course) {
    throw new LmsError("lms.errors.certificateIssueFailed", 500);
  }
  if (enrollment.status !== "completed") {
    throw new LmsError("lms.errors.notCompleted", 409);
  }

  const existing = await getCertificateByEnrollment(enrollment.id);
  if (existing) return { certificate: existing, created: false };

  // Authoritative snapshot — never take name/course/date from the client.
  const name =
    learnerName && String(learnerName).trim() ? String(learnerName).trim() : LEARNER_NAME_FALLBACK;
  const title = String(course.title || "Course").trim();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const certificate_number = await nextCertificateNumber();
      const verification_token = randomBytes(12).toString("hex");
      const res = await db.execute({
        sql: `INSERT INTO lms_certificates
                (certificate_number, verification_token, enrollment_id, course_id, user_cid,
                 learner_name, course_title, issued_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING *`,
        args: [
          certificate_number,
          verification_token,
          enrollment.id,
          course.id,
          enrollment.user_cid,
          name,
          title,
        ],
      });
      return { certificate: parseCertificate(res.rows[0]), created: true };
    } catch (e) {
      // Collision on certificate_number (concurrent issuance) — retry with a
      // fresh number. Any other error propagates.
      if (!/unique/i.test(String(e.message))) throw e;
    }
  }
  throw new LmsError("lms.errors.certificateIssueFailed", 500);
}

/**
 * Ensure a completed enrollment has a certificate (idempotent).
 * Used by the completion paths AND lazily by read surfaces so enrollments that
 * were completed before this phase shipped receive their certificate on first
 * access. Returns null while the enrollment is not completed.
 */
export async function ensureCertificateForEnrollment({ course, enrollment }) {
  if (!enrollment) return null;
  const existing = await getCertificateByEnrollment(enrollment.id);
  if (existing) return existing;
  if (enrollment.status !== "completed") return null;

  const contactRes = await db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [enrollment.user_cid],
  });
  const learnerName = contactRes.rows[0] ? contactRes.rows[0].name : null;
  const { certificate } = await issueCertificate({ enrollment, course, learnerName });
  return certificate;
}

// ─── Learner-facing reads (authorization enforced server-side) ─────────────

/** The authenticated learner's own certificates. */
export async function getCertificatesForLearner(userCid) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_certificates WHERE user_cid = ? ORDER BY issued_at DESC",
    args: [userCid],
  });
  return res.rows.map(parseCertificate);
}

/**
 * One certificate, ownership-scoped. A learner can never read (or manipulate
 * certificate_id to reach) another learner's certificate — 403 otherwise.
 */
export async function getLearnerCertificate(certificateId, userCid) {
  const cert = await getCertificateById(certificateId);
  if (!cert) throw new LmsError("lms.errors.certificateNotFound", 404);
  if (String(cert.user_cid) !== String(userCid)) {
    throw new LmsError("lms.errors.noCertificateAccess", 403);
  }
  return cert;
}

// ─── Public verification (no authentication) ────────────────────────────────

/**
 * Public certificate verification. Accepts the random verification token
 * (primary) or the certificate number (convenience). Returns ONLY the
 * deliberately public certificate fields — never emails, user ids,
 * enrollment data, internal database ids, or the token itself.
 */
export async function getCertificatePublic(tokenOrNumber) {
  const value = String(tokenOrNumber || "").trim();
  if (!value) throw new LmsError("lms.errors.certificateNotFound", 404);

  const byToken = await db.execute({
    sql: "SELECT * FROM lms_certificates WHERE verification_token = ?",
    args: [value],
  });
  let cert = parseCertificate(byToken.rows[0]);
  if (!cert) {
    const byNumber = await db.execute({
      sql: "SELECT * FROM lms_certificates WHERE certificate_number = ?",
      args: [value],
    });
    cert = parseCertificate(byNumber.rows[0]);
  }
  if (!cert) throw new LmsError("lms.errors.certificateNotFound", 404);

  return toPublicCertificate(cert);
}

// ─── Minimal revocation (V1) ────────────────────────────────────────────────

/**
 * Revoke a certificate. Idempotent; never deletes the record — the historical
 * record must remain auditable (spec §21-22). Admin-only at the route layer.
 */
export async function revokeCertificate(certificateId) {
  const cert = await getCertificateById(certificateId);
  if (!cert) throw new LmsError("lms.errors.certificateNotFound", 404);
  if (cert.status === "revoked") {
    return { success: true, certificate: cert };
  }
  await db.execute({
    sql: "UPDATE lms_certificates SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [certificateId],
  });
  return { success: true, certificate: await getCertificateById(certificateId) };
}
