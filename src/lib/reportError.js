/**
 * Client-side error reporting utility.
 *
 * Use this to automatically report application errors to /api/errors
 * from API call failures, form submission failures, etc.
 *
 * @example
 *   import { reportError } from "@/lib/reportError";
 *
 *   try {
 *     const res = await fetch("/api/standups/submit", { ... });
 *     if (!res.ok) throw new Error(`API returned ${res.status}`);
 *   } catch (e) {
 *     await reportError(e, { page: "standup", action: "submit standup" });
 *   }
 */

let cachedUser = null;
async function getUserInfo() {
  if (cachedUser) return cachedUser;
  try {
    const res = await fetch("/api/auth/session");
    const data = await res.json();
    if (data.authenticated && data.user) {
      cachedUser = {
        user_id: data.user.cid,
        user_name: data.user.name,
      };
      return cachedUser;
    }
  } catch (_) {}
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      cachedUser = {
        user_id: u.cid || u.id,
        user_name: u.name,
      };
      return cachedUser;
    }
  } catch (_) {}
  return {};
}

/**
 * Reports an error to the server-side error log.
 *
 * @param {Error|string} error - The error object or message string.
 * @param {Object} options
 * @param {string} options.page - The page where the error occurred.
 * @param {string} options.action - What the user was trying to do.
 * @param {string} options.severity - Severity level (info, warning, error, critical).
 * @param {number} options.statusCode - HTTP status code if applicable.
 * @param {string} options.method - HTTP method if applicable.
 * @param {string} options.endpoint - API endpoint if applicable.
 */
export async function reportError(error, options = {}) {
  try {
    const user = await getUserInfo();
    const message =
      typeof error === "string" ? error : error?.message || "Unknown error";

    const payload = {
      message,
      stack: typeof error === "object" ? error?.stack : null,
      url: window.location.href,
      user_id: user.user_id || null,
      user_name: user.user_name || null,
      user_agent: navigator.userAgent,
      severity: options.severity || "error",
      status_code: options.statusCode || null,
      method: options.method || null,
      endpoint: options.endpoint || null,
      page: options.page || window.location.pathname,
      action_attempted: options.action || null,
    };

    // Use sendBeacon if available (more reliable on page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/errors", JSON.stringify(payload));
    } else {
      await fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch (_) {
    // Fail silently — never loop on error reporting
  }
}

/**
 * Creates a wrapped fetch function that automatically reports failures.
 * Use this to replace raw fetch() calls in critical paths.
 *
 * @param {string} page - The page name for error context.
 * @param {string} action - Description of the action being performed.
 * @returns {Function} A wrapped fetch function.
 *
 * @example
 *   const safeFetch = createSafeFetch("standup", "save standup");
 *   const res = await safeFetch("/api/standups/submit", { method: "POST", body: ... });
 */
export function createSafeFetch(page, action) {
  return async (url, options = {}) => {
    try {
      const res = await fetch(url, options);

      if (!res.ok) {
        // Try to get error message from response
        let errorMsg = `HTTP ${res.status}`;
        try {
          const data = await res.clone().json();
          if (data.error) errorMsg = data.error;
        } catch (_) {}

        reportError(new Error(errorMsg), {
          page,
          action,
          statusCode: res.status,
          method: options.method || "GET",
          endpoint: url,
          severity: res.status >= 500 ? "error" : "warning",
        });
      }

      return res;
    } catch (e) {
      reportError(e, {
        page,
        action,
        severity: "error",
        endpoint: url,
        method: options.method || "GET",
      });
      throw e;
    }
  };
}
