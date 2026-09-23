"use client";

import AppSearchSelect from "./AppSearchSelect";
import { LANGUAGES } from "@/lib/languages";

/**
 * Standard language selector.
 * `value` is an ISO 639-1 language code (e.g. "en", "fr").
 */
export default function AppLanguageSelect({ value, onChange, ...props }) {
  const options = LANGUAGES.map((language) => ({
    value: language.code,
    label: language.native,
    search: `${language.en} ${language.fr} ${language.code}`,
  }));

  return <AppSearchSelect options={options} value={value} onChange={onChange} {...props} />;
}
