"use client";

import { useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { deriveMembershipStatus, sortGroups } from "@/lib/membership-ui";
import { runMembershipAction } from "@/components/membership/MembershipModals";

const MEMBERSHIP_URL = "/api/org-membership";

// ─── Read shapers (module scope: built once, never per render) ───────────

// The hook keys its internal work on the address alone, so the default and the
// shaper are made once here rather than on every render.
const EMPTY_MEMBERSHIP = { members: [], protectedMap: {}, failure: null };

/**
 * The roster, together with the groups whose last member must not be removed,
 * and the reason they are missing. A refusal carries the server's own message.
 */
const pickMembership = (payload) =>
  payload?.success
    ? { members: payload.memberships || [], protectedMap: payload.protected || {}, failure: null }
    : { members: [], protectedMap: {}, failure: payload?.error || null };

export function useMembershipState({
  readOnly = false,
  effectiveAccessHref = "/admin/security/permissions/people",
} = {}) {
  const { t, lang } = useI18n();
  const [selectedGroup, setSelectedGroup] = useState(""); // "" = all groups
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailMember, setDetailMember] = useState(null);
  const [renewMember, setRenewMember] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { member, action }
  const [historyMember, setHistoryMember] = useState(null);

  // The roster is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the screen keeps
  // no copy of its own and reads during render.
  const {
    data,
    loading,
    error: readError,
    status,
    refresh,
  } = useApi(MEMBERSHIP_URL, {
    defaultValue: EMPTY_MEMBERSHIP,
    transform: pickMembership,
  });
  const members = data.members;
  const protectedMap = data.protectedMap;

  // Three shapes of failure reach the screen: the server refusing (a status),
  // the payload reporting its own failure (a message), and a request that never
  // got an answer (an error).
  const loadFailed = Boolean(
    data.failure || readError || (status !== null && status >= 400),
  );

  const groups = useMemo(
    () =>
      sortGroups(
        [...new Set((members || []).map((member) => member.group_name).filter(Boolean))].map((name) => ({
          name,
          isProtected: !!protectedMap[name],
        })),
      ),
    [members, protectedMap],
  );

  const roles = useMemo(
    () => [...new Set((members || []).map((member) => member.role).filter(Boolean))].sort(),
    [members],
  );

  const fmtDate = useCallback(
    (value) => {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
    [lang],
  );

  const statusKey = (status) => {
    switch (status) {
      case "expiringSoon":
        return t("membership.status.expiringSoon");
      case "expired":
        return t("membership.status.expired");
      case "ended":
        return t("membership.status.ended");
      default:
        return t("membership.status.active");
    }
  };

  const accountKey = (status) => {
    const normalized = String(status || "").toLowerCase();
    switch (normalized) {
      case "active":
        return t("membership.status.accountActive");
      case "pending":
        return t("membership.status.accountPending");
      case "invited":
        return t("membership.status.accountInvited");
      case "inactive":
      case "rejected":
        return t("membership.status.accountInactive");
      default:
        return t("membership.status.accountUnknown");
    }
  };

  const filtered = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return (members || []).filter((member) => {
      if (selectedGroup && member.group_name !== selectedGroup) return false;
      if (normalizedQuery && !(member.name || "").toLowerCase().includes(normalizedQuery) && !(member.email || "").toLowerCase().includes(normalizedQuery)) return false;
      const derived = deriveMembershipStatus(member);
      if (statusFilter !== "all" && derived !== statusFilter) return false;
      if (accountFilter !== "all" && String(member.account_status || "").toLowerCase() !== accountFilter) return false;
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      return true;
    });
  }, [members, selectedGroup, search, statusFilter, accountFilter, roleFilter]);

  const reload = () => {
    setDetailMember(null);
    setHistoryMember(null);
    refresh();
  };

  const handleAction = async () => {
    if (!confirmState) return;
    const ok = await runMembershipAction(confirmState.member, confirmState.action, t);
    if (ok) {
      setConfirmState(null);
      reload();
    }
  };

  const handleRenew = async (expiresAt) => {
    if (!renewMember) return false;
    const ok = await runMembershipAction(renewMember, "renewed", t, {
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    if (ok) {
      setRenewMember(null);
      reload();
    }
    return ok;
  };

  const isProtected = (name) => !!protectedMap[name];

  return {
    t,
    lang,
    readOnly,
    effectiveAccessHref,
    selectedGroup,
    setSelectedGroup,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    accountFilter,
    setAccountFilter,
    roleFilter,
    setRoleFilter,
    addOpen,
    setAddOpen,
    detailMember,
    setDetailMember,
    renewMember,
    setRenewMember,
    confirmState,
    setConfirmState,
    historyMember,
    setHistoryMember,
    members,
    loading,
    loadFailed,
    groups,
    roles,
    filtered,
    fmtDate,
    statusKey,
    accountKey,
    reload,
    handleAction,
    handleRenew,
    isProtected,
  };
}
