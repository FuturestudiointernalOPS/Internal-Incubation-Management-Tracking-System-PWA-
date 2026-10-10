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
 *   GOOGLE_REDIRECT_URI     optional — defaults to
 *                           <APP_URL>/api/integrations/google-calendar/callback
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

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
    redirectUri:
      readEnv("GOOGLE_REDIRECT_URI") ||
      `${resolveAppUrl()}/api/integrations/google-calendar/callback`,
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
