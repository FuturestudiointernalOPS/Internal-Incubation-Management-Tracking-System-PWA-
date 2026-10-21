/**
 * VENTURE DATA ROOM — the document vocabulary.
 *
 * The Data Room is the venture's confidential document set for fundraising and
 * due diligence. This module holds the parts that are pure vocabulary — the
 * default categories, the review statuses, the stage-based requirement matrix
 * and the upload rules — so the server and every screen agree on one list and
 * one spelling. It deliberately imports nothing that reaches the database: the
 * client components fall back to it directly.
 *
 * It is NOT the Data bank (compliance verification): that has its own
 * configurable document types in `venture_document_types`. A Data Room category
 * is broader and describes "what the material is about", not "what must be
 * proven".
 */

/** The eleven categories the Data Room ships with, in display order. */
export const DATA_ROOM_CATEGORIES = [
  {
    code: "company_overview",
    labelKey: "dataRoom.category.companyOverview",
    label_en: "Company Overview",
    label_fr: "Présentation de l'entreprise",
    sort_order: 1,
  },
  {
    code: "legal_corporate",
    labelKey: "dataRoom.category.legalCorporate",
    label_en: "Legal & Corporate",
    label_fr: "Juridique et statutaire",
    sort_order: 2,
  },
  {
    code: "pitch_deck_business_plan",
    labelKey: "dataRoom.category.pitchDeckBusinessPlan",
    label_en: "Pitch Deck & Business Plan",
    label_fr: "Pitch deck et business plan",
    sort_order: 3,
  },
  {
    code: "financials_projections",
    labelKey: "dataRoom.category.financialsProjections",
    label_en: "Financials & Projections",
    label_fr: "Finances et prévisions",
    sort_order: 4,
  },
  {
    code: "market_traction",
    labelKey: "dataRoom.category.marketTraction",
    label_en: "Market & Traction",
    label_fr: "Marché et traction",
    sort_order: 5,
  },
  {
    code: "product_technology",
    labelKey: "dataRoom.category.productTechnology",
    label_en: "Product & Technology",
    label_fr: "Produit et technologie",
    sort_order: 6,
  },
  {
    code: "team",
    labelKey: "dataRoom.category.team",
    label_en: "Team",
    label_fr: "Équipe",
    sort_order: 7,
  },
  {
    code: "impact_sustainability",
    labelKey: "dataRoom.category.impactSustainability",
    label_en: "Impact & Sustainability",
    label_fr: "Impact et durabilité",
    sort_order: 8,
  },
  {
    code: "fundraising_cap_table",
    labelKey: "dataRoom.category.fundraisingCapTable",
    label_en: "Fundraising & Cap Table",
    label_fr: "Levée de fonds et table de capitalisation",
    sort_order: 9,
  },
  {
    code: "due_diligence",
    labelKey: "dataRoom.category.dueDiligence",
    label_en: "Due Diligence",
    label_fr: "Due diligence",
    sort_order: 10,
  },
  {
    code: "reports_milestones",
    labelKey: "dataRoom.category.reportsMilestones",
    label_en: "Reports & Milestones",
    label_fr: "Rapports et jalons",
    sort_order: 11,
  },
];

export const DATA_ROOM_CATEGORY_CODES = DATA_ROOM_CATEGORIES.map((category) => category.code);

export function isDataRoomCategory(code) {
  return DATA_ROOM_CATEGORY_CODES.includes(String(code || ""));
}

export function dataRoomCategory(code) {
  return DATA_ROOM_CATEGORIES.find((category) => category.code === code) || null;
}

/**
 * The life cycle of one document. `uploaded` is the entry state and is never
 * skipped: a document is verified by a reviewer, never by the act of uploading.
 *
 * `expired` is DERIVED on read when a recorded expiry date has passed; the
 * stored value stays whatever the reviewer last set so the history survives.
 */
export const DATA_ROOM_STATUSES = ["uploaded", "under_review", "verified", "rejected", "expired"];

/** Decisions a reviewer may record. `verified`/`rejected` are terminal enough
 *  that a new upload re-opens the document as `uploaded`. */
export const DATA_ROOM_REVIEW_DECISIONS = ["under_review", "verified", "rejected"];

export function isDataRoomStatus(status) {
  return DATA_ROOM_STATUSES.includes(String(status || ""));
}

export function isDataRoomReviewDecision(decision) {
  return DATA_ROOM_REVIEW_DECISIONS.includes(String(decision || ""));
}

/**
 * Requirement levels.
 *
 *   required       counts towards readiness; missing = outstanding
 *   recommended    shown as suggested, never counted as missing
 *   conditional    applies only when the venture says so; never counted
 *   not_applicable hidden from "missing" and not counted
 */
export const DATA_ROOM_REQUIREMENT_LEVELS = [
  "required",
  "recommended",
  "conditional",
  "not_applicable",
];

export function isDataRoomRequirementLevel(level) {
  return DATA_ROOM_REQUIREMENT_LEVELS.includes(String(level || ""));
}

/** Bucket a stored business stage into the three requirement profiles. */
export function requirementStageBucket(businessStage) {
  const stage = String(businessStage || "").toLowerCase();
  if (["validation", "mvp", "early_traction"].includes(stage)) return "early";
  if (["growth", "scale", "scaling"].includes(stage)) return "growth";
  return "idea";
}

/**
 * The starting matrix, deliberately conservative: an idea-stage venture is
 * never told a corporate registration or a cap table is mandatory. Staff can
 * change any cell (the change is stored per venture, see
 * `venture_data_room_requirements.customized`).
 */
const STAGE_MATRIX = {
  idea: {
    company_overview: "recommended",
    legal_corporate: "conditional",
    pitch_deck_business_plan: "recommended",
    financials_projections: "conditional",
    market_traction: "conditional",
    product_technology: "recommended",
    team: "recommended",
    impact_sustainability: "conditional",
    fundraising_cap_table: "conditional",
    due_diligence: "conditional",
    reports_milestones: "conditional",
  },
  early: {
    company_overview: "required",
    legal_corporate: "conditional",
    pitch_deck_business_plan: "required",
    financials_projections: "required",
    market_traction: "conditional",
    product_technology: "recommended",
    team: "recommended",
    impact_sustainability: "conditional",
    fundraising_cap_table: "conditional",
    due_diligence: "conditional",
    reports_milestones: "conditional",
  },
  growth: {
    company_overview: "required",
    legal_corporate: "conditional",
    pitch_deck_business_plan: "required",
    financials_projections: "required",
    market_traction: "required",
    product_technology: "recommended",
    team: "required",
    impact_sustainability: "conditional",
    fundraising_cap_table: "required",
    due_diligence: "conditional",
    reports_milestones: "conditional",
  },
};

/** The default level of one category at one business stage. */
export function defaultRequirementLevel(businessStage, category) {
  const bucket = requirementStageBucket(businessStage);
  return STAGE_MATRIX[bucket]?.[category] || "conditional";
}

/** Every category's default level for a stage, in display order. */
export function defaultRequirements(businessStage) {
  return DATA_ROOM_CATEGORIES.map((category) => ({
    category: category.code,
    level: defaultRequirementLevel(businessStage, category.code),
  }));
}

/**
 * Upload rules — kept next to the vocabulary so the API, the service and the
 * screen all refuse the same files with the same answer.
 *
 * The limit is configurable (`DATA_ROOM_MAX_FILE_MB`) but defaults to 10 MB,
 * which is the smallest cap that fits a real pitch deck or financial model.
 * Type checking reuses the platform's evidence allow-list (PDF, Office, PNG,
 * JPG) so the Data Room accepts exactly what the private bucket stores.
 */
export const DATA_ROOM_MAX_FILE_MB = Number(process.env.DATA_ROOM_MAX_FILE_MB || 10);
export const DATA_ROOM_MAX_FILE_BYTES = Math.max(1, DATA_ROOM_MAX_FILE_MB) * 1024 * 1024;

export const DATA_ROOM_FILE_ERROR = `Unsupported file. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, PNG, JPG.`;
export const DATA_ROOM_SIZE_ERROR = `File is too large. The maximum is ${DATA_ROOM_MAX_FILE_MB} MB.`;

/** External links are allowed as a fallback (a hosted deck, a shared folder). */
export function isDataRoomExternalLink(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

/** The sanitised folder a Venture's Data Room files live under. */
export function dataRoomStoragePrefix(ventureRef) {
  const scope = String(ventureRef || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return `data-room/${scope}/`;
}

/**
 * Whether a stored path was written for THIS Venture. The upload route builds
 * the prefix, the create/replace action checks it: a path filed under another
 * Venture can never be claimed by this one.
 */
export function isDataRoomStoragePathForVenture(path, ventureRef) {
  const value = String(path || "").replace(/^\/+/, "");
  return value.startsWith(dataRoomStoragePrefix(ventureRef));
}
