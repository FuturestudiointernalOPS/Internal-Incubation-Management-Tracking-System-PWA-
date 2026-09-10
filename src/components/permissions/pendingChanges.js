/**
 * PHASE UI-3 — pending changes (pure, unit-tested).
 *
 * The unified "review before save" list shared by the profile editor and the
 * defaults matrix: it answers WHAT is about to change, not just how many.
 */
export function diffCapabilities(savedCaps = {}, draftCaps = {}) {
  const items = [];
  const modules = new Set([
    ...Object.keys(savedCaps || {}),
    ...Object.keys(draftCaps || {}),
  ]);
  for (const modKey of [...modules].sort()) {
    const caps = new Set([
      ...Object.keys(savedCaps?.[modKey] || {}),
      ...Object.keys(draftCaps?.[modKey] || {}),
    ]);
    for (const capability of [...caps].sort()) {
      const from = Number(savedCaps?.[modKey]?.[capability] ?? 0);
      const to = Number(draftCaps?.[modKey]?.[capability] ?? 0);
      if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
        items.push({ module: modKey, capability, from, to, label: `${modKey}.${capability}` });
      }
    }
  }
  return items;
}
