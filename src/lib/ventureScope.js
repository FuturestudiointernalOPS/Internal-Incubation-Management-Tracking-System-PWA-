/**
 * COMPATIBILITY FACADE — the Venture assignment-scope layer moved to the service.
 *
 * This module resolved assignment scopes and ran its SQL in the same functions.
 * The decisions (the scope match, the failure postures) now live in
 * `@/services/ventures/scope`; every statement in `@/models/ventureScopeStore`.
 *
 * Re-exported unchanged so existing importers keep working. New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

import {
  GLOBAL_ROLES,
  isGlobalRole,
  resolveVentureCode,
  getAssignmentScopes,
  hasAnyVentureScope,
  hasVentureWideReach,
  isTaskInScope,
  resolveTaskContext,
  listTaskScopeContexts,
} from "@/services/ventures/scope";

export {
  GLOBAL_ROLES,
  isGlobalRole,
  resolveVentureCode,
  getAssignmentScopes,
  hasAnyVentureScope,
  hasVentureWideReach,
  isTaskInScope,
  resolveTaskContext,
  listTaskScopeContexts,
};

export default {
  GLOBAL_ROLES,
  isGlobalRole,
  resolveVentureCode,
  getAssignmentScopes,
  hasAnyVentureScope,
  hasVentureWideReach,
  isTaskInScope,
  resolveTaskContext,
  listTaskScopeContexts,
};
