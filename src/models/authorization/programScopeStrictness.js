/**
 * ImpactOS — PROGRAM SCOPE STRICTNESS (the rollout switch)
 *
 * Enforcing program record scope is a REMOVAL: today any holder of the program
 * capability reaches every program, and the rule restricts them to the programs
 * they are staffed on. The switch exists so the change is a decision with a
 * date rather than a surprise on deploy — and so it can be reversed in one
 * click.
 *
 * STRICTNESS IS NOT AUTHORIZATION, and it defaults the OPPOSITE way on purpose:
 *
 *   authorization decisions      fail CLOSED (a lookup error denies)
 *   this rollout switch          fails SAFE, i.e. OFF (a lookup error keeps
 *                                today's behaviour)
 *
 * Reading a failed lookup as "on" would silently strip access; reading it as
 * "off" preserves exactly what the system did before this mechanism existed.
 * The switch only ever decides whether the CHECK runs, never who may do what.
 *
 * WAVES. Scope is switched on one domain at a time, easiest first, so a
 * mis-measured wave can be turned back off without touching the others:
 *
 *   content     — editing a program's own content
 *   enrollment  — invitations and participant enrollment
 *   groups      — cohorts/groups and KPI weights
 *
 * A wave is OFF until an administrator turns it on from the Operations screen,
 * after reading the readiness report (unmanaged programs, people attached to
 * nothing). Nothing here is applied automatically.
 *
 * Stored in a small key/value table (self-healing, no migration required) and
 * read through a short-lived cache: the guard runs on request paths that cannot
 * afford a settings round trip each time.
 */

import db from "@/lib/db";

/** The domains scope can be switched on for, in the recommended order. */
export const PROGRAM_SCOPE_WAVES = ["content", "enrollment", "groups"];

/** Human-facing description of what each wave covers (used by the UI/docs). */
export const PROGRAM_SCOPE_WAVE_INFO = {
  content: {
    key: "content",
    label: "Program content",
    covers: "Editing and archiving a program's own content",
    partial: false,
    exempt: [],
  },
  enrollment: {
    key: "enrollment",
    label: "Invitations and enrollment",
    covers: "Program invitations, adding and removing participants",
    // NOT the whole domain: the legacy V2 invitation route carries a project
    // banner reserving it for V1 pages and forbidding agent changes, so its
    // invitations stay open. Enabling this wave closes the V1 door only, and the
    // readiness report says so rather than implying full coverage.
    partial: true,
    exempt: ["api/v2/invites (legacy V2 route — project instruction: changes go in the V1 counterpart)"],
  },
  groups: {
    key: "groups",
    label: "Groups and targets",
    covers: "Cohorts/groups and KPI weights",
    partial: true,
    exempt: [
      "api/v2/groups (legacy V2 route — project instruction: changes go in the V1 counterpart)",
      "api/v2/kpis (legacy V2 route — project instruction: changes go in the V1 counterpart)",
    ],
  },
};

const SETTINGS_KEY = "program_scope_waves";
const CACHE_TTL_MS = 15_000;

let settingsSchemaPromise = null;
let cache = null; // { value, expires }

/** Self-healing key/value table (same pattern as the other authz tables). */
export function ensureAuthzSettingsSchema() {
  if (!settingsSchemaPromise) {
    settingsSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS authz_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      return true;
    })().catch((e) => {
      console.warn("[Authz] ensureAuthzSettingsSchema failed:", e.message);
      settingsSchemaPromise = null;
      return false;
    });
  }
  return settingsSchemaPromise;
}

/** Every wave OFF — the state before anything is switched on. */
export function allWavesOff() {
  return Object.fromEntries(PROGRAM_SCOPE_WAVES.map((w) => [w, false]));
}

/**
 * Normalize a stored/partial value into the full wave map. Unknown keys are
 * dropped and missing waves are FALSE, so a partial or corrupted value can never
 * switch on more than it says.
 */
export function normalizeWaves(value) {
  const out = allWavesOff();
  if (!value || typeof value !== "object") return out;
  for (const wave of PROGRAM_SCOPE_WAVES) {
    if (value[wave] === true) out[wave] = true;
  }
  return out;
}

/**
 * The current switch state. FAILS SAFE: any read/schema/parse problem answers
 * "all off", which preserves the pre-existing behaviour rather than removing
 * access on a transient error.
 */
export async function getProgramScopeWaves() {
  if (cache && cache.expires > Date.now()) return cache.value;
  try {
    await ensureAuthzSettingsSchema();
    const res = await db.execute({
      sql: "SELECT value FROM authz_settings WHERE key = ?",
      args: [SETTINGS_KEY],
    });
    const raw = res.rows?.[0]?.value;
    let parsed = null;
    if (typeof raw === "string" && raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    } else if (raw && typeof raw === "object") {
      parsed = raw; // a jsonb column would arrive already decoded
    }
    const value = normalizeWaves(parsed);
    cache = { value, expires: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (e) {
    console.warn("[Authz] getProgramScopeWaves failed:", e.message);
    return allWavesOff();
  }
}

/** Is the scope check enabled for this wave? Fails safe (off). */
export async function isWaveStrict(wave) {
  if (!PROGRAM_SCOPE_WAVES.includes(wave)) return false;
  const waves = await getProgramScopeWaves();
  return waves[wave] === true;
}

/**
 * Turn ONE wave on or off. Idempotent; returns the whole resulting state so the
 * caller can report it. Other waves are never touched.
 */
export async function setProgramScopeWave(wave, enabled) {
  if (!PROGRAM_SCOPE_WAVES.includes(wave)) {
    return { success: false, error: "unknown wave" };
  }
  try {
    await ensureAuthzSettingsSchema();
    const current = await getProgramScopeWaves();
    const next = { ...current, [wave]: enabled === true };
    await db.execute({
      sql: `INSERT INTO authz_settings (key, value, updated_at)
            VALUES (?, ?, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      args: [SETTINGS_KEY, JSON.stringify(next)],
    });
    // Update immediately rather than waiting for the TTL: the administrator
    // just asked for this, and a 15s window of the old answer would be
    // indistinguishable from the switch not working.
    cache = { value: next, expires: Date.now() + CACHE_TTL_MS };
    return { success: true, waves: next };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** Drop the cached switch state (tests, and any out-of-band write). */
export function invalidateProgramScopeWavesCache() {
  cache = null;
}
