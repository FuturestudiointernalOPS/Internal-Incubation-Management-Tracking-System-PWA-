/**
 * ImpactOS — Master Navigation: node tables.
 *
 * The single canonical navigation TREE. Nodes are defined exactly once,
 * identified by their stable `id`; route differences between roles are a
 * routing concern (see ./access.js), never a duplicated node.
 *
 * The sections are split by area (./nav/admin.js, ./nav/staff.js,
 * ./nav/member.js) so a change to one area never has to touch the other two.
 * This file only puts them back in order — the order is what the sidebar and
 * the permissions UI read.
 */

import { ADMIN_NODES } from "./nav/admin";
import { STAFF_NODES } from "./nav/staff";
import { MEMBER_NODES } from "./nav/member";

export { standupNode, retroNode, myProjectsNode } from "./nav/shared";

export const MASTER_NAVIGATION = [...ADMIN_NODES, ...STAFF_NODES, ...MEMBER_NODES];
