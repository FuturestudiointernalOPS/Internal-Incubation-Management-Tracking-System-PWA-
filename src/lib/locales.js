/**
 * Locale Loader
 *
 * Merges all JSON locale files for a given language into a single object.
 * Uses deep merge to support nested namespace keys (e.g. auth.login.title).
 *
 * English is the source of truth — all keys must exist in English JSON files.
 * Other languages are subsets — missing keys fall back to English.
 *
 * To add a new language:
 *   1. Create /locales/{code}/ directory
 *   2. Add JSON files matching the English structure (same filenames, same keys)
 *   3. Add the language code to SUPPORTED_LANGUAGES in i18n.js
 *   4. Done — missing keys auto-fallback to English
 */

"use client";

import enCommon from "@/locales/en/common.json";
import enAuth from "@/locales/en/auth.json";
import enNav from "@/locales/en/navigation.json";
import enAdmin from "@/locales/en/admin.json";
import enReports from "@/locales/en/reports.json";
import enStatus from "@/locales/en/status.json";
import enErrors from "@/locales/en/errors.json";
import enStaff from "@/locales/en/staff.json";
import enTeacher from "@/locales/en/teacher.json";
import enPm from "@/locales/en/pm.json";
import enParticipant from "@/locales/en/participant.json";

import frCommon from "@/locales/fr/common.json";
import frAuth from "@/locales/fr/auth.json";
import frNav from "@/locales/fr/navigation.json";
import frAdmin from "@/locales/fr/admin.json";
import frReports from "@/locales/fr/reports.json";
import frStatus from "@/locales/fr/status.json";
import frErrors from "@/locales/fr/errors.json";
import frStaff from "@/locales/fr/staff.json";
import frTeacher from "@/locales/fr/teacher.json";
import frPm from "@/locales/fr/pm.json";
import frParticipant from "@/locales/fr/participant.json";

// ─── Deep merge: recursively merges objects ───
function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Language registry: each language = deep-merged JSON modules ───
const EN = [
  enCommon,
  enAuth,
  enNav,
  enAdmin,
  enReports,
  enStatus,
  enErrors,
  enStaff,
  enTeacher,
  enPm,
  enParticipant,
].reduce((acc, mod) => deepMerge(acc, mod), {});

const FR = [
  frCommon,
  frAuth,
  frNav,
  frAdmin,
  frReports,
  frStatus,
  frErrors,
  frStaff,
  frTeacher,
  frPm,
  frParticipant,
].reduce((acc, mod) => deepMerge(acc, mod), {});

export const LOCALE_REGISTRY = {
  en: EN,
  fr: FR,
};

export { deepMerge };
