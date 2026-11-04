import { Activity } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";

export default function SummaryTimelineCard({
  lang,
  summaryBlockers,
  summaryTasks,
}) {
  const { t } = useI18n();

  const timeline = {};
  summaryTasks.forEach((task) => {
    const day = task.created_at?.split("T")[0];
    if (!day) return;
    if (!timeline[day])
      timeline[day] = {
        created: 0,
        completed: 0,
        blockerAdded: 0,
        blockerResolved: 0,
      };
    timeline[day].created++;
    if (task.status === "completed") timeline[day].completed++;
  });
  summaryBlockers.forEach((blocker) => {
    const day = blocker.created_at?.split("T")[0];
    if (!day) return;
    if (!timeline[day])
      timeline[day] = {
        created: 0,
        completed: 0,
        blockerAdded: 0,
        blockerResolved: 0,
      };
    timeline[day].blockerAdded = (timeline[day].blockerAdded || 0) + 1;
    if (blocker.status === "resolved" && blocker.resolved_at) {
      const resolvedDay = blocker.resolved_at?.split("T")[0];
      if (resolvedDay) {
        if (!timeline[resolvedDay])
          timeline[resolvedDay] = {
            created: 0,
            completed: 0,
            blockerAdded: 0,
            blockerResolved: 0,
          };
        timeline[resolvedDay].blockerResolved =
          (timeline[resolvedDay].blockerResolved || 0) + 1;
      }
    }
  });
  const sortedDays = Object.keys(timeline).sort();
  if (sortedDays.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("staff.section.weeklyActivityTimeline")}
      </h3>
      <div className="space-y-3">
        {sortedDays.map((day) => {
          const dayStats = timeline[day];
          const events = [];
          if (dayStats.created > 0)
            events.push(
              t("staff.opReport.tasksCreated", {
                count: dayStats.created,
              }),
            );
          if (dayStats.completed > 0)
            events.push(
              t("staff.opReport.tasksCompleted", {
                count: dayStats.completed,
              }),
            );
          if (dayStats.blockerAdded > 0)
            events.push(
              t("staff.opReport.blockersAdded", {
                count: dayStats.blockerAdded,
              }),
            );
          if (dayStats.blockerResolved > 0)
            events.push(
              t("staff.opReport.blockersResolved", {
                count: dayStats.blockerResolved,
              }),
            );
          const dayLabel = formatLocaleDate(
            day + "T00:00:00",
            { weekday: "long", month: "long", day: "numeric" },
            lang,
          );
          return (
            <div key={day} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] mt-1.5 shrink-0" />
              <div>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {dayLabel}
                </p>
                {events.map((event, index) => (
                  <p
                    key={index}
                    className="text-xs font-bold text-[var(--text-primary)]"
                  >
                    {event}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
