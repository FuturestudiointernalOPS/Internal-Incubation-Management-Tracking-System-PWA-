"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/ThemeProvider";

export default function RootLayout({ children }) {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  // Global error capture — reports uncaught errors to /api/errors
  useEffect(() => {
    const handler = (event) => {
      const error = event.error || event.reason || {};
      const msg = error.message || event.message || "Unknown client error";

      // Don't report chunk loading errors (handled by AppErrorBoundary)
      if (msg.includes("ChunkLoadError") || msg.includes("is not a function"))
        return;

      const payload = JSON.stringify({
        message: msg,
        stack: error.stack || null,
        url: window.location.href,
        user_agent: navigator.userAgent,
        severity: "error",
        page: window.location.pathname,
        action_attempted: "browser event",
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/errors", payload);
      } else {
        fetch("/api/errors", { method: "POST", body: payload }).catch(() => {});
      }
    };

    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", handler);
    };
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
