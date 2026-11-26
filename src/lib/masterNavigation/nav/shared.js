/**
 * Master navigation — the leaf nodes shared by more than one section.
 *
 * Defined ONCE and referenced (never copied) by every parent that shows them,
 * so a node's identity, icon and address stay the same wherever it appears.
 */

export const standupNode = { id: "standup", name: "STANDUP", href: "/staff/op-report?tab=standup" };
export const retroNode = { id: "retro", name: "RETRO", href: "/staff/op-report?tab=retro" };
export const myProjectsNode = {
  id: "my_projects",
  name: "MY PROJECTS",
  icon: "briefcase",
  href: "/staff/projects",
};
