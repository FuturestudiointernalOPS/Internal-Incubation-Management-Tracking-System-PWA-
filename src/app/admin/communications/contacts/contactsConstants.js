"use client";

import { INTERNAL_OPS_ROLES } from "@/lib/platform/roles";

export const STATUS_FILTER_LABELS = {
  All: "crm.contacts.filterAll",
  Active: "status.active",
  Approved: "crm.contacts.statusApproved",
  Pending: "crm.contacts.pendingApproval",
  Inactive: "crm.contacts.filterInactive",
  Archived: "status.archived",
};

export const CONTACT_STATUS_LABELS = {
  active: "status.active",
  pending: "crm.contacts.pendingApproval",
  inactive: "crm.contacts.statusInactive",
  approved: "crm.contacts.statusApproved",
  unassigned: "crm.contacts.unassigned",
};

export const INVITATION_STATUS_LABELS = {
  not_invited: "crm.contacts.invitationNotInvited",
  sent: "crm.contacts.invitationSent",
  activated: "crm.contacts.invitationActivated",
  expired: "crm.contacts.invitationExpired",
};

export const GROUP_LABELS = {
  UNASSIGNED: "crm.contacts.unassigned",
};

// Internal Future Studio staff are created manually (not via an invitation/application
// form) and therefore do not need an activation email — hide that status for them.
export const INTERNAL_ROLE_SET = new Set(INTERNAL_OPS_ROLES);
export const isInternalContact = (contact) =>
  INTERNAL_ROLE_SET.has(String(contact.role || "").toLowerCase()) ||
  String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO";

export const PROGRAMS_URL = "/api/pm/programs";

export const PAGE_SIZE = 50;

// Module scope on purpose: the hook mirrors what the caller passes, so these are
// built once here rather than on every render.
export const EMPTY_REGISTRY = { contacts: [], families: [], teams: [] };

/**
 * The registry rows for the current status filter.
 *
 * The loader this replaces painted the contacts, the families and the teams from
 * ONE answer, so they are shaped together: one read, and the three lists the rest
 * of the screen already reads separately.
 */
export const pickRegistry = (payload) => {
  if (!payload?.success) return EMPTY_REGISTRY;
  return {
    contacts: (payload.contacts || []).map((contact) => ({
      ...contact,
      invitation_status:
        contact.invitation_status ||
        (contact.status === "active" ? "activated" : "not_invited"),
    })),
    families: payload.families || [],
    teams: payload.teams || [],
  };
};

export const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);
