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
import enPm from "@/locales/en/pm.json";
import enParticipant from "@/locales/en/participant.json";
import enTime from "@/locales/en/time.json";
import enFinance from "@/locales/en/finance.json";
import enMessaging from "@/locales/en/messaging.json";
import enVenture from "@/locales/en/venture.json";
import enInvestor from "@/locales/en/investor.json";
import enForms from "@/locales/en/forms.json";
import enCrm from "@/locales/en/crm.json";
import enVadmin from "@/locales/en/vadmin.json";
import enEngineering from "@/locales/en/engineering.json";
import enAuthorization from "@/locales/en/authorization.json";
import enInvestorAdmin from "@/locales/en/investorAdmin.json";
import enAdminMisc from "@/locales/en/adminMisc.json";
import enTeam from "@/locales/en/team.json";
import enPlatformMisc from "@/locales/en/platformMisc.json";
import enPmMisc from "@/locales/en/pmMisc.json";
import enInvestorMisc from "@/locales/en/investorMisc.json";
import enParticipantMisc from "@/locales/en/participantMisc.json";
import enStaffMisc from "@/locales/en/staffMisc.json";
import enRootMisc from "@/locales/en/rootMisc.json";
import enLms from "@/locales/en/lms.json";
import enMembership from "@/locales/en/membership.json";

// ─── Deep merge: recursively merges objects ───
// IMPORTANT: If the target already holds an object for a given key,
// a primitive value in the source will NOT overwrite it. This prevents
// flat locale label files (e.g. investor.json's "venture": "Venture")
// from silently clobbering established namespace objects (venture.json's
// "venture": { profile: "Profile", ... }).
function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      // Guard: don't overwrite an object namespace with a primitive.
      const existing = result[key];
      if (
        existing !== null &&
        existing !== undefined &&
        typeof existing === "object" &&
        !Array.isArray(existing)
      ) {
        // Preserve the namespace object — skip the primitive overwrite.
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// ─── Language registry: each language = deep-merged JSON modules ───
//
// English is bundled EAGERLY: it is the source of truth, the server/default
// snapshot and the fallback for every missing key. Every other language is a
// separate chunk, imported the moment it is actually selected — the merged
// corpus of both languages is ~790 kB of client JavaScript, and shipping it
// eagerly (as this module used to) put all of it on every route for every user.
export const EN = [
  enCommon,
  enAuth,
  enNav,
  enAdmin,
  enReports,
  enStatus,
  enErrors,
  enStaff,
  enPm,
  enParticipant,
  enTime,
  enFinance,
  enMessaging,
  enVenture,
  enInvestor,
  enForms,
  enCrm,
  enVadmin,
  enEngineering,
  enAuthorization,
  enInvestorAdmin,
  enAdminMisc,
  enTeam,
  enPlatformMisc,
  enPmMisc,
  enInvestorMisc,
  enParticipantMisc,
  enStaffMisc,
  enRootMisc,
  enLms,
  enMembership,
].reduce((merged, module) => deepMerge(merged, module), {});

// Languages that HAVE arrived. `en` is there from the start; the others are
// added by `loadLocale`, so `LOCALE_REGISTRY[lang]` is the readable view of what
// is currently in memory.
const loaded = {
  en: EN,
};

export const LOCALE_REGISTRY = loaded;

/** The merged corpus for `lang` if it is already in memory, else null. */
export function getLoadedLocale(lang) {
  return loaded[lang] || null;
}

// One entry per non-English language: nothing is fetched until it is asked for.
const LOADERS = {
  fr: () =>
    Promise.all([
      import("@/locales/fr/common.json"),
      import("@/locales/fr/auth.json"),
      import("@/locales/fr/navigation.json"),
      import("@/locales/fr/admin.json"),
      import("@/locales/fr/reports.json"),
      import("@/locales/fr/status.json"),
      import("@/locales/fr/errors.json"),
      import("@/locales/fr/staff.json"),
      import("@/locales/fr/pm.json"),
      import("@/locales/fr/participant.json"),
      import("@/locales/fr/time.json"),
      import("@/locales/fr/finance.json"),
      import("@/locales/fr/messaging.json"),
      import("@/locales/fr/venture.json"),
      import("@/locales/fr/investor.json"),
      import("@/locales/fr/forms.json"),
      import("@/locales/fr/crm.json"),
      import("@/locales/fr/vadmin.json"),
      import("@/locales/fr/engineering.json"),
      import("@/locales/fr/authorization.json"),
      import("@/locales/fr/investorAdmin.json"),
      import("@/locales/fr/adminMisc.json"),
      import("@/locales/fr/team.json"),
      import("@/locales/fr/platformMisc.json"),
      import("@/locales/fr/pmMisc.json"),
      import("@/locales/fr/investorMisc.json"),
      import("@/locales/fr/participantMisc.json"),
      import("@/locales/fr/staffMisc.json"),
      import("@/locales/fr/rootMisc.json"),
      import("@/locales/fr/lms.json"),
      import("@/locales/fr/membership.json"),
    ]),
};

// In-flight loads, so several components asking for the same language in the
// same tick share one fetch instead of each starting their own.
const pendingLoads = {};

/**
 * Loads and merges one language's JSON modules on demand, memoising the result.
 * Resolves null for a language that is unknown or has no loader of its own.
 */
export function loadLocale(lang) {
  if (loaded[lang]) return Promise.resolve(loaded[lang]);
  const loader = LOADERS[lang];
  if (!loader) return Promise.resolve(null);
  if (!pendingLoads[lang]) {
    pendingLoads[lang] = loader()
      .then((modules) =>
        modules
          .map((module) => module.default || module)
          .reduce((merged, module) => deepMerge(merged, module), {}),
      )
      .then((merged) => {
        loaded[lang] = merged;
        return merged;
      })
      .finally(() => {
        delete pendingLoads[lang];
      });
  }
  return pendingLoads[lang];
}

export { deepMerge };
