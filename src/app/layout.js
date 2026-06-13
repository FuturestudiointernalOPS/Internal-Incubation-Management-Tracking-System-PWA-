"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/ThemeProvider";

export default function RootLayout({ children }) {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    // Pre-hydration script already set data-theme on <html>.
    // Mark ready so ThemeProvider can sync from DOM without flash.
    setThemeReady(true);
  }, []);

  // ─── PWA Service Worker lifecycle management ───
  // Prevents "e is not a function" errors caused by stale SW caches
  // serving old page chunks alongside updated framework bundles.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    // When a new SW takes over, reload the page so all chunks are consistent
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // On mount, check for pending SW updates and trigger update if found
    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New SW is waiting — tell it to take over immediately
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        }
      });
    });

    // Cleanup old caches on activation (belt-and-suspenders)
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({ type: "CLEANUP_CACHES" });
      }
    });
  }, []);

  return (
    <html lang="en">
      <head>
        {/*
          PRE-HYDRATION THEME SCRIPT
          Runs before React hydrates — prevents FOUT (Flash of Unstyled Theme).
          Reads localStorage → falls back to system preference → defaults to 'dark'.
          Sets data-theme on <html> synchronously before first paint.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('impactos_theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
