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

// The discovery filters use the SAME enumerations as the application form and
// the investor profile (src/lib/investorOptions.js) — one list, 13 countries.
export {
  INVESTOR_INDUSTRIES as INDUSTRY_OPTIONS,
  INVESTOR_COUNTRIES as COUNTRY_OPTIONS,
  INVESTOR_STAGES as STAGE_OPTIONS,
} from "@/lib/investorOptions";
