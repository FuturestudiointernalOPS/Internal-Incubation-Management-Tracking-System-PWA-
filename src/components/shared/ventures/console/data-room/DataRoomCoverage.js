"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { dataRoomCategory } from "@/lib/dataRoom";

/**
 * The Data Room, as a checklist rather than a dashboard.
 *
 *   one progress line        → percentage, required count, missing count, one bar
 *   "Still to provide"       → the required categories with nothing filed
 *   one hairline table       → Document · Level · Status · Files, grouped by folder
 *
 * Status is a DOT plus a word, coloured only where someone must act: that is the
 * whole reason the table reads at a glance. Every figure comes from the server's
 * `completeness` block; nothing is recomputed here. Clicking a row filters the
 * document list to that category.
 */
export const DUE_DILIGENCE_FOLDERS = [
  {
    key: "pitch",
    categories: ["pitch_deck", "company_overview", "market_traction"],
  },
  {
    key: "financials",
    categories: ["financials_projections", "fundraising_cap_table"],
  },
  {
    key: "legal",
    categories: ["legal_corporate"],
  },
  {
    key: "product",
    categories: ["product_technology", "impact_sustainability", "reports_milestones"],
  },
];

// Colour only when the state asks for something. Verified is quiet on purpose.
const STATUS_DOT = {
  verified: "bg-emerald-500",
  under_review: "bg-amber-500",
  uploaded: "bg-amber-500",
  rejected: "bg-rose-500",
  expired: "bg-rose-500",
  missing: "bg-slate-400",
};

const STATUS_TONE = {
  rejected: "text-rose-400",
  missing: "text-[var(--text-secondary)]",
};

export default function DataRoomCoverage({
  completeness = null,
  requirements = [],
  canReview = false,
  onChange,
  onSelectCategory,
  selectedCategory = "all",
}) {
  const { t } = useI18n();

  const rows =
    completeness?.requirements ||
    requirements.map((row) => ({ ...row, status: "missing", documents_count: 0 }));

  const percent = completeness?.readiness_percent ?? null;
  const requiredTotal = completeness?.required_total ?? 0;
  const missingRows = rows.filter((row) => row.level === "required" && row.status === "missing");

  const groups = DUE_DILIGENCE_FOLDERS.map((folder) => ({
    folder,
    rows: rows.filter((row) => folder.categories.includes(row.category)),
  })).filter((group) => group.rows.length > 0);

  const label = (code) => {
    const entry = dataRoomCategory(code);
    return entry ? t(entry.labelKey) : code;
  };

  const statusLabel = (status) =>
    status === "missing" ? t("dataRoom.coverage.missing") : t(`dataRoom.status.${status}`);

  return (
    <div className="space-y-4">
      {/* ── One progress line, not four boxes ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-2xl font-black text-[var(--text-primary)]">
            {percent == null ? "—" : `${percent}%`}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {percent == null
              ? t("dataRoom.completeness.notRequired")
              : t("dataRoom.completeness.percent", { percent })}
            {" · "}
            {t("dataRoom.standard.required", { count: requiredTotal })}
            {" · "}
            {t("dataRoom.standard.missing", { count: missingRows.length })}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
            style={{ width: `${percent || 0}%` }}
          />
        </div>
      </div>

      {/* ── What is left, named — only when something is ── */}
      {missingRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
            {t("dataRoom.standard.stillToProvide")} ({missingRows.length})
          </span>
          {missingRows.map((row, index) => (
            <span key={row.category} className="text-[12px] text-[var(--text-secondary)]">
              {index > 0 ? <span className="mr-2 opacity-50">·</span> : null}
              <button
                type="button"
                onClick={() => onSelectCategory?.(row.category)}
                className="hover:text-[var(--text-primary)]"
              >
                {label(row.category)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── One table: hairline rows, no boxes, status as dot + word ── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              {[
                t("dataRoom.standard.document"),
                t("dataRoom.standard.level"),
                t("dataRoom.standard.status"),
                t("dataRoom.standard.files"),
              ].map((heading, index) => (
                <th
                  key={heading}
                  className={`py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ${
                    index === 3 ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ folder, rows: folderRows }) => (
              <React.Fragment key={folder.key}>
                <tr>
                  <td
                    colSpan={4}
                    className="pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]"
                  >
                    {t(`dataRoom.folders.${folder.key}.title`)}
                  </td>
                </tr>
                {folderRows.map((row) => {
                  const selected = selectedCategory === row.category;
                  return (
                    <tr
                      key={row.category}
                      onClick={() => onSelectCategory?.(row.category)}
                      className={`cursor-pointer border-b border-[var(--border-primary)] transition-colors ${
                        selected ? "bg-[var(--brand-orange)]/5" : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <td className="py-2.5 pr-4 text-[13px] text-[var(--text-primary)]">
                        {label(row.category)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {canReview ? (
                          <select
                            value={row.level}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onChange?.(row.category, event.target.value)}
                            aria-label={t("dataRoom.requirements.title")}
                            className="rounded-md border border-[var(--border-primary)] bg-transparent px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)] outline-none"
                          >
                            {["required", "recommended", "conditional", "not_applicable"].map((level) => (
                              <option key={level} value={level}>{t(`dataRoom.level.${level}`)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[12px] text-[var(--text-secondary)]">
                            {t(`dataRoom.level.${row.level}`)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[row.status] || "bg-slate-400"}`}
                          />
                          <span className={`text-[12px] ${STATUS_TONE[row.status] || "text-[var(--text-secondary)]"}`}>
                            {statusLabel(row.status)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[12px] tabular-nums text-[var(--text-secondary)]">
                        {row.documents_count || 0}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
