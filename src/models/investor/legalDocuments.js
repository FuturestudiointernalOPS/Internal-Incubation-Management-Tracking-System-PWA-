import db from "@/lib/db";

export async function markOnboardingCompleted(investorProfileId) {
  return db.execute({
    sql: `UPDATE investor_profiles
             SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
                 updated_at = NOW()
           WHERE id = ?
           RETURNING id, onboarding_completed_at`,
    args: [investorProfileId],
  });
}

export async function getActiveLegalDocument({ docType, language }) {
  const lang = language === "fr" ? "fr" : "en";
  return db.execute({
    sql: `SELECT * FROM legal_documents
           WHERE doc_type = ?
             AND language = ?
             AND status IN ('draft', 'approved')
           ORDER BY CASE WHEN status = 'approved' THEN 0 ELSE 1 END, effective_at DESC NULLS LAST, created_at DESC
           LIMIT 1`,
    args: [docType, lang],
  });
}

export async function recordLegalAcceptance({
  investorProfileId,
  documentId,
  docType,
  version,
  language,
}) {
  return db.execute({
    sql: `INSERT INTO investor_legal_acceptances
            (investor_profile_id, document_id, doc_type, version, language)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (investor_profile_id, doc_type, version) DO UPDATE
            SET accepted_at = NOW()
          RETURNING *`,
    args: [investorProfileId, documentId, docType, version, language],
  });
}

export async function markInvestorNdaAccepted({ investorProfileId, version }) {
  return db.execute({
    sql: `UPDATE investor_profiles
             SET nda_accepted_at = NOW(),
                 nda_version = ?,
                 terms_accepted_at = COALESCE(terms_accepted_at, NOW()),
                 terms_version = COALESCE(terms_version, ?),
                 updated_at = NOW()
           WHERE id = ?
           RETURNING id, nda_accepted_at, nda_version, terms_accepted_at, terms_version`,
    args: [version, version, investorProfileId],
  });
}
