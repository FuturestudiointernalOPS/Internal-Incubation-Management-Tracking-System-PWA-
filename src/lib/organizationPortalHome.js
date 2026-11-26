/**
 * Resolve where a client actor should land after sign-in.
 * Prefer the already-active organisation; otherwise a single membership;
 * only fall back to the chooser when several workspaces are available.
 */
export function resolveOrganizationPortalHome(context) {
  if (!context?.success) return null;
  if (context.organization?.code) {
    return `/o/${encodeURIComponent(context.organization.code)}`;
  }
  const organizations = Array.isArray(context.organizations) ? context.organizations : [];
  if (organizations.length === 1 && organizations[0]?.code) {
    return `/o/${encodeURIComponent(organizations[0].code)}`;
  }
  if (organizations.length > 1) return "/o/select";
  return null;
}

export function singleOrganizationCandidate(context) {
  if (!context?.success || context.organization?.code) return null;
  const organizations = Array.isArray(context.organizations) ? context.organizations : [];
  return organizations.length === 1 ? organizations[0] : null;
}
