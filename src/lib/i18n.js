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
  useState,
  createContext,
  useContext,
  useEffect,
  useCallback,
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

// ─── Context (with SSR-safe default) ───
const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  t: (key) => {
    const fallback = resolveKey(LOCALE_REGISTRY[DEFAULT_LANGUAGE], key);
    return fallback != null ? fallback : key;
  },
  switchLang: () => {},
});

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(DEFAULT_LANGUAGE);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("impactos_lang");
    if (saved && LANGUAGES[saved]) {
      setLang(saved);
    }
  }, []);

  const t = useCallback(
    (key) => {
      // Try active language first
      const activeLang = LANGUAGES[lang];
      const activeResult = resolveKey(activeLang, key);
      if (activeResult != null) return activeResult;

      // Fallback to English
      const englishResult = resolveKey(LANGUAGES[DEFAULT_LANGUAGE], key);
      if (englishResult != null) return englishResult;

      // Last resort: return the key itself as a visible signal
      return key;
    },
    [lang],
  );

  const switchLang = useCallback((newLang) => {
    if (!LANGUAGES[newLang]) return;
    setLang(newLang);
    localStorage.setItem("impactos_lang", newLang);

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
    } catch (e) {
      // Silent fail — localStorage preference is still saved
    }
  }, []);

  // Sync language from user account on mount (if user object is set after login)
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (
          user.language &&
          LANGUAGES[user.language] &&
          user.language !== lang
        ) {
          setLang(user.language);
          localStorage.setItem("impactos_lang", user.language);
        }
      }
    } catch (e) {
      // Silent fail
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <I18nContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
