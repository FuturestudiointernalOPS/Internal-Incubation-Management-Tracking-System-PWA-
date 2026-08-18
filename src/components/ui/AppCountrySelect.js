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
      getCountryOptions().map((c) => ({
        value: c.iso,
        label: locale === "fr" ? c.nameFr : c.nameEn,
        search: `${c.nameEn} ${c.nameFr} ${c.iso} ${c.dial}`,
        flag: c.flag,
      })),
    [locale],
  );

  return <AppSearchSelect options={options} value={value} onChange={onChange} {...props} />;
}
