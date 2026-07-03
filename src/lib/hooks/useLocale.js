"use client";
import { useState, useEffect, useCallback } from "react";
import { LOCALE_REGISTRY } from "@/lib/locales";

export function useLocale() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = localStorage?.getItem("app_language") || "en";
    setLang(saved);
  }, []);

  const strings = LOCALE_REGISTRY[lang] || LOCALE_REGISTRY.en;

  const t = useCallback(
    (key, fallback) => {
      const parts = key.split(".");
      let val = strings;
      for (const p of parts) {
        if (val == null) break;
        val = val[p];
      }
      return val || fallback || key;
    },
    [strings],
  );

  return { t, lang };
}
