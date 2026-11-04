import { Briefcase, Building2, DollarSign, FileText, Mail, Phone, User } from "lucide-react";

/**
 * The document types this product shipped with. Their names are NOT read from
 * the stored label: they stay translated through the locale files, so an
 * existing database keeps showing "Immatriculation de l'entreprise" in French
 * after the type list became configurable. A type defined in the product carries
 * its own name (see `documentTypeName`).
 */
export const BUILT_IN_DOCUMENT_TYPE_LABEL_KEYS = {
  business_registration: "vadmin.verification.stepBusinessRegistration",
  founder_identity: "vadmin.verification.stepFounderIdentity",
  email_verification: "vadmin.verification.stepEmailVerification",
  phone_verification: "vadmin.verification.stepPhoneVerification",
  legal_documents: "vadmin.verification.stepLegalDocuments",
  financial_documents: "vadmin.verification.stepFinancialDocuments",
};

const DOCUMENT_TYPE_ICONS = {
  business_registration: Building2,
  founder_identity: User,
  email_verification: Mail,
  phone_verification: Phone,
  legal_documents: Briefcase,
  financial_documents: DollarSign,
};

/** The icon for a document type; anything the product did not ship gets a document. */
export function documentTypeIcon(code) {
  return DOCUMENT_TYPE_ICONS[code] || FileText;
}

/**
 * What to call a document type on screen: the shipped ones are translated, a
 * type defined in the product shows the name it was given (its French name when
 * the interface is French).
 */
export function documentTypeName(documentType, lang, t) {
  const key = BUILT_IN_DOCUMENT_TYPE_LABEL_KEYS[documentType.code];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (lang === "fr") {
    return documentType.label_fr || documentType.label_en || documentType.code;
  }
  return documentType.label_en || documentType.label_fr || documentType.code;
}

/** Whether the Venture is expected to FILE something for this type. */
export function isUploadDocumentType(documentType) {
  return documentType.verification_method !== "external";
}
