"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { countryFlag } from "@/lib/countries";
import { getCountries } from "@/lib/profile-options";

/**
 * A single-choice country dropdown.
 *
 * The list is local and complete (ISO alpha-2 codes), and the names are
 * generated in the active language, so no network call and no duplicated
 * country catalogue are needed. The stored value is the stable code.
 *
 * A value that is not a known code (an older free-text answer, or an imported
 * name) is kept as its own option instead of being silently dropped.
 */
export default function AppCountrySelect({
  value = "",
  onChange,
  disabled = false,
  required = false,
  className = "",
  placeholder,
  id,
  name,
}) {
  const { t, lang } = useI18n();
  const countries = useMemo(() => getCountries(lang), [lang]);
  const isKnownCode = countries.some((country) => country.value === value);

  return (
    <select
      id={id}
      name={name}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      required={required}
      className={className}
    >
      <option value="">{placeholder || t("common.selectCountry")}</option>
      {value && !isKnownCode && <option value={value}>{value}</option>}
      {countries.map((country) => (
        <option key={country.value} value={country.value}>
          {countryFlag(country.value)} {country.label}
        </option>
      ))}
    </select>
  );
}
