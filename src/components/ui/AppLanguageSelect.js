"use client";

import AppSearchSelect from "./AppSearchSelect";
import { LANGUAGES } from "@/lib/languages";

/**
 * Standard language selector.
 * `value` is an ISO 639-1 language code (e.g. "en", "fr").
 */
export default function AppLanguageSelect({ value, onChange, ...props }) {
  const options = LANGUAGES.map((l) => ({
    value: l.code,
    label: l.native,
    search: `${l.en} ${l.fr} ${l.code}`,
  }));

  return <AppSearchSelect options={options} value={value} onChange={onChange} {...props} />;
}
