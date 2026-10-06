/**
 * SCHEDULED SWEEP GUARDS (SERVICE layer).
 *
 * Two pieces of decision the scheduled/same-origin endpoints share: whether a
 * deployment is configured to run a sweep at all, and whether a presented
 * shared secret is acceptable.
 *
 * The credential itself is read by the controller — where a secret travels
 * (header vs deprecated query parameter) is transport, not domain — but the
 * DECISION is here, so an endpoint cannot accidentally reorder it.
 *
 * Rules, unchanged:
 *   - An UNCONFIGURED deployment answers 503 and does nothing. It must never
 *     degrade into an unauthenticated write path: with no secret to compare
 *     against, every caller would "match".
 *   - A missing or wrong key is 403, with the i18n key the UI already maps.
 *   - The presented value is compared with `!==` and never echoed back, in the
 *     response or in the report.
 */

/**
 * May this scheduled sweep run?
 *
 * @param {{isConfigured: boolean, presentedKey: string|null|undefined}} input
 * @returns {{ok: true} | {ok: false, status: 503|403, error: string}}
 */
export function resolveSweepAuthorization({ isConfigured, presentedKey } = {}) {
  if (!isConfigured) {
    return { ok: false, status: 503, error: "Service not configured." };
  }
  if (!presentedKey) {
    return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  }
  return { ok: true };
}

/**
 * Whether a presented secret matches the configured one.
 *
 * A PRESENT-BUT-WRONG credential is never rescued by a fallback source: the
 * caller chose to present that value, so it stands. `resolveSweepAuthorization`
 * only decides the shape of the refusal.
 *
 * @param {string|null|undefined} presented
 * @param {string|null|undefined} configured
 * @returns {boolean}
 */
export function secretMatches(presented, configured) {
  return !!presented && !!configured && presented === configured;
}