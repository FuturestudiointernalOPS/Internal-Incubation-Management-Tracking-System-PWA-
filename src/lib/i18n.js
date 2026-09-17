/**
 * ════════════════════════════════════════════════════════════════
 * IMPACTOS TRANSLATION ENGINE
 * ════════════════════════════════════════════════════════════════
 *
 * 🔴 AI AGENTS & DEVELOPERS — READ THIS BEFORE ADDING TEXT
 *
 * EVERY user-visible string MUST use the t() function:
 *
 *   ✅ {t("common.save")}
 *   ✅ {t("reports.table.task")}
 *   ❌ "Save"
 *   ❌ "Task"
 *
 * When adding a new t() call:
 *   1. Add the key+value to the matching file in src/locales/en/
 *   2. Add the French translation to src/locales/fr/
 *   3. See AI_AGENT_INSTRUCTIONS.md for full namespace reference
 *
 * ════════════════════════════════════════════════════════════════
 *
 * Feature-area organized i18n with English fallback.
 * Supports future languages without redesign.
 *
 * Usage:
 *   import { t, useI18n } from '@/lib/i18n'
 *   t('common.save')
 *   t('auth.login.title')
 *   t('reports.noTasksFound')
 *
 * Deep key resolution with dot notation.
 * Missing keys in the active language fall back to English.
 * Missing English keys return the key itself as a visible signal.
 */

"use client";

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
} from "react";
import { LOCALE_REGISTRY } from "@/lib/locales";

// ─── Supported Languages ───
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "fr", label: "French", nativeLabel: "Français" },
];

export const DEFAULT_LANGUAGE = "en";

// ─── Language Registry ───
// Add new languages here. Only English is required to have all keys.
const LANGUAGES = LOCALE_REGISTRY;

// ─── The chosen language, as a store ─────────────────────────────────────────
//
// The choice lives in the BROWSER's stores (the preference, and the signed-in
// account's own language), so it cannot be read during the render that the
// server also produces — which is why this provider used to copy it into state
// from two effects, one of them watching the other. It is exposed as a
// subscribable store instead: the server snapshot is the default, React uses that
// snapshot for the hydration render as well, and the real choice arrives on the
// client's own read. No state, no effect, no cascaded render.
const languageListeners = new Set();
let cachedLanguage = null;

/** The account's language wins over the loose preference, which wins over the browser's. */
function readLanguage() {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.language && LANGUAGES[user.language]) return user.language;
    }
    const saved = localStorage.getItem("impactos_lang");
    if (saved && LANGUAGES[saved]) return saved;
  } catch {
    // A browser with storage disabled falls through to the browser's own choice.
  }
  const detected =
    typeof navigator !== "undefined"
      ? (navigator.language || navigator.languages?.[0] || DEFAULT_LANGUAGE)
          .toLowerCase()
          .slice(0, 2)
      : DEFAULT_LANGUAGE;
  return LANGUAGES[detected] ? detected : DEFAULT_LANGUAGE;
}

function getLanguageSnapshot() {
  // Cached, because a snapshot read on every call is only safe while it returns
  // a value of stable identity — a string here, and the same string.
  const stored = readLanguage();
  if (stored !== cachedLanguage) cachedLanguage = stored;
  return cachedLanguage;
}

function getLanguageServerSnapshot() {
  return DEFAULT_LANGUAGE;
}

function subscribeLanguage(listener) {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}

function writeLanguage(next) {
  try {
    localStorage.setItem("impactos_lang", next);
    // Keep the stored account in step: the account's language is read FIRST, so a
    // choice that did not update it would be undone on the next read.
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      user.language = next;
      localStorage.setItem("user", JSON.stringify(user));
    }
  } catch {
    // Silent fail — the choice still holds for this session.
  }
  cachedLanguage = next;
  for (const listener of languageListeners) listener();
}

// ─── Deep key resolver ───
// t('auth.login.title') → translations.en.auth.login.title
function resolveKey(obj, key) {
  if (!key || typeof key !== "string") return null;
  const parts = key.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = current[part];
  }
  return typeof current === "string" ? current : null;
}

// ─── Context (SSR-safe: default returns key name as fallback) ───
const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  t: (key) => key,
  switchLang: () => {},
});

export function I18nProvider({ children }) {
  const lang = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageServerSnapshot,
  );

  const t = useCallback(
    (key, params = {}) => {
      // Try active language first
      const activeLang = LANGUAGES[lang];
      let result = resolveKey(activeLang, key);
      if (result == null) {
        // Fallback to English
        result = resolveKey(LANGUAGES[DEFAULT_LANGUAGE], key);
      }
      if (result == null) return key;

      // Replace {param} placeholders
      return result.replace(/\{(\w+)\}/g, (_, name) => {
        return params[name] !== undefined ? params[name] : `{${name}}`;
      });
    },
    [lang],
  );

  const switchLang = useCallback((newLang) => {
    if (!LANGUAGES[newLang]) return;
    writeLanguage(newLang);

    // If a language endpoint exists, persist to account
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.cid || user.id) {
          // Fire-and-forget — don't block UI on this
          fetch("/api/auth/language", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.cid || user.id,
              language: newLang,
            }),
          }).catch(() => {});
        }
      }
    } catch {
      // Silent fail — localStorage preference is still saved
    }
  }, []);

  return (
    <I18nContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
