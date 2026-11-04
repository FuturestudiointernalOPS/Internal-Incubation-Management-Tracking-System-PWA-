"use client";

import { Search, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG } from "./statusConfig";

/**
 * The search box, the score/status/ranking/field filters and the
 * "showing N of M respondents" line.
 * Extracted verbatim from ScoresPage.
 */
export default function ScoresFilters({
  search,
  onSearchChange,
  scoreOp,
  onScoreOpChange,
  scoreVal,
  onScoreValChange,
  scoreVal2,
  onScoreVal2Change,
  statusFilter,
  onStatusFilterChange,
  rankingFilter,
  onRankingFilterChange,
  fieldFilters,
  onFieldFilterChange,
  hasActiveFilters,
  onClearFilters,
  data,
  filteredCount,
}) {
  const { t } = useI18n();
  return (
    <div className="card p-4 space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search respondents (name, email, answers)..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          <Filter className="w-3 h-3" /> Filters
        </span>

        {/* Score filter with numeric operators */}
        <div className="flex items-center gap-1.5">
          <select
            value={scoreOp}
            onChange={(event) => onScoreOpChange(event.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">Score: All</option>
            <option value="gte">Score ≥</option>
            <option value="gt">Score &gt;</option>
            <option value="eq">Score =</option>
            <option value="lte">Score ≤</option>
            <option value="lt">Score &lt;</option>
            <option value="between">Score Between</option>
          </select>
          {scoreOp && (
            <>
              <input
                type="number"
                min="0"
                max="100"
                value={scoreVal}
                onChange={(event) => onScoreValChange(event.target.value)}
                placeholder="80"
                className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              {scoreOp === "between" && (
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreVal2}
                  onChange={(event) => onScoreVal2Change(event.target.value)}
                  placeholder="90"
                  className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              )}
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">%</span>
            </>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
        >
          <option value="">Status: All</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              Status: {t(config.label)}
            </option>
          ))}
        </select>

        {/* Ranking filter (actual values in the dataset) */}
        {(data.rankings || []).length > 0 && (
          <select
            value={rankingFilter}
            onChange={(event) => onRankingFilterChange(event.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">Result: All</option>
            {data.rankings.map((ranking) => (
              <option key={ranking} value={ranking}>
                Result: {ranking}
              </option>
            ))}
          </select>
        )}

        {/* Dynamic field filters — from the form's actual columns */}
        {(data.filterable_fields || []).map((field) => (
          <select
            key={field.label}
            value={fieldFilters[field.label] || ""}
            onChange={(event) => onFieldFilterChange(field.label, event.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">{field.label}: All</option>
            {field.options.map((option, optionIndex) => (
              <option key={`${field.label}-${optionIndex}`} value={String(option)}>
                {field.label}: {String(option)}
              </option>
            ))}
          </select>
        ))}

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-2.5 py-2 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20"
          >
            Clear all
          </button>
        )}
      </div>

      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
        {data.run?.name ? (
          <>{t("adminMisc.platformScores.runLabel")}: <span className="text-[var(--brand-orange)] font-bold">{data.run.name}</span> · </>
        ) : null}
        Showing {filteredCount} of {data.respondents?.length || 0} respondents
      </p>
    </div>
  );
}
