/**
 * PROGRAM MANAGEMENT (SERVICE layer).
 *
 * D-1 — the program-manager function is a PROFILE, not a role label. This is the
 * one async decision the program-management surfaces share:
 *
 *   platform owner            → yes
 *   legacy program_manager    → yes (transitional sessions)
 *   baseline staff + profile  → yes
 *   everyone else             → no
 *
 * The role-only predicate stays synchronous in `@/server/authz/capabilities`.
 * This module adds the one piece that needs the resolved context (the active
 * profile keys) and fails closed on any lookup error.
 */

import { hasProgramManagementAccess } from "@/server/authz/capabilities";
import { getAuthorizationContext } from "./contextCache";

/**
 * @param {object|null|undefined} session the connected session
 * @returns {Promise<boolean>}
 */
export async function isProgramManagerProfileSession(session) {
  if (!session) return false;
  // Legacy sessions and unaligned rows still carry the role.
  if (session.role === "program_manager") return true;
  // Only a baseline staff identity can be upgraded by the profile.
  if (session.role !== "staff") return false;
  try {
    const context = await getAuthorizationContext(session);
    return (context?.profiles || []).includes("program_manager");
  } catch {
    return false; // fail closed: an unresolved profile is never a grant
  }
}

/**
 * The broader question: may this session act with program-wide management
 * authority? The platform owner always may; a program-manager profile does.
 */
export async function isProgramManagerSession(session) {
  if (!session) return false;
  // Fast path: platform owner and legacy program-manager sessions decide alone.
  if (hasProgramManagementAccess(session.role)) return true;
  return isProgramManagerProfileSession(session);
}
