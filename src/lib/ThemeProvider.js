"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";

const ThemeContext = createContext({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  mounted: false,
});

const STORAGE_KEY = "impactos_theme";
const DEFAULT_PREFERENCE = "dark";
const PREFERENCES = ["dark", "light", "system"];

/**
 * Resolves the stored preference to an actual color scheme.
 * "system" → OS preference, otherwise return as-is.
 */
function resolveTheme(preference, osPrefersDark) {
  if (preference === "system") return osPrefersDark ? "dark" : "light";
  if (preference === "dark" || preference === "light") return preference;
  return "dark";
}

// ─── The stored preference, as a store ───────────────────────────────────────
//
// The preference lives in the BROWSER's store, so it cannot be read during the
// render that the server also produces — which is why this provider used to copy
// it into state from an effect. It is exposed as a subscribable store instead:
// the server snapshot is the default, React uses that snapshot for the hydration
// render as well, and the real value arrives on the client's own read. Nothing
// has to be copied into state and no render is cascaded.
//
// The DOM attribute is NOT set from here: a pre-hydration script in the document
// head already set it before the first paint, and `applyPreference` below keeps
// it right afterwards (see the layout effect in the provider).
let cachedPreference = null;
const preferenceListeners = new Set();

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return PREFERENCES.includes(stored) ? stored : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

function getPreferenceSnapshot() {
  // Cached, because a snapshot read on every call is only safe while it returns
  // a value of stable identity — a string here, and the same string.
  const stored = readStoredPreference();
  if (stored !== cachedPreference) cachedPreference = stored;
  return cachedPreference;
}

function getPreferenceServerSnapshot() {
  return DEFAULT_PREFERENCE;
}

function subscribePreference(listener) {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

/** Writes the store and tells every subscriber; the DOM follows the render. */
function writePreference(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // A browser with storage disabled keeps the preference for this session only.
  }
  cachedPreference = preference;
  for (const listener of preferenceListeners) listener();
}

// ─── The operating system's preference, as a store ───────────────────────────
//
// Only consulted while the preference is "system", but subscribed always: one
// listener is cheaper than attaching and detaching it as the preference changes,
// which is what the provider used to do by hand.

function getOsDarkSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getOsDarkServerSnapshot() {
  return null;
}

function subscribeOsDark(listener) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

// ─── Whether the client is rendering ─────────────────────────────────────────

const subscribeNever = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeProvider({ children }) {
  // "dark" | "light" | "system"
  const theme = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );

  // "dark" | "light" — what the document actually shows.
  const osPrefersDark = useSyncExternalStore(
    subscribeOsDark,
    getOsDarkSnapshot,
    getOsDarkServerSnapshot,
  );
  const resolvedTheme = resolveTheme(theme, osPrefersDark);

  // False on the server and through the hydration render, true afterwards. It is
  // what lets the write below wait: on the hydration pass this component's
  // resolved theme is the server's default, and writing it would undo the script
  // that already resolved the real one before the first paint.
  const mounted = useSyncExternalStore(
    subscribeNever,
    getClientSnapshot,
    getServerSnapshot,
  );

  useLayoutEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [mounted, resolvedTheme]);

  const setTheme = useCallback((newTheme) => {
    if (!PREFERENCES.includes(newTheme)) return;
    writePreference(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    // Cycle: dark → light → system → dark
    const cycle = { dark: "light", light: "system", system: "dark" };
    setTheme(cycle[theme] || DEFAULT_PREFERENCE);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme, mounted }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
