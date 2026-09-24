/**
 * The document types this product shipped with, and the vocabulary around them.
 *
 * Deliberately free of any database import: the Data bank screens are client
 * components and fall back to this list when the configured list cannot be read,
 * so importing the model (which pulls in the database client) from a client
 * component must not be necessary. The model seeds its table from HERE, so the
 * seed and the fallback can never drift apart.
 *
 * The codes are the same ones the Data bank used when the list was hardcoded, so
 * existing per-Venture items and uploaded documents keep matching.
 */

export const DEFAULT_VENTURE_DOCUMENT_TYPES = [
  {
    code: "business_registration",
    label_en: "Business Registration",
    label_fr: "Immatriculation de l'entreprise",
    required: true,
    verification_method: "upload",
    sort_order: 1,
  },
  {
    code: "founder_identity",
    label_en: "Founder Identity",
    label_fr: "Identité du fondateur",
    required: true,
    verification_method: "upload",
    sort_order: 2,
  },
  {
    code: "email_verification",
    label_en: "Email Verification",
    label_fr: "Vérification de l'e-mail",
    required: false,
    verification_method: "external",
    sort_order: 3,
  },
  {
    code: "phone_verification",
    label_en: "Phone Verification",
    label_fr: "Vérification du téléphone",
    required: false,
    verification_method: "external",
    sort_order: 4,
  },
  {
    code: "legal_documents",
    label_en: "Legal Documents",
    label_fr: "Documents juridiques",
    required: true,
    verification_method: "upload",
    sort_order: 5,
  },
  {
    code: "financial_documents",
    label_en: "Financial Documents",
    label_fr: "Documents financiers",
    required: true,
    verification_method: "upload",
    sort_order: 6,
  },
];

/** Codes that shipped with the product: editable, but never deletable. */
export const BUILT_IN_DOCUMENT_TYPE_CODES = DEFAULT_VENTURE_DOCUMENT_TYPES.map(
  (documentType) => documentType.code,
);

/** How a document type is confirmed. */
export const DOCUMENT_VERIFICATION_METHODS = ["upload", "external"];

const MAX_CODE_LENGTH = 60;

/**
 * The code is the stable identity a Venture's item and its uploaded documents
 * are matched on, so it is derived from the label once and never renamed.
 */
export function slugifyDocumentTypeCode(label) {
  return String(label || "")
    .normalize("NFD")
    // Strip the combining marks NFD just separated, so "Vérification" → "verification".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_CODE_LENGTH);
}
