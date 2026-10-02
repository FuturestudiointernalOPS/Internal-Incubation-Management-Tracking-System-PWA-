/**
 * Label resolution for the programme-scope panel. Pure helpers that take the
 * translator, so the panel and its blocks agree on how a server-provided key,
 * a status or a removal reason is rendered.
 */

/**
 * Server errors arrive either as a locale key ("errors.insufficientPermissions")
 * or as a message; a key that resolves nowhere falls back to a local label so
 * this panel never shows a raw key.
 */
export function messageFor(t, raw, fallbackKey) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return t(fallbackKey);
  const translated = t(value);
  if (translated !== value) return translated;
  return value.includes(" ") ? value : t(fallbackKey);
}

/** Program status is data: translate it when a label exists, else show it. */
export function statusLabel(t, status) {
  if (!status) return "";
  const key = `status.${String(status).toLowerCase()}`;
  const value = t(key);
  return value === key ? String(status) : value;
}

/**
 * The reason a capability is misplaced comes from the report for the template's
 * actual rows. It is translated by capability so the line reads in the active
 * language, and an unmapped one falls back to the reported reason.
 */
export function whyLabel(t, removal) {
  const key = `engineering.permissions.programScopeWhy_${removal.module}_${removal.capability}`;
  const value = t(key);
  return value === key ? removal.why || "" : value;
}
