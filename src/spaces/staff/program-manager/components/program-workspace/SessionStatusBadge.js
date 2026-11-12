import { Users, Clock, Calendar, FileText, Plus, Shield, Trash2, Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SessionStatusBadge({ session, t }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let displayStatus = session.status;
  let statusColor = "bg-amber-500";

  if (session.status === "locked") {
    displayStatus = "locked";
    statusColor = "bg-rose-500";
  } else if (session.scheduled_date) {
    const scheduledDate = new Date(session.scheduled_date);
    const scheduledDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
    if (session.status === "completed") {
      displayStatus = "completed";
      statusColor = "bg-emerald-500";
    } else if (scheduledDay <= today && session.status !== "not started") {
      displayStatus = "active";
      statusColor = "bg-indigo-500";
    } else if (session.status === "not started") {
      displayStatus = "not started";
      statusColor = "bg-slate-500";
    } else {
      displayStatus = "pending";
      statusColor = "bg-amber-500";
    }
  } else {
    if (session.status === "completed") {
      displayStatus = "completed";
      statusColor = "bg-emerald-500";
    } else if (session.status === "in progress" || session.status === "active") {
      displayStatus = "active";
      statusColor = "bg-indigo-500";
    } else {
      displayStatus = "pending";
      statusColor = "bg-amber-500";
    }
  }

  return (
    <>
      <span className={`w-2 h-2 rounded-full animate-pulse ${statusColor}`} />
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
        {t("pmMisc.workspace.state")}:{" "}
        {{
          locked: t("pmMisc.workspace.sessionStatusLocked"),
          completed: t("pmMisc.workspace.sessionStatusCompleted"),
          active: t("pmMisc.workspace.sessionStatusActive"),
          "not started": t("pmMisc.workspace.sessionStatusNotStarted"),
          pending: t("pmMisc.workspace.sessionStatusPending"),
        }[displayStatus] || displayStatus}
      </span>
    </>
  );
}