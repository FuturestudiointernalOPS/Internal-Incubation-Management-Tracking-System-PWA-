/**
 * VENTURE FOUNDERS / CO-FOUNDERS.
 *
 * The founder roster of a Venture: its role catalogue, the manage check, the
 * roster read, invitation / re-invitation, role and detail edits, removal (with
 * the last-owner guards), ownership transfer, and suspension / reactivation.
 *
 * The decisions — who may manage, whether a removal is safe, which founder
 * lookup branch applies, how the invitation token and expiry are built — live
 * here; every statement is in `@/models/ventureFoundersStore`. Nothing here runs
 * SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import { v4 as uuidv4 } from "uuid";
import {
  selectFounderForManage,
  selectFoundersForVenture,
  selectFounderById,
  selectFounderByEmail,
  selectFounderByContactId,
  selectFounderIdAndStatusByEmail,
  selectFounderIdByEmail,
  countAcceptedFounders,
  countOtherAcceptedFounders,
  resendFounderInvitation,
  insertFounderInvitation,
  updateFounderColumns,
  deleteFounderRow,
  insertOwnershipHistory,
  clearFounderOwner,
  setFounderOwner,
  suspendFounderRow,
  reactivateFounderRow,
} from "@/models/ventureFoundersStore";
import { logVentureActivity } from "@/services/ventures/activity";

/**
 * Supported roles for venture founders/team members.
 */
export const VENTURE_ROLES = [
  "founder",
  "co-founder",
  "ceo",
  "cto",
  "coo",
  "cfo",
  "cmo",
  "cpo",
  "cio",
  "product_manager",
  "engineering_manager",
  "marketing_lead",
  "sales_lead",
  "operations_lead",
  "finance_lead",
  "hr_lead",
  "legal_lead",
  "advisor",
  "observer",
];

export const VENTURE_ROLE_LABELS = {
  founder: "Founder",
  "co-founder": "Co-Founder",
  ceo: "CEO",
  cto: "CTO",
  coo: "COO",
  cfo: "CFO",
  cmo: "CMO",
  cpo: "CPO",
  cio: "CIO",
  product_manager: "Product Manager",
  engineering_manager: "Engineering Manager",
  marketing_lead: "Marketing Lead",
  sales_lead: "Sales Lead",
  operations_lead: "Operations Lead",
  finance_lead: "Finance Lead",
  hr_lead: "HR Lead",
  legal_lead: "Legal Lead",
  advisor: "Advisor",
  observer: "Observer",
};

/**
 * Roles that have full management permissions.
 */
export const MANAGEMENT_ROLES = ["founder", "co-founder"];

/**
 * Check if a user can manage founders for a venture.
 * Only the owner (is_owner), founders, and super_admin can manage.
 */
export async function canManageFounders(ventureId, session) {
  if (!session) return { allowed: false };
  if (session.role === "super_admin") return { allowed: true, isOwner: true };

  const founderRes = await selectFounderForManage(ventureId, session.email || "");

  if (founderRes.rows.length === 0) {
    return { allowed: false };
  }

  const founder = founderRes.rows[0];
  const allowed = founder.is_owner || MANAGEMENT_ROLES.includes(founder.role);

  return {
    allowed,
    isOwner: !!founder.is_owner,
    founderId: founder.id,
    role: founder.role,
  };
}

/**
 * List all founders for a venture with full details.
 */
export async function listFounders(ventureId) {
  const res = await selectFoundersForVenture(ventureId);

  return res.rows.map((founder) => ({
    ...founder,
    role_label: VENTURE_ROLE_LABELS[founder.role] || founder.role,
    is_suspended: !!founder.suspended_at,
    invitation_expired: founder.invitation_expires_at
      ? new Date(founder.invitation_expires_at) < new Date()
      : false,
  }));
}

/**
 * Get a single founder by ID.
 */
export async function getFounderById(founderId) {
  // Support lookup by numeric ID, CID (USR-...), or email
  let res;
  if (!isNaN(founderId)) {
    // Numeric ID (venture_founders.id)
    res = await selectFounderById(parseInt(founderId));
  } else if (typeof founderId === "string" && founderId.includes("@")) {
    // Email
    res = await selectFounderByEmail(founderId);
  } else {
    // CID (USR-...) — look up by contact_id
    res = await selectFounderByContactId(founderId);
  }
  return res.rows[0] || null;
}

/**
 * Invite a founder / co-founder / executive to a venture.
 * Generates a secure invitation token with expiration.
 */
export async function inviteFounder({
  ventureId,
  email,
  name,
  role,
  expiresInHours = 72, // 3 days default
}) {
  // Validate role
  if (!VENTURE_ROLES.includes(role)) {
    throw new Error(`Invalid role: "${role}". Must be one of: ${VENTURE_ROLES.join(", ")}`);
  }

  // Check for existing founder with same email
  const existing = await selectFounderIdAndStatusByEmail(ventureId, email.trim());

  if (existing.rows.length > 0) {
    const founder = existing.rows[0];
    if (founder.status === "accepted") {
      throw new Error("A founder with this email already exists and has accepted.");
    }
    // Re-send invitation for pending founders
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    await resendFounderInvitation(founder.id, token, expiresAt, role, name.trim());

    return { id: founder.id, token, expires_at: expiresAt, isResend: true };
  }

  // Create new founder record
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  await insertFounderInvitation(ventureId, email.trim().toLowerCase(), name.trim(), role, token, expiresAt);

  // Get the new founder ID
  const newRes = await selectFounderIdByEmail(ventureId, email.trim());

  return { id: newRes.rows[0]?.id, token, expires_at: expiresAt, isResend: false };
}

/**
 * Update a founder's role and details.
 */
export async function updateFounderRole({ founderId, role, title, phone, name }) {
  if (role && !VENTURE_ROLES.includes(role)) {
    throw new Error(`Invalid role: "${role}".`);
  }

  const sets = [];
  const args = [];

  if (role) { sets.push("role = ?"); args.push(role); }
  if (title !== undefined) { sets.push("title = ?"); args.push(title); }
  if (phone !== undefined) { sets.push("phone = ?"); args.push(phone); }
  if (name !== undefined) { sets.push("name = ?"); args.push(name); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(founderId);

  await updateFounderColumns(sets, args);

  return { updated: true };
}

/**
 * Remove a founder from a venture.
 * Validates: cannot remove last founder, cannot remove current owner without transfer.
 */
export async function removeFounder({ founderId, ventureId, removedByFounderId }) {
  const founder = await getFounderById(founderId);
  if (!founder) throw new Error("Founder not found.");
  if (founder.venture_id !== ventureId) throw new Error("Founder does not belong to this venture.");

  // Check if this is the last founder
  const countRes = await countAcceptedFounders(ventureId);
  const activeCount = parseInt(countRes.rows[0]?.cnt || 0);

  if (activeCount <= 1 && founder.is_owner) {
    throw new Error("Cannot remove the last owner. Transfer ownership first.");
  }

  // Check if founder is the owner and there are other accepted founders
  if (founder.is_owner) {
    const otherActive = await countOtherAcceptedFounders(ventureId, founderId);
    if (parseInt(otherActive.rows[0]?.cnt || 0) === 0) {
      throw new Error("Cannot remove the owner without another active founder. Transfer ownership first.");
    }
  }

  // Log activity before deleting
  try {
    await logVentureActivity({
      venture_id: ventureId,
      action: "FOUNDER_REMOVED",
      actor_cid: String(removedByFounderId || "system"),
      actor_name: "System",
      details: { removed_founder_id: founderId, removed_email: founder.email, role: founder.role },
    });
  } catch (_) {}

  // Delete the founder
  await deleteFounderRow(founderId, ventureId);

  return { success: true };
}

/**
 * Transfer ownership to another founder.
 * Rules: Only current owner can transfer. Cannot transfer to suspended/inactive users.
 */
export async function transferOwnership({ ventureId, currentOwnerId, newOwnerId, transferredByFounderId }) {
  const currentOwner = await getFounderById(currentOwnerId);
  if (!currentOwner) throw new Error("Current owner not found.");
  if (!currentOwner.is_owner) throw new Error("Only the current owner can transfer ownership.");
  if (currentOwner.venture_id !== ventureId) throw new Error("Owner does not belong to this venture.");

  const newOwner = await getFounderById(newOwnerId);
  if (!newOwner) throw new Error("New owner not found.");
  if (newOwner.venture_id !== ventureId) throw new Error("New owner does not belong to this venture.");
  if (newOwner.suspended_at) throw new Error("Cannot transfer ownership to a suspended user.");
  if (newOwner.status !== "accepted") throw new Error("Cannot transfer ownership to an inactive user.");
  if (newOwner.id === currentOwner.id) throw new Error("Cannot transfer ownership to yourself.");

  // Record ownership history (append-only)
  await insertOwnershipHistory({
    ventureId,
    previousOwnerId: currentOwner.id,
    previousOwnerEmail: currentOwner.email,
    previousOwnerName: currentOwner.name,
    newOwnerId: newOwner.id,
    newOwnerEmail: newOwner.email,
    newOwnerName: newOwner.name,
    transferredById: transferredByFounderId || currentOwner.id,
    transferredByEmail: currentOwner.email,
  });

  // Transfer ownership: new owner gets is_owner, old owner loses it
  await clearFounderOwner(currentOwner.id);

  await setFounderOwner(newOwner.id);

  // Log activity
  try {
    await logVentureActivity({
      venture_id: ventureId,
      action: "OWNERSHIP_TRANSFERRED",
      actor_cid: String(transferredByFounderId || currentOwner.id),
      actor_name: currentOwner.name,
      details: {
        from_id: currentOwner.id,
        from_email: currentOwner.email,
        to_id: newOwner.id,
        to_email: newOwner.email,
      },
    });
  } catch (_) {}

  return { success: true, previous_owner: currentOwner.email, new_owner: newOwner.email };
}

/**
 * Suspend a founder.
 */
export async function suspendFounder({ founderId, ventureId, suspendedByFounderId }) {
  const founder = await getFounderById(founderId);
  if (!founder) throw new Error("Founder not found.");
  if (founder.venture_id !== ventureId) throw new Error("Founder does not belong to this venture.");
  if (founder.is_owner) throw new Error("Cannot suspend the owner. Transfer ownership first.");
  if (founder.suspended_at) throw new Error("Founder is already suspended.");

  await suspendFounderRow(String(suspendedByFounderId || "system"), founderId);

  // Log activity
  try {
    await logVentureActivity({
      venture_id: ventureId,
      action: "USER_SUSPENDED",
      actor_cid: String(suspendedByFounderId || "system"),
      actor_name: "System",
      details: { founder_id: founderId, email: founder.email, role: founder.role },
    });
  } catch (_) {}

  return { success: true };
}

/**
 * Reactivate a suspended founder.
 */
export async function reactivateFounder({ founderId, ventureId, reactivatedByFounderId }) {
  const founder = await getFounderById(founderId);
  if (!founder) throw new Error("Founder not found.");
  if (founder.venture_id !== ventureId) throw new Error("Founder does not belong to this venture.");
  if (!founder.suspended_at) throw new Error("Founder is not suspended.");

  await reactivateFounderRow(founderId);

  // Log activity
  try {
    await logVentureActivity({
      venture_id: ventureId,
      action: "USER_REACTIVATED",
      actor_cid: String(reactivatedByFounderId || "system"),
      actor_name: "System",
      details: { founder_id: founderId, email: founder.email },
    });
  } catch (_) {}

  return { success: true };
}
