// The Venture detail screen's module-scope constants and pure answer shapers.
//
// These are the pieces the screen used to declare inline: the tab vocabulary,
// the venture → profile-form shaping, and one answer shaper per read. They hold
// no state and read nothing themselves, so they live here and the screen imports
// them, keeping the screen's body about state and orchestration only.

export const TABS = [
  "dashboard", "journey", "investment", "verification",
  "profile", "team",
];

// Secondary Venture tools that live inside Journey. They stay reachable from
// the Journey page while milestone workspaces bind their content to the items;
// they are NOT top-level workspace navigation.
export const JOURNEY_TOOLS = [
  "businessModel", "discovery", "validation", "pmf", "documents",
];

// The venture record, and the profile form it fills in. The form is the shape
// the Venture's stored values take in the profile editor; it is built at module
// scope because it is a pure shaping of the answer.
export const pickVenture = (payload) => (payload?.success ? payload.venture : null);

export const ventureToForm = (venture) => ({
  name: venture.name || "",
  description: venture.description || "",
  mission: venture.mission || "",
  vision: venture.vision || "",
  industry: venture.industry || "",
  sector: venture.sector || "",
  business_stage: venture.business_stage || "idea",
  website: venture.website || "",
  twitter: venture.social_media?.twitter || "",
  linkedin: venture.social_media?.linkedin || "",
  instagram: venture.social_media?.instagram || "",
  facebook: venture.social_media?.facebook || "",
  status: venture.status || "active",
  visibility: venture.visibility || "private",
  language: venture.language || "en",
  brandColor: venture.branding?.color || "#f60",
  country_code: venture.country_code || "",
});

// ── The answer shapers for this screen's reads ─────────────────────────────
// One per read, built ONCE here: a shaper written inline is a new function on
// every render, which is the foot-gun the hook mirrors rather than depends on,
// and building it at module scope is the clearer habit besides.
//
// A shaper reports the EMPTY value on a refusal, not on a success that happens
// to be missing its field: a read that failed must not leave the previous
// screenful standing as though it were still the answer.
const pickList = (key) => (payload) => (payload?.success ? payload[key] || [] : []);
const pickThing = (key) => (payload) => (payload?.success ? payload[key] : null);

export const pickMembers = pickList("members");
export const pickInvitations = pickList("invitations");
export const pickDashboard = pickThing("dashboard");
export const pickBm = pickThing("business_model");
export const pickInterviews = pickList("interviews");
export const pickValidations = pickList("validations");
export const pickAssessments = pickList("assessments");
export const pickMilestones = pickList("milestones");
export const pickCalendar = pickList("events");
export const pickProgress = pickThing("progress");
export const pickDocuments = pickList("documents");
// The roadmap read also reports whether the deliverable (evidence) list could be
// loaded. A failure there used to render as an empty roadmap, which is
// indistinguishable from "this Venture has no evidence" — so the flag travels
// with the stages and the journey tab says so instead of showing nothing.
export const EMPTY_ROADMAP = { stages: [], deliverablesUnavailable: false };
export const pickJourney = (payload) =>
  payload?.success
    ? { stages: payload.stages || [], deliverablesUnavailable: Boolean(payload.deliverables_unavailable) }
    : EMPTY_ROADMAP;
export const pickInvestmentReadiness = (payload) =>
  payload?.success
    ? { ...payload.investment_readiness, roadmap_readiness: payload.roadmap_readiness }
    : null;
export const pickOptionLists = (payload) => {
  if (!payload?.success) return {};
  const byType = {};
  for (const option of payload.options || []) {
    (byType[option.option_type] = byType[option.option_type] || []).push(option.value);
  }
  return byType;
};
