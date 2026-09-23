"use client";

import { useMemo } from "react";
import AppSearchSelect from "./AppSearchSelect";
import { getCountryOptions } from "@/lib/countries";

/**
 * Standard country selector.
 * `value` is an ISO 3166-1 alpha-2 code (e.g. "BJ", "NG", "FR").
 */
export default function AppCountrySelect({ value, onChange, locale = "en", ...props }) {
  const options = useMemo(
    () =>
      getCountryOptions().map((country) => ({
        value: country.iso,
        label: locale === "fr" ? country.nameFr : country.nameEn,
        search: `${country.nameEn} ${country.nameFr} ${country.iso} ${country.dial}`,
        flag: country.flag,
      })),
    [locale],
  );

  return <AppSearchSelect options={options} value={value} onChange={onChange} {...props} />;
}
