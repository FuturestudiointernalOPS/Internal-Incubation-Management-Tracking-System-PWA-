import { Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MONTHS } from "./constants";

export default function MonthlyBreakdown({ reports }) {
  const { t } = useI18n();
  // Group reports by month+year
  const groups = {};
  reports.forEach((report) => {
    const createdDate = new Date(report.created_at);
    const key = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[createdDate.getMonth()]} ${createdDate.getFullYear()}`;
    if (!groups[key])
      groups[key] = {
        label,
        key,
        standups: 0,
        retros: 0,
        users: new Set(),
        reports: [],
      };
    if (report.report_type === "standup") groups[key].standups++;
    else groups[key].retros++;
    groups[key].users.add(report.user_name);
    groups[key].reports.push(report);
  });

  const sorted = Object.values(groups).sort((groupA, groupB) =>
    groupB.key.localeCompare(groupA.key),
  );

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
        {t("reports.monthlyActivity")}
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {sorted.map((group) => (
          <div key={group.key} className="card border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[var(--brand-orange)]" />
                <h4 className="text-lg font-black uppercase tracking-tight">
                  {group.label}
                </h4>
              </div>
              <div className="flex gap-3 text-[10px] font-medium text-[var(--text-secondary)]">
                <span>
                  {group.standups} {t("reports.standups")}
                </span>
                <span>
                  {group.retros} {t("reports.retros")}
                </span>
                <span>
                  {group.users.size} {t("reports.members")}
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-primary rounded-full overflow-hidden flex">
              <div
                className="h-full bg-[var(--brand-orange)] transition-all"
                style={{
                  width: `${(group.standups / (group.standups + group.retros || 1)) * 100}%`,
                }}
              />
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${(group.retros / (group.standups + group.retros || 1)) * 100}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />{" "}
              {t("reports.standups")}
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-3" />{" "}
              {t("reports.retros")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
