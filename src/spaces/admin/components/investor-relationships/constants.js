import { Users, ArrowRight, Target, FileText, Building2, CheckCircle2 } from "lucide-react";

/**
 * The meeting types and their icons for the admin relationships screen.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export const MEETING_TYPES = [
  { value: "introductory", label: "investorAdmin.relationships.meetingIntroductory" },
  { value: "follow_up", label: "investorAdmin.relationships.meetingFollowUp" },
  { value: "product_demo", label: "investorAdmin.relationships.meetingProductDemo" },
  { value: "financial_review", label: "investorAdmin.relationships.meetingFinancialReview" },
  { value: "dd_session", label: "investorAdmin.relationships.meetingDdSession" },
  { value: "committee", label: "investorAdmin.relationships.meetingCommittee" },
  { value: "closing", label: "investorAdmin.relationships.meetingClosing" },
];

export const MEETING_ICONS = {
  introductory: Users,
  follow_up: ArrowRight,
  product_demo: Target,
  financial_review: FileText,
  dd_session: FileText,
  committee: Building2,
  closing: CheckCircle2,
};
