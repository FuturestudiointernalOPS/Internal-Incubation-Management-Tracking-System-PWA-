/**
 * SHADOW MODE (Phase 5 — the migration safety net).
 *
 * When a legacy role/scope control is migrated to the central engine, the two
 * must be compared BEFORE the switch: the LEGACY control keeps deciding, the
 * engine computes in parallel, and every divergence is logged with its context
 * so it can be explained (a bug in the legacy control, or a mis-set template).
 *
 * INERT BY DEFAULT: nothing is compared or logged unless
 * `AUTHZ_SHADOW_MODE === "1"`. `shadowCheck` NEVER returns an authorization
 * decision — the caller keeps using the legacy result.
 *
 * COLLECTION (Phase 5, c3b) — a divergence is not only logged: it is also
 * AGGREGATED in memory (per resource/policy, with the DIRECTION of the gap and
 * a bounded recent list), so an operator running staging with the flag on can
 * read a summary from `GET /api/engineering/permissions/shadow-report` instead
 * of grepping logs. `getShadowReport()` is read-only; `resetShadowReport()`
 * clears it. The buffer is per instance (like the rate limiter) — enough for a
 * focused staging run; a shared store can replace it later.
 *
 * Pure + HTTP-free; the only side effects are the log line and the buffer.
 */
import { logger } from "@/lib/logger";

/** Divergences kept for the recent list (older ones are dropped). */
const MAX_RECENT = 100;

/** The collection buffer. Reset per process; cleared by `resetShadowReport`. */
const buffer = {
  total: 0,
  byKey: new Map(), // key -> { count, legacyAllowEngineDeny, legacyDenyEngineAllow }
  recent: [],
};

/** True when shadow comparison is enabled (env flag, default OFF). */
export function shadowEnabled() {
  return process.env.AUTHZ_SHADOW_MODE === "1";
}

/**
 * Pure comparison of the two verdicts. Returns `null` when they AGREE, else a
 * divergence record. Coerces to boolean so `undefined`/`0` never read as
 * "allowed".
 */
export function compareDecisions({ legacyAllowed, engineAllowed }) {
  const legacy = Boolean(legacyAllowed);
  const engine = Boolean(engineAllowed);
  if (legacy === engine) return null;
  return { legacyAllowed: legacy, engineAllowed: engine };
}

/** The bucket key a divergence is counted under (resource + engine policy). */
function keyOf(meta) {
  const resource = meta?.resource || meta?.module || "global";
  const policy = meta?.policy || meta?.capability || "";
  return policy ? `${resource}:${policy}` : String(resource);
}

/** Record one divergence in the in-memory buffer (bounded). */
function record(meta, divergence) {
  buffer.total += 1;

  const key = keyOf(meta);
  const bucket = buffer.byKey.get(key) || {
    count: 0,
    legacyAllowEngineDeny: 0,
    legacyDenyEngineAllow: 0,
  };
  bucket.count += 1;
  if (divergence.legacyAllowed) bucket.legacyAllowEngineDeny += 1;
  else bucket.legacyDenyEngineAllow += 1;
  buffer.byKey.set(key, bucket);

  buffer.recent.push({ key, ...meta, ...divergence });
  if (buffer.recent.length > MAX_RECENT) buffer.recent.shift();
}

/**
 * Shadow-compare one decision. Returns the divergence (or null) and logs +
 * records it when enabled — but does NOT decide: the caller keeps the legacy
 * verdict.
 *
 * @param {{legacyAllowed: boolean, engineAllowed: boolean, meta?: object}} args
 * @returns {{legacyAllowed: boolean, engineAllowed: boolean, meta?: object}|null}
 */
export function shadowCheck({ legacyAllowed, engineAllowed, meta = {} }) {
  if (!shadowEnabled()) return null;
  const divergence = compareDecisions({ legacyAllowed, engineAllowed });
  if (divergence) {
    logger.warn("authz_shadow_divergence", { ...meta, ...divergence });
    record(meta, divergence);
  }
  return divergence;
}

/**
 * The collected divergences, as a plain serializable object.
 *
 * @returns {{enabled: boolean, total: number, byKey: object, recent: Array}}
 */
export function getShadowReport() {
  const byKey = {};
  for (const [key, bucket] of buffer.byKey) byKey[key] = { ...bucket };
  return {
    enabled: shadowEnabled(),
    total: buffer.total,
    byKey,
    recent: [...buffer.recent],
  };
}

/** Clear the collection buffer (an operator starts a fresh measurement). */
export function resetShadowReport() {
  buffer.total = 0;
  buffer.byKey.clear();
  buffer.recent.length = 0;
}
