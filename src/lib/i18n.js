"use client";

import { createContext, useContext, useState, useEffect } from "react";
import en from "@/translations/en";
import fr from "@/translations/fr";

const I18nContext = createContext({ t: (key) => key, lang: "en", setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const stored = localStorage.getItem("impactos_lang");
    if (stored === "fr" || stored === "en") setLang(stored);
  }, []);

  const t = (key) => {
    const keys = key.split(".");
    let val = lang === "fr" ? fr : en;
    for (const k of keys) {
      if (!val || typeof val !== "object") return key;
      val = val[k];
    }
    return typeof val === "string" ? val : key;
  };

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem("impactos_lang", l);
  };

  return <I18nContext.Provider value={{ t, lang, setLang: changeLang }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
