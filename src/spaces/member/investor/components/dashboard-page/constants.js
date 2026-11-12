/**
 * The pipeline stages, their colours/labels and the discovery filter options for
 * the investor dashboard.
 * Extracted verbatim from InvestorDashboard.
 */
export const PIPELINE_STAGES = [
  "interested", "watching", "meeting_requested",
  "due_diligence", "negotiation", "invested", "declined",
];

export const STAGE_COLORS = {
  interested: "bg-slate-500/10 text-slate-400",
  watching: "bg-blue-500/10 text-blue-400",
  meeting_requested: "bg-amber-500/10 text-amber-400",
  due_diligence: "bg-purple-500/10 text-purple-400",
  negotiation: "bg-orange-500/10 text-orange-400",
  invested: "bg-emerald-500/10 text-emerald-400",
  declined: "bg-rose-500/10 text-rose-400",
};

export const STAGE_LABELS = {
  interested: "interested",
  watching: "watching",
  meeting_requested: "meetingRequested",
  due_diligence: "dueDiligence",
  negotiation: "negotiation",
  invested: "invested",
  declined: "declined",
};

export const INDUSTRY_OPTIONS = ["FinTech","HealthTech","AgriTech","EdTech","CleanTech","Logistics","E-Commerce","SaaS","AI/ML","Renewable Energy"];
export const COUNTRY_OPTIONS = ["CD","KE","NG","ZA","GH","RW","UG","TZ","EG","MA"];
export const STAGE_OPTIONS = ["Pre-Seed","Seed","Series A","Series B","Growth"];
