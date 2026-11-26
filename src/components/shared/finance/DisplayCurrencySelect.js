"use client";

import { useI18n } from "@/lib/i18n";
import { STANDARD_CURRENCIES } from "@/lib/currencies";

/**
 * DISPLAY CURRENCY SELECT — presentational.
 *
 * The owner of the preference is the screen that uses it (through
 * `useDisplayCurrency`), so one page cannot end up with two divergent copies.
 *
 * "Follow venture" is the default and means NO conversion: every figure shows in
 * the unit it was filed in.
 */
export default function DisplayCurrencySelect({
  value = null,
  onChange,
  ventureCurrency = "XOF",
  disabled = false,
  className = "",
}) {
  const { t } = useI18n();

  return (
    <label className={`inline-flex items-center gap-2 text-[11px] ${className}`} style={{ color: "var(--text-secondary)" }}>
      <span className="font-bold uppercase tracking-wider">{t("finance.displayCurrency.label")}</span>
      <select
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value || null)}
        className="rounded-lg border px-2 py-1 text-[11px] font-semibold outline-none"
        style={{
          background: "var(--surface-1)",
          borderColor: "var(--border-primary)",
          color: "var(--text-primary)",
        }}
      >
        <option value="">
          {t("finance.displayCurrency.follow", {
            currency: String(ventureCurrency || "XOF").toUpperCase(),
          })}
        </option>
        {STANDARD_CURRENCIES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.code} — {entry.label}
          </option>
        ))}
      </select>
    </label>
  );
}
