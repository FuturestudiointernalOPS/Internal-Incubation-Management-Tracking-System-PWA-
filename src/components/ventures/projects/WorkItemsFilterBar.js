"use client";

import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The work-items filter bar.
 *
 * Search and Status are always on the bar; Owner, Supporting, Journey and
 * Milestone live behind one toggle, so the list is not preceded by a wall of
 * dropdowns. Every option is drawn from the loaded work — nothing is hardcoded
 * here, and this block holds no state: the view owns the filter values and this
 * only lays them out.
 */
const selectOptions = (values, anyLabel, anyValue) => [
  { value: anyValue, label: anyLabel },
  ...values.map((value) => ({ value, label: value })),
];

export default function WorkItemsFilterBar({
  ANY,
  advancedFilterCount = 0,
  clearFilters,
  filtersOpen,
  hasFilters,
  journey,
  journeys = [],
  milestone,
  milestones = [],
  owner,
  owners = [],
  search,
  setFiltersOpen,
  setJourney,
  setMilestone,
  setOwner,
  setSearch,
  setStatus,
  setSupporting,
  status,
  statuses = [],
  supporting,
  supportingOptions = [],
  tv,
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="stf-bar" style={{ marginBottom: 10 }}>
        <input
          className="stf-input"
          style={{ flex: "2 1 200px" }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("venture.projects.searchPlaceholder")}
          aria-label={t("common.search")}
        />
        <select
          className="stf-input"
          style={{ flex: "1 1 120px" }}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t("venture.projects.status")}
          title={t("venture.projects.status")}
        >
          <option value={ANY}>{t("venture.projects.status")}</option>
          {statuses.map((entry) => (
            <option key={entry.id} value={entry.id}>{t(entry.key)}</option>
          ))}
        </select>
        <button
          type="button"
          className={`stf-btn sm${filtersOpen ? " pr" : ""}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={13} />
          {t("venture.projects.filters")}
          {advancedFilterCount > 0 && <span className="stf-tag o">{advancedFilterCount}</span>}
        </button>
        {hasFilters && (
          <button type="button" className="stf-link-btn" style={{ flex: "none" }} onClick={clearFilters}>
            {t("venture.projects.clearFilters")}
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="stf-bar" style={{ marginBottom: 10 }}>
          <select
            className="stf-input"
            style={{ flex: "1 1 130px" }}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            aria-label={t("venture.manager.milestoneOwner")}
            title={t("venture.manager.milestoneOwner")}
          >
            {selectOptions(owners, t("venture.manager.milestoneOwner"), ANY).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className="stf-input"
            style={{ flex: "1 1 130px" }}
            value={supporting}
            onChange={(event) => setSupporting(event.target.value)}
            aria-label={t("venture.manager.supporting")}
            title={t("venture.manager.supporting")}
          >
            {selectOptions(supportingOptions, t("venture.manager.supporting"), ANY).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className="stf-input"
            style={{ flex: "1 1 140px" }}
            value={journey}
            onChange={(event) => setJourney(event.target.value)}
            aria-label={t("venture.projects.journey")}
            title={t("venture.projects.journey")}
          >
            <option value={ANY}>{t("venture.projects.journey")}</option>
            {journeys.map((entry) => (
              <option key={entry.id} value={String(entry.id)}>{tv(entry.name)}</option>
            ))}
          </select>
          <select
            className="stf-input"
            style={{ flex: "1 1 140px" }}
            value={milestone}
            onChange={(event) => setMilestone(event.target.value)}
            aria-label={t("venture.projects.milestone")}
            title={t("venture.projects.milestone")}
          >
            <option value={ANY}>{t("venture.projects.milestone")}</option>
            {milestones.map((entry) => (
              <option key={entry.id} value={String(entry.id)}>{tv(entry.title)}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
