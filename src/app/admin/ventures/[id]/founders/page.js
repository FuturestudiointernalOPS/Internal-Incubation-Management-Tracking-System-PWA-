"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import VentureFoundersView from "@/components/admin/ventures/VentureFoundersView";

const EMPTY_LIST = [];

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);
const pickFounders = (payload) => (payload?.success ? payload.founders || [] : []);

const ROLE_COLORS = {
  founder: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "co-founder": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  ceo: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  cto: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  advisor: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  observer: "text-slate-500 bg-slate-500/5 border-slate-500/10",
};

export default function VentureFoundersPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "co-founder" });
  const [inviting, setInviting] = useState(false);
  const [, setInviteResult] = useState(null);

  // Transfer ownership modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState(null);

  // Success/Error toast
  const [toast, setToast] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Menu
  const [openMenuId, setOpenMenuId] = useState(null);

  // The Venture and its founders, through the shared hook: it owns the cache,
  // the cache-first paint and the discarding of a stale answer, so the page
  // keeps no copy of its own and reads during render. Two separate reads keep
  // the Venture identifier a plain dependency rather than a list rebuilt on
  // every render.
  const {
    data: venture,
    loading: ventureLoading,
    error: ventureFailed,
    refresh: refreshVenture,
  } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickVenture,
    deps: [id],
  });
  const {
    data: founders,
    loading: foundersLoading,
    error: foundersFailed,
    refresh: refreshFounders,
  } = useApi(id ? `/api/ventures/${id}/founders` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickFounders,
    deps: [id],
  });

  const loading = ventureLoading || foundersLoading;

  // Every action below re-reads both, so the list and the Venture come from the
  // reads that painted them.
  const reload = () => {
    refreshVenture();
    refreshFounders();
  };

  // Which failure the panel below reports: the network's, or a read that came
  // back without a Venture.
  const error = ventureFailed
    ? t("vadmin.founders.loadVentureFailed")
    : foundersFailed
      ? t("vadmin.founders.loadFoundersFailed")
      : !venture
        ? t("vadmin.founders.ventureNotFound")
        : null;

  const notify = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.name.trim() || !inviteForm.role) {
      notify(t("vadmin.founders.fillRequiredFields"), "error");
      return;
    }

    setInviting(true);
    setInviteResult(null);
    try {
      const response = await fetch(`/api/ventures/${id}/founders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await response.json();

      if (data.success) {
        notify(t("vadmin.founders.inviteSent", { name: inviteForm.name }));
        setShowInviteModal(false);
        setInviteForm({ email: "", name: "", role: "co-founder" });
        reload();
      } else {
        notify(t((data.error || t("vadmin.founders.inviteFailed")) || "") || (data.error || t("vadmin.founders.inviteFailed")), "error");
      }
    } catch {
      notify(t("vadmin.founders.networkError"), "error");
    } finally {
      setInviting(false);
    }
  };

  const _handleTransferOwnership = async () => {
    if (!transferTarget) return;

    setTransferring(true);
    try {
      const response = await fetch(`/api/ventures/${id}/founders/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_owner_id: parseInt(transferTarget) }),
      });
      const data = await response.json();

      if (data.success) {
        notify(t("vadmin.founders.ownershipTransferredSuccess"));
        setShowTransferModal(false);
        setTransferTarget("");
        setConfirmAction(null);
        reload();
      } else {
        notify(t((data.error || t("vadmin.founders.transferFailed")) || "") || (data.error || t("vadmin.founders.transferFailed")), "error");
        setConfirmAction(null);
      }
    } catch {
      notify(t("vadmin.founders.networkError"), "error");
    } finally {
      setTransferring(false);
    }
  };

  const handleSuspend = async (founderId) => {
    try {
      const response = await fetch(`/api/ventures/${id}/founders/${founderId}/suspend`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        notify(t("vadmin.founders.userSuspended"));
        setOpenMenuId(null);
        reload();
      } else {
        notify(t((data.error || t("vadmin.founders.suspendFailed")) || "") || (data.error || t("vadmin.founders.suspendFailed")), "error");
      }
    } catch {
      notify(t("vadmin.founders.networkError"), "error");
    }
  };

  const handleReactivate = async (founderId) => {
    try {
      const response = await fetch(`/api/ventures/${id}/founders/${founderId}/reactivate`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        notify(t("vadmin.founders.userReactivated"));
        setOpenMenuId(null);
        reload();
      } else {
        notify(t((data.error || t("vadmin.founders.reactivateFailed")) || "") || (data.error || t("vadmin.founders.reactivateFailed")), "error");
      }
    } catch {
      notify(t("vadmin.founders.networkError"), "error");
    }
  };

  const handleRemove = async (founderId) => {
    try {
      const response = await fetch(`/api/ventures/${id}/founders/${founderId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        notify(t("vadmin.founders.founderRemoved"));
        setOpenMenuId(null);
        setConfirmAction(null);
        reload();
      } else {
        notify(t((data.error || t("vadmin.founders.removeFailed")) || "") || (data.error || t("vadmin.founders.removeFailed")), "error");
        setConfirmAction(null);
      }
    } catch {
      notify(t("vadmin.founders.networkError"), "error");
    }
  };

  const handleRoleUpdate = async (founderId, newRole) => {
    try {
      const response = await fetch(`/api/ventures/${id}/founders/${founderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("vadmin.founders.roleUpdated"));
        setOpenMenuId(null);
        reload();
      } else {
        notify(t((data.error || t("vadmin.founders.roleUpdateFailed")) || "") || (data.error || t("vadmin.founders.roleUpdateFailed")), "error");
      }
    } catch {
      notify(t("vadmin.founders.networkError"), "error");
    }
  };

  const getRoleColor = (role) => {
    return ROLE_COLORS[role] || "text-blue-400 bg-blue-500/10 border-blue-500/20";
  };

  const filteredFounders = founders.filter((founder) => {
    if (!searchQuery) return true;
    const normalizedQuery = searchQuery.toLowerCase();
    return (
      founder.name?.toLowerCase().includes(normalizedQuery) ||
      founder.email?.toLowerCase().includes(normalizedQuery) ||
      founder.role?.toLowerCase().includes(normalizedQuery)
    );
  });
  const ctx = {
    loading,
    confirmAction,
    error,
    filteredFounders,
    founders,
    getRoleColor,
    handleInvite,
    handleReactivate,
    handleRemove,
    handleRoleUpdate,
    handleSuspend,
    id,
    inviteForm,
    inviting,
    notify,
    openMenuId,
    reload,
    router,
    searchQuery,
    setConfirmAction,
    setInviteForm,
    setOpenMenuId,
    setSearchQuery,
    setShowInviteModal,
    setShowTransferModal,
    setTransferTarget,
    setTransferring,
    showInviteModal,
    showTransferModal,
    t,
    toast,
    transferring,
    venture,
  };

  return <VentureFoundersView ctx={ctx} />;
}
