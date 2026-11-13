/**
 * The pipeline stages, their labels and the shared tag tones they wear, plus the
 * discovery filter options for the investor workspace.
 */
export const PIPELINE_STAGES = [
  "interested", "watching", "meeting_requested",
  "due_diligence", "negotiation", "invested", "declined",
];

export const STAGE_LABELS = {
  interested: "interested",
  watching: "watching",
  meeting_requested: "meetingRequested",
  due_diligence: "dueDiligence",
  negotiation: "negotiation",
  invested: "invested",
  declined: "declined",
};

/**
 * The shared tag tones each stage wears (see the `stf-tag` variants). The tone
 * carries the meaning — neutral, info, watch, accent, good, critical — instead
 * of a bespoke colour per stage.
 */
export const STAGE_TONES = {
  interested: "",
  watching: "b",
  meeting_requested: "w",
  due_diligence: "o",
  negotiation: "o",
  invested: "g",
  declined: "r",
};

export const INDUSTRY_OPTIONS = ["FinTech","HealthTech","AgriTech","EdTech","CleanTech","Logistics","E-Commerce","SaaS","AI/ML","Renewable Energy"];
export const COUNTRY_OPTIONS = ["CD","KE","NG","ZA","GH","RW","UG","TZ","EG","MA"];
export const STAGE_OPTIONS = ["Pre-Seed","Seed","Series A","Series B","Growth"];
