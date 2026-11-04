"use client";

import { useI18n } from "@/lib/i18n";
import { INDUSTRY_OPTIONS, COUNTRY_OPTIONS, STAGE_OPTIONS } from "./constants";

/**
 * The advanced discovery filters panel (industry, country, stage, funding range).
 * Extracted verbatim from InvestorDashboard.
 */
export default function VentureFilters({
  filterIndustry,
  filterCountry,
  filterStage,
  filterFundingMin,
  filterFundingMax,
  onToggleIndustry,
  onToggleCountry,
  onToggleStage,
  onFundingMinChange,
  onFundingMaxChange,
  onClear,
}) {
  const { t } = useI18n();
  return (
    <div className="p-4 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("industry")}</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {INDUSTRY_OPTIONS.map(industryOption => (
            <button key={industryOption} onClick={() => onToggleIndustry(industryOption)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                filterIndustry.includes(industryOption) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>{industryOption}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("country")}</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {COUNTRY_OPTIONS.map(countryOption => (
            <button key={countryOption} onClick={() => onToggleCountry(countryOption)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                filterCountry.includes(countryOption) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>{countryOption}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("stage")}</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {STAGE_OPTIONS.map(stageOption => (
            <button key={stageOption} onClick={() => onToggleStage(stageOption)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                filterStage.includes(stageOption) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>{stageOption}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("fundingRange")}</label>
        <div className="flex gap-1 mt-1.5">
          <input value={filterFundingMin} onChange={event => onFundingMinChange(event.target.value)}
            type="number" placeholder="Min"
            className="w-full px-2 py-2 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
          <input value={filterFundingMax} onChange={event => onFundingMaxChange(event.target.value)}
            type="number" placeholder="Max"
            className="w-full px-2 py-2 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
        </div>
      </div>
      {(filterIndustry.length > 0 || filterCountry.length > 0 || filterStage.length > 0 || filterFundingMin || filterFundingMax) && (
        <button onClick={onClear}
          className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
          {t("clearFilters")}
        </button>
      )}
    </div>
  );
}
