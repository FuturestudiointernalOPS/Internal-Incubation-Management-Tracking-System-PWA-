/**
 * milestoneEngine — Who may manage and complete milestones (Venture Manager / Super Admin).
 *
 * Part of `services/ventures/milestoneEngine` (split out of the former single
 * 548-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/milestoneEngine.js`.
 */
import {
  selectVentureIdAndCodeByIdOrCode,
} from "@/models/ventureMilestoneEngineStore";
import { hasVentureCapability } from "@/services/ventures/permissions";
import { resolveVenturePortfolioAccess } from "@/services/ventures/portfolioAccess";
import { rowsOf } from "./status";

/**
 * The ONE milestone authority: the matrix cell `milestones.edit`, or a Super
 * Admin. Structure and completion are the same act of authority, so both read
 * this same cell.
 *
 * Scope follows the other matrix consumers: the cell is venture-wide, so a
 * milestone-scoped assignment does not confer the right to restructure the
 * roadmap.
 */
export async function isMilestoneLeadAuthority({ code, cid, session }) {
  // The explicit portfolio WRITE right replaces the Super Admin role bypass, so
  // a revoked owner falls back to the assignment matrix like anyone else.
  if (session) {
    const portfolio = await resolveVenturePortfolioAccess({ session, action: "edit" });
    if (portfolio.allowed) return true;
  }
  if (!cid || !code) return false;
  try {
    return await hasVentureCapability({
      ventureId: code,
      contactId: cid,
      area: "milestones",
      action: "edit",
    });
  } catch (_) {
    return false;
  }
}

/** Resolve the VNT code of a Venture from either its code or internal UUID. */
export async function resolveVentureCode(id) {
  const result = await selectVentureIdAndCodeByIdOrCode(id).catch(() => ({ rows: [] }));
  const row = rowsOf(result)[0];
  if (!row) return null;
  return row.venture_id || (typeof id === "string" && id.startsWith("VNT-") ? id : null);
}

/**
 * Milestone STRUCTURE authority (add / remove / duplicate / reorder): the matrix
 * cell `milestones.edit`, or a Super Admin — the same cell that guards
 * completion (see isMilestoneLeadAuthority). Progress transitions are
 * deliberately NOT gated here — only structure and completion are (see the
 * milestones route).
 */
export async function canManageMilestones({ id, cid, session }) {
  if (!cid && !session) return false;
  const code = await resolveVentureCode(id);
  if (!code) return false;
  return isMilestoneLeadAuthority({ code, cid, session });
}
