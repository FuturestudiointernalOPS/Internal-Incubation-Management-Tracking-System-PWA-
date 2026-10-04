/**
 * Permission Center matrix helpers — coverage and eligibility.
 *
 * Surfaces stored capabilities the editor is not showing, and computes which
 * features a person's editor may offer. Pure: no React, no DB.
 */

/**
 * C1 — stored capabilities the editable matrix is NOT showing, at CAPABILITY
 * granularity (a module can be editable while one of its capabilities is not).
 *
 * Three ways a stored capability can end up invisible in the template editor:
 *   - its feature is no longer eligible for the profile's roles;
 *   - its module is not a dashboard section (so it is dropped from the screen);
 *   - its capability is no longer offered by the product (retired).
 * In every case the row is still STORED, still granted to everyone who inherits
 * the profile, and still sent on save — so hiding it silently makes the screen
 * dishonest AND can make a save fail on something the admin cannot even see.
 * Return them so the editor can surface them read-only with a "remove".
 *
 * @param {Object} savedCaps  {module: {capability: level}} as persisted
 * @param {Object} editableCaps  {module: Set|Array<capability>} still offered
 * @returns {Array<{module: string, capabilities: string[]}>} sorted, non-empty
 */
export function collectHiddenStoredCaps(savedCaps, editableCaps) {
  const out = [];
  for (const [module, caps] of Object.entries(savedCaps || {})) {
    const offered = editableCaps?.[module];
    const editable = offered instanceof Set ? offered : new Set(offered || []);
    const held = Object.entries(caps || {})
      .filter(
        ([capability, level]) => Number(level) > 0 && !editable.has(capability),
      )
      .map(([capability]) => capability)
      .sort();
    if (held.length > 0) out.push({ module, capabilities: held });
  }
  return out.sort((first, second) => first.module.localeCompare(second.module));
}

/**
 * PHASE C — the features a PERSON's editor may offer.
 *
 * A person's editor must only offer what can actually be granted: the features
 * the person is eligible for, PLUS any feature where a personal exception
 * already exists (an individual grant or block). Keeping the exception visible
 * is what lets it be undone — hiding it would make it impossible to remove.
 *
 * Returns `undefined` when eligibility is unknown, so the caller hides NOTHING
 * rather than everything: a missing map must never look like "no access".
 *
 * @param {Object|null} eligibility  {feature: true | {eligible: boolean}}
 * @param {Object} moduleToFeature   module → feature
 * @param {Iterable<string>} exceptionModules  modules holding a personal exception
 * @returns {Set<string>|undefined}
 */
export function eligibleFeaturesForPerson(
  eligibility,
  moduleToFeature,
  exceptionModules = [],
) {
  if (!eligibility) return undefined;
  const features = new Set();
  for (const [feature, state] of Object.entries(eligibility)) {
    if (state === true || state?.eligible === true) features.add(feature);
  }
  for (const moduleKey of exceptionModules) {
    const feature = moduleToFeature?.[moduleKey];
    if (feature) features.add(feature);
  }
  return features;
}

/**
 * Is this person eligible for a feature, from the resolved eligibility map?
 *
 * Accepts both shapes the app produces: a plain boolean and `{eligible}`.
 * Fails OPEN on a missing map (the editor hides nothing when the data is
 * unavailable) and treats a module with no feature as not eligibility-bound.
 */
export function isPersonEligibleForFeature(eligibility, feature) {
  if (!eligibility) return true;
  if (!feature) return true;
  const state = eligibility[feature];
  return state === true || state?.eligible === true;
}
