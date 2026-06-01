"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [mounted, setMounted] = useState(false);

  // On mount, read the theme that the pre-hydration script already set on <html>
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setThemeState(current);
    setMounted(true);
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme !== "dark" && newTheme !== "light") return;
    setThemeState(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("impactos_theme", newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [theme, setTheme]);

  // Avoid hydration mismatch — render children only after mount
  // but apply the theme instantly via the pre-hydration script
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
