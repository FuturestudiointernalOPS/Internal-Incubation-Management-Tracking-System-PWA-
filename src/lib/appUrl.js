/**
 * APP BASE URL RESOLUTION — single source of truth for building absolute
 * links (activation, password setup, login, run URLs, emails).
 *
 * NO domain is hardcoded here. The environment decides:
 *
 *   APP_URL                    → explicit runtime override (per environment)
 *   NEXT_PUBLIC_APP_URL        → explicit build-time override (per environment)
 *   VERCEL_URL                 → automatic Vercel deployment URL (fallback)
 *   otherwise                  → localhost (local development)
 *
 * Configure per environment in the host (e.g. Vercel → Settings → Environment
 * Variables):
 *   Production: APP_URL = https://impactos.futurestudio.bj
 *   Staging   : APP_URL = https://<staging-domain>
 * Leaving it unset on Vercel keeps the automatic *.vercel.app URL.
 */

export function resolveAppUrl() {
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && typeof explicit === "string") {
    return explicit.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export default resolveAppUrl;
