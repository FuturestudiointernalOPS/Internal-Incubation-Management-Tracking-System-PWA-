/**
 * Master navigation — the STAFF surfaces hoisted for the staff roles.
 *
 * Their sections live in the admin tree above; these are the doors the staff
 * sidebar shows at the top level.
 */

import { myProjectsNode } from "./shared";

export const STAFF_NODES = [
  { id: "weekly_ops", name: "WEEKLY OPS", icon: "calendar", href: "/staff/op-report" },
  myProjectsNode,
];
