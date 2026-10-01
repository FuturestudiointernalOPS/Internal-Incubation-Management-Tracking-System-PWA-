"use client";

import { useEffect } from "react";
import { notify } from "@/lib/notify";

/**
 * The `error` codes an endpoint answers with when the caller IS authenticated
 * but not allowed to do what they asked. Both the i18n key and the legacy
 * English literal are listed, because a few guards still reply with the
 * literal (see `getServerErrorKey` in src/lib/constants.js).
 */
const PERMISSION_DENIED_ERRORS = new Set([
  "errors.insufficientPermissions",
  "errors.forbidden",
  "Insufficient permissions.",
  "You are not allowed to do this.",
]);

/**
 * A 403 carrying the authorization vocabulary is answered before any handler
 * runs, so the screen that fired it has no error text to show: the request
 * simply fails and the person is left with a button that does nothing. This
 * reads the response body from a CLONE — the caller's own read is untouched —
 * and raises the app's toast when the denial is a permission one. The
 * translation KEY is posted, not the sentence, so the toast speaks the
 * reader's own language.
 */
async function announcePermissionDenial(response) {
  try {
    const body = await response.clone().json();
    if (PERMISSION_DENIED_ERRORS.has(body?.error)) {
      notify("error", "errors.insufficientPermissions");
    }
  } catch (_) {
    // A non-JSON 403 (an HTML error page, an empty body) carries no
    // vocabulary to read: report nothing rather than guess.
  }
}

/**
 * Browser-only error reporting, split out of the root layout.
 *
 * The root layout must stay a Server Component: its <head> contains a
 * pre-hydration script that sets the theme before first paint, and a script
 * rendered by a Client Component is never executed on the client. Everything
 * that genuinely needs the browser lives here instead.
 */
export default function ClientErrorReporter() {
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
      if (
        url.includes("/api/errors") ||
        url.includes("/api/auth/session") ||
        url.includes("/api/notifications")
      ) {
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

        // A refusal the server sent back on permission grounds must SAY SO, or
        // the action just looks broken. Everything else about the call (the
        // error report above) is unchanged.
        if (response.status === 403) {
          await announcePermissionDenial(response);
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

  return null;
}
