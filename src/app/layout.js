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

  // Global API error interceptor — reports failed API calls to /api/errors
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const method = args[1]?.method || "GET";

      // Skip reporting for error-reporting endpoints to avoid loops
      if (url.includes("/api/errors") || url.includes("/api/auth/session")) {
        return originalFetch.apply(window, args);
      }

      try {
        const response = await originalFetch.apply(window, args);

        // Report 4xx and 5xx responses
        if (!response.ok && response.status >= 400) {
          let userRole = "";
          try {
            const saved = localStorage.getItem("user");
            if (saved) userRole = JSON.parse(saved).role || "";
          } catch (_) {}

          const payload = JSON.stringify({
            message: `API ${method} ${url} returned ${response.status}`,
            url: window.location.href,
            user_agent: navigator.userAgent,
            user_role: userRole,
            severity: response.status >= 500 ? "error" : "warning",
            status_code: response.status,
            method: method,
            endpoint: url,
            page: window.location.pathname,
            action_attempted: `API call: ${method} ${url}`,
          });

          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/errors", payload);
          } else {
            // Use originalFetch to avoid infinite loop
            originalFetch("/api/errors", {
              method: "POST",
              body: payload,
            }).catch(() => {});
          }
        }

        return response;
      } catch (err) {
        // Network errors (e.g., failed to connect)
        const payload = JSON.stringify({
          message: `Network error: ${err.message} — ${method} ${url}`,
          url: window.location.href,
          user_agent: navigator.userAgent,
          severity: "error",
          method: method,
          endpoint: url,
          page: window.location.pathname,
          action_attempted: `API call: ${method} ${url}`,
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/errors", payload);
        } else {
          originalFetch("/api/errors", { method: "POST", body: payload }).catch(
            () => {},
          );
        }

        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
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
