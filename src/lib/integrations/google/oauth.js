import { resolveAppUrl } from "@/lib/appUrl";

/**
 * Google OAuth 2.0 transport (authorization-code flow, offline access).
 *
 * Infrastructure only: builds the consent URL and talks to Google's token
 * endpoints. Who may connect, what is stored and when to refresh is decided in
 * `@/services/integrations/googleCalendar`.
 *
 * Environment:
 *   GOOGLE_CLIENT_ID        OAuth client (type "Web application")
 *   GOOGLE_CLIENT_SECRET
 *   APP_URL                 the public domain of THIS environment (see appUrl.js)
 *   GOOGLE_REDIRECT_URI     optional — normally left unset. When set it MUST be
 *                           the full callback URL (https://<host>/api/…); a
 *                           value that is not a usable callback is refused
 *                           loudly instead of being sent to Google.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

/**
 * The one path our callback handler actually serves. Google compares the
 * redirect_uri byte-for-byte against the registered list, so this path — not a
 * hand-typed string — is what every caller must build from.
 */
export const GOOGLE_CALENDAR_CALLBACK_PATH =
  "/api/integrations/google-calendar/callback";

// Avoid repeating the same configuration warning on every token exchange.
const _warned = new Set();
function warnOnce(key, message) {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn(message);
}

/**
 * Could this be the OAuth callback? A redirect URI is only usable when it is
 * absolute, https (http only for local development) and ends with the path the
 * handler serves — otherwise it can never be one of the registered URIs.
 */
export function isUsableGoogleRedirectUri(value) {
  try {
    const url = new URL(String(value || "").trim());
    const isLocal =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
      return false;
    }
    return url.pathname.replace(/\/+$/, "") === GOOGLE_CALENDAR_CALLBACK_PATH;
  } catch {
    return false;
  }
}

/**
 * The redirect URI we send Google — DERIVED, never hand-typed.
 *
 * A mismatch is invisible until Google rejects the whole consent screen, so a
 * malformed override is refused here (warning + derived URL) rather than sent.
 * Deriving from APP_URL also keeps the value off the deployment host: a
 * `*.vercel.app` callback changes with every deployment hash, so a registered
 * preview URL can never match for long.
 */
export function getGoogleCalendarRedirectUri() {
  const override = String(process.env.GOOGLE_REDIRECT_URI || "").trim();
  if (override) {
    if (isUsableGoogleRedirectUri(override)) return override.replace(/\/+$/, "");
    warnOnce(
      `bad-redirect:${override}`,
      `[google-oauth] GOOGLE_REDIRECT_URI is not a usable callback URL: "${override}". ` +
        `It must be https://<host>${GOOGLE_CALENDAR_CALLBACK_PATH}. The override is ignored ` +
        `and the URL is derived from APP_URL instead.`,
    );
  }

  const derived = `${resolveAppUrl()}${GOOGLE_CALENDAR_CALLBACK_PATH}`;
  try {
    const { hostname } = new URL(derived);
    if (hostname.endsWith(".vercel.app")) {
      warnOnce(
        `vercel-host:${hostname}`,
        `[google-oauth] the OAuth callback is derived from a deployment host (${hostname}). ` +
          `Set APP_URL to this environment's public domain, or Google will reject the redirect.`,
      );
    }
  } catch {
    // A malformed APP_URL is not fatal here — Google reports it precisely.
  }
  return derived;
}

/** The redirect URI and where it came from — for the integration status screen. */
export function describeGoogleRedirect() {
  const override = String(process.env.GOOGLE_REDIRECT_URI || "").trim();
  return {
    redirectUri: getGoogleCalendarRedirectUri(),
    source:
      override && isUsableGoogleRedirectUri(override)
        ? "GOOGLE_REDIRECT_URI"
        : "APP_URL",
  };
}

// `calendar.app.created` is the privacy guarantee of the whole feature: it only
// grants access to calendars this app creates. Google itself refuses any read
// of the user's personal calendars — the filter cannot leak because the data
// is never reachable. `openid email` only serves to show which account is linked.
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.app.created",
];

// A value pasted into a hosting dashboard often carries a trailing newline,
// spaces or wrapping quotes; Google then answers `401 invalid_client` ("The
// OAuth client was not found") for an id that is otherwise correct.
function readEnv(name) {
  return String(process.env[name] || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

export function getGoogleOAuthConfig() {
  return {
    clientId: readEnv("GOOGLE_CLIENT_ID"),
    clientSecret: readEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: getGoogleCalendarRedirectUri(),
  };
}

export function isGoogleOAuthConfigured() {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  return Boolean(clientId && clientSecret);
}

/** The Google consent-screen URL for this `state`. */
export function buildGoogleAuthUrl(state) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline", // → a refresh token
    prompt: "consent", // → a refresh token even on a re-connect
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function postForm(url, fields) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`Google OAuth error: ${data.error || res.status}`);
    error.status = res.status;
    error.code = data.error;
    throw error;
  }
  return data;
}

/** Exchanges the callback `code` for { access_token, refresh_token, expires_in, scope, id_token }. */
export function exchangeGoogleCode(code) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return postForm(TOKEN_ENDPOINT, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

/** A fresh access token from a refresh token → { access_token, expires_in }. */
export function refreshGoogleAccessToken(refreshToken) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  return postForm(TOKEN_ENDPOINT, {
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
}

/** Revokes the grant at Google. Best effort: an already-revoked token is fine. */
export async function revokeGoogleToken(token) {
  if (!token) return;
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Network failure on revoke must not block a disconnect.
  }
}

/**
 * The e-mail inside the id_token returned by the token endpoint. The token came
 * straight from Google over TLS in our own server-to-server call, so reading
 * its payload without re-verifying the signature is acceptable here (it is only
 * displayed, never used to authenticate).
 */
export function emailFromIdToken(idToken) {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).email || null;
  } catch {
    return null;
  }
}
