import {
  Users,
  Activity,
  CheckCircle2,
  FileText,
  MessageCircle,
  Shield,
  LayoutDashboard,
  BarChart3,
  UserPlus,
} from "lucide-react";

/**
 * The workspace tab bar's definition: the label and icon of every tab, plus the
 * optional role gate. Kept beside the view so the screen only composes; the
 * names are exactly the ones the bar has always rendered.
 */
export function buildProgramTabs(t) {
  return [
    {
      id: "overview",
      name: t("pmMisc.workspace.tabOverview"),
      icon: LayoutDashboard,
    },
    {
      id: "config",
      name: t("pmMisc.workspace.tabConfiguration"),
      icon: Shield,
      roles: ["super_admin", "program_manager"],
    },
    {
      id: "curriculum",
      name: t("pmMisc.workspace.tabCurriculum"),
      icon: FileText,
    },
    {
      id: "attendance",
      name: t("pmMisc.workspace.tabAttendance"),
      icon: CheckCircle2,
    },
    {
      id: "reports",
      name: t("pmMisc.workspace.tabReports"),
      icon: BarChart3,
      roles: ["super_admin", "program_manager", "staff"],
    },
    {
      id: "reviews",
      name: t("pmMisc.workspace.tabReviews"),
      icon: MessageCircle,
      roles: ["super_admin", "program_manager", "staff"],
    },
    {
      id: "participants",
      name: t("pmMisc.workspace.tabParticipants"),
      icon: Users,
    },
    {
      id: "submissions",
      name: t("pmMisc.workspace.tabSubmissions"),
      icon: Activity,
    },
    {
      id: "facilitators",
      name: t("pmMisc.workspace.tabFacilitators"),
      icon: UserPlus,
      roles: ["super_admin", "program_manager", "staff"],
    },
  ];
}
