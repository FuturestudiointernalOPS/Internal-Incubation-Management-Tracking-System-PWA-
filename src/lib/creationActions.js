/**
 * ImpactOS — creation doors that can be DELEGATED (pure module).
 *
 * A `*_create` capability is the right, not the role: `programs.create`,
 * `ventures.create` and `investor.create` already exist in the capability
 * catalogue, so the Permission Center can grant them to any person. What was
 * missing was a surface a non-Super-Admin could actually open — every creation
 * flow lived under `/admin/*`, which the admin layout refuses to anyone but the
 * platform owner.
 *
 * This module is the ONE list of those doors, shared by:
 *   - `CreateActions`, the button row rendered on the dashboards and on the
 *     Programmes / Ventures views (never a sidebar section of its own);
 *   - the `/create` guard and hub page;
 *   - each `/create/*` page's own gate.
 *
 * Server routes stay authoritative: they check the capability themselves.
 * No React, no Next, no database — safe to import from anywhere.
 */

export const CREATION_ACTIONS = [
  {
    id: "program",
    module: "programs",
    capability: "create",
    href: "/create/program",
    icon: "briefcase",
    titleKey: "creation.program.title",
    actionKey: "creation.program.createAction",
    descriptionKey: "creation.program.description",
  },
  {
    id: "venture",
    module: "ventures",
    capability: "create",
    href: "/create/venture",
    icon: "rocket",
    titleKey: "creation.venture.title",
    actionKey: "creation.venture.createAction",
    descriptionKey: "creation.venture.description",
  },
  {
    id: "investor",
    module: "investor",
    capability: "create",
    href: "/create/investor",
    icon: "userPlus",
    titleKey: "creation.investor.title",
    actionKey: "creation.investor.createAction",
    descriptionKey: "creation.investor.description",
  },
];

/** The action behind a `/create/*` href (null when the path is not a creation door). */
export function creationActionForHref(href) {
  return CREATION_ACTIONS.find((action) => action.href === href) || null;
}
