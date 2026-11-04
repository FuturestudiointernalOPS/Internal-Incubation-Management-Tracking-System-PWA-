"use client";

/**
 * Shared membership building blocks for the CRM integration:
 * - STATUS_STYLE / ACCOUNT_STYLE / Badge  → consistent status visuals
 * - runMembershipAction                   → server-side PUT + toast
 *
 * All mutations go through PUT /api/org-membership, which enforces
 * org_membership.manage server-side (Super Admin bypass). The UI is never
 * the security boundary.
 */

export const notify = (type, message) =>
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );

export const STATUS_STYLE = {
  active: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  expiringSoon: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  expired: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
  ended: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
};

export const ACCOUNT_STYLE = {
  active: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  pending: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  invited: { bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  inactive: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
  rejected: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
};

export function Badge({ label, style }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: style.bg, color: style.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.color }} />
      {label}
    </span>
  );
}

/**
 * Execute a membership lifecycle action via PUT /api/org-membership.
 * Returns true on success (caller closes modal + reloads).
 */
export async function runMembershipAction(member, action, t, extra = {}) {
  try {
    const res = await fetch("/api/org-membership", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_cid: member.user_cid,
        group_name: member.group_name,
        action,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      notify("error", data.error || t("membership.mutate.error"));
      return false;
    }
    const successMessage = {
      joined: t("membership.add.success"),
      activated: t("membership.mutate.activateSuccess"),
      deactivated: t("membership.mutate.deactivateSuccess"),
      ended: t("membership.mutate.endSuccess"),
      renewed: t("membership.renew.success"),
    }[action];
    notify("success", successMessage || t("membership.mutate.activateSuccess"));
    return true;
  } catch {
    notify("error", t("membership.mutate.error"));
    return false;
  }
}
