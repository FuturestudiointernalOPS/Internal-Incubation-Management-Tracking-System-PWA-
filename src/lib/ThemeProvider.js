"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const ThemeContext = createContext({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

/**
 * Resolves the stored preference to an actual color scheme.
 * "system" → OS preference, otherwise return as-is.
 */
function resolveTheme(preference) {
  if (preference === "system") {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "dark"; // fallback during SSR
  }
  if (preference === "dark" || preference === "light") return preference;
  return "dark";
}

/**
 * Apply resolved theme to the DOM and persist the preference.
 * @param {string} preference - "dark" | "light" | "system"
 */
function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem("impactos_theme", preference);
  return resolved;
}

export function ThemeProvider({ children }) {
  const [mounted, setMounted] = useState(false);

  // theme = user preference ("dark" | "light" | "system")
  const [theme, setThemePref] = useState("dark");
  // resolvedTheme = actual applied scheme ("dark" | "light")
  const [resolvedTheme, setResolvedTheme] = useState("dark");

  // Ref to hold the matchMedia listener so we can clean it up
  const mqlRef = useRef(null);
  const mqlHandlerRef = useRef(null);

  // Apply resolved theme to state (for rendering) and to DOM
  const applyAndSet = useCallback((preference) => {
    const resolved = applyTheme(preference);
    setThemePref(preference);
    setResolvedTheme(resolved);
  }, []);

  // On mount: sync with what the pre-hydration script already set on <html>,
  // then read the actual stored preference to determine if we're in "system" mode.
  useEffect(() => {
    const stored = localStorage.getItem("impactos_theme") || "dark";
    // If the pre-hydration script resolved "system" to dark/light, data-theme
    // already reflects the correct OS preference. We just need to know the
    // stored preference to set state correctly.
    const current = document.documentElement.getAttribute("data-theme") || "dark";

    setThemePref(stored);
    setResolvedTheme(current);
    setMounted(true);

    // If preference is "system", listen for OS changes
    if (stored === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      mqlRef.current = mql;
      const handler = (e) => {
        const resolved = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", resolved);
        setResolvedTheme(resolved);
      };
      mqlHandlerRef.current = handler;
      // Use modern API if available, fallback to addListener
      if (mql.addEventListener) {
        mql.addEventListener("change", handler);
      } else {
        mql.addListener(handler);
      }
    }
  }, []);

  const setTheme = useCallback(
    (newTheme) => {
      if (newTheme !== "dark" && newTheme !== "light" && newTheme !== "system") return;

      // Clean up old listener
      if (mqlRef.current && mqlHandlerRef.current) {
        const oldMql = mqlRef.current;
        const oldHandler = mqlHandlerRef.current;
        if (oldMql.removeEventListener) {
          oldMql.removeEventListener("change", oldHandler);
        } else {
          oldMql.removeListener(oldHandler);
        }
        mqlRef.current = null;
        mqlHandlerRef.current = null;
      }

      applyAndSet(newTheme);

      // If new preference is "system", start listening for OS changes
      if (newTheme === "system") {
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        mqlRef.current = mql;
        const handler = (e) => {
          const resolved = e.matches ? "dark" : "light";
          document.documentElement.setAttribute("data-theme", resolved);
          setResolvedTheme(resolved);
        };
        mqlHandlerRef.current = handler;
        if (mql.addEventListener) {
          mql.addEventListener("change", handler);
        } else {
          mql.addListener(handler);
        }
      }
    },
    [applyAndSet],
  );

  const toggleTheme = useCallback(() => {
    // Cycle: dark → light → system → dark
    const cycle = { dark: "light", light: "system", system: "dark" };
    const next = cycle[theme] || "dark";
    setTheme(next);
  }, [theme, setTheme]);

  // Clean up matchMedia listener on unmount
  useEffect(() => {
    return () => {
      if (mqlRef.current && mqlHandlerRef.current) {
        const mql = mqlRef.current;
        const handler = mqlHandlerRef.current;
        if (mql.removeEventListener) {
          mql.removeEventListener("change", handler);
        } else {
          mql.removeListener(handler);
        }
        mqlRef.current = null;
        mqlHandlerRef.current = null;
      }
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
