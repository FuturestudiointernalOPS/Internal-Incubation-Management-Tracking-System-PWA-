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
 * Pure + HTTP-free; the only side effect is the log line.
 */
import { logger } from "@/lib/logger";

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

/**
 * Shadow-compare one decision. Returns the divergence (or null) and logs it when
 * enabled — but does NOT decide: the caller keeps the legacy verdict.
 *
 * @param {{legacyAllowed: boolean, engineAllowed: boolean, meta?: object}} args
 * @returns {{legacyAllowed: boolean, engineAllowed: boolean, meta?: object}|null}
 */
export function shadowCheck({ legacyAllowed, engineAllowed, meta = {} }) {
  if (!shadowEnabled()) return null;
  const divergence = compareDecisions({ legacyAllowed, engineAllowed });
  if (divergence) {
    logger.warn("authz_shadow_divergence", { ...meta, ...divergence });
  }
  return divergence;
}
