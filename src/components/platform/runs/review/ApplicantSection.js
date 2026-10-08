"use client";

import { User } from "lucide-react";
import { formatLocaleDate } from "@/lib/constants";

export default function ApplicantSection({
  submission,
  run,
  sectionsWithFields,
  fields,
  getFieldValue,
  formatValue,
  lang,
  t,
}) {
  return (
    <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <User className="w-5 h-5 text-[var(--brand-orange)]" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">
            {(() => {
              const firstSec = sectionsWithFields[0];
              // Find personal name field: contains "name" but not "startup"/"business"/"company"/"project"/"team"
              const nameField = firstSec?.fields.find(field => {
                const label = (field.label || "").toLowerCase();
                return label.includes("name") && !label.includes("startup") && !label.includes("business") && !label.includes("company") && !label.includes("project") && !label.includes("team") && !label.includes("brand");
              });
              const nameVal = nameField ? formatValue(getFieldValue(nameField)) : submission?.submitter_name;
              return nameVal || t("platformMisc.runReview.applicant");
            })()}
          </h2>
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {submission?.submitted_at ? t("platformMisc.runReview.submittedOn", { date: formatLocaleDate(submission.submitted_at, { weekday: "short", month: "short", day: "numeric", year: "numeric" }, lang) }) : t("platformMisc.runReview.submissionLabel")}
            {run?.name ? ` · ${run.name}` : ""}
          </p>
        </div>
      </div>
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Quick stats from first section fields */}
        {(() => {
          const firstSec = sectionsWithFields[0];
          const items = firstSec ? firstSec.fields.slice(0, 4) : fields.slice(0, 4);
          return items.map(field => {
            const value = formatValue(getFieldValue(field));
            if (!value) return null;
            return (
              <div key={field.id}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{field.label}</p>
                <p className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">{value}</p>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
