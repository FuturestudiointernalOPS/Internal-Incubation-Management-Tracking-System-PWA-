"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import PendingUsersView from "@/components/admin/pending-users/PendingUsersView";

// The shape the screen renders from, so a failed or malformed payload never
// reaches an `Object.keys` / `Object.entries` read. Module scope keeps both the
// value and the normaliser stable for the hook (inline values would refetch on
// every render).
const EMPTY_PENDING_USERS = { pendingUsers: [], grouped: {}, total: 0 };
const pickPendingUsers = (payload) =>
  payload?.success
    ? { pendingUsers: payload.pendingUsers || [], grouped: payload.grouped || {}, total: payload.total || 0 }
    : EMPTY_PENDING_USERS;

export default function PendingUsersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [processingId, setProcessingId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [actionMsg, setActionMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no list state of its own and never sets state from an effect. Approve,
  // archive, reject and the refresh button call refresh(), which bypasses the
  // cache exactly like the old bypassCache argument did.
  const { data, loading, error: loadError, status: loadStatus, refresh } = useApi("/api/admin/pending-users", {
    defaultValue: EMPTY_PENDING_USERS,
    transform: pickPendingUsers,
  });
  const { pendingUsers, grouped, total } = data;

  // Groups start expanded, so the screen only remembers the ones the user
  // collapsed. Tracking the exceptions is what lets that choice survive a
  // refresh: the old effect re-expanded every group on each load, silently
  // undoing it.
  const isExpanded = (groupName) => !collapsedGroups[groupName];

  const handleApprove = async (userCid, userName) => {
    setProcessingId(userCid);
    setActionMsg(null);
    // Get selected role from dropdown
    const roleSelect = document.getElementById("role-" + userCid);
    const selectedRole = roleSelect ? roleSelect.value : "participant";
    try {
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_cid: userCid, admin_name: "super_admin", role: selectedRole }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          type: "success",
          text: t("adminMisc.pendingUsers.approvedToast", {
            name: userName,
            emailStatus: data.emailSent
              ? t("adminMisc.pendingUsers.emailSent")
              : t("adminMisc.pendingUsers.emailQueued"),
          }),
        });
        refresh();
      } else {
        setActionMsg({
          type: "error",
          text: t((data.error || t("adminMisc.pendingUsers.failApprove")) || "") || (data.error || t("adminMisc.pendingUsers.failApprove")),
        });
      }
    } catch {
      setActionMsg({
        type: "error",
        text: t("adminMisc.pendingUsers.networkApproveError"),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleArchive = async (userCid, userName) => {
    setProcessingId(userCid);
    setActionMsg(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: userCid, deleted: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          type: "success",
          text: t("adminMisc.pendingUsers.archivedToast", { name: userName }),
        });
        refresh();
      } else {
        setActionMsg({
          type: "error",
          text: t((data.error || t("adminMisc.pendingUsers.failArchive")) || "") || (data.error || t("adminMisc.pendingUsers.failArchive")),
        });
      }
    } catch {
      setActionMsg({
        type: "error",
        text: t("adminMisc.pendingUsers.networkError"),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleResendInvite = async (userCid, userName) => {
    setProcessingId(userCid);
    setActionMsg(null);
    try {
      const res = await fetch("/api/auth/resend-invite/" + userCid, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          type: "success",
          text: t("adminMisc.pendingUsers.inviteResentToast", {
            name: userName,
          }),
        });
      } else {
        setActionMsg({
          type: "error",
          text: t((data.error || t("adminMisc.pendingUsers.failResend")) || "") || (data.error || t("adminMisc.pendingUsers.failResend")),
        });
      }
    } catch {
      setActionMsg({
        type: "error",
        text: t("adminMisc.pendingUsers.networkError"),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userCid, userName) => {
    setProcessingId(userCid);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/reject-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_cid: userCid, admin_name: "super_admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          type: "info",
          text: t("adminMisc.pendingUsers.rejectedToast", { name: userName }),
        });
        refresh();
      } else {
        setActionMsg({
          type: "error",
          text: t((data.error || t("adminMisc.pendingUsers.failReject")) || "") || (data.error || t("adminMisc.pendingUsers.failReject")),
        });
      }
    } catch {
      setActionMsg({
        type: "error",
        text: t("adminMisc.pendingUsers.networkRejectError"),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = searchQuery
    ? pendingUsers.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : pendingUsers;

  const filteredGrouped = {};
  if (searchQuery) {
    // Re-group filtered results
    for (const user of filteredUsers) {
      const groupName = user.group_name || "UNASSIGNED";
      if (!filteredGrouped[groupName]) filteredGrouped[groupName] = [];
      filteredGrouped[groupName].push(user);
    }
  }

  const displayGrouped = searchQuery ? filteredGrouped : grouped;

  return (
    <PendingUsersView
      t={t}
      loading={loading}
      loadError={loadError}
      loadStatus={loadStatus}
      actionMsg={actionMsg}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      displayGrouped={displayGrouped}
      grouped={grouped}
      total={total}
      isExpanded={isExpanded}
      setCollapsedGroups={setCollapsedGroups}
      processingId={processingId}
      onRefresh={refresh}
      onBulkUpload={() => router.push("/admin/bulk-upload")}
      handleApprove={handleApprove}
      handleArchive={handleArchive}
      handleResendInvite={handleResendInvite}
      handleReject={handleReject}
    />
  );
}
