"use client";
// Updated Role Override per user request

import React, { useState, useEffect, useCallback, Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Plus,
  Users,
  Mail,
  Phone,
  Search,
  X,
  CheckCircle,
  Edit3,
  Shield,
  Key,
  Send,
  Archive,
  ArrowLeft,
  Trash2,
  RotateCcw,
  Link as LinkIcon,
  Check,
  UserCheck,
  UserX,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { motion, AnimatePresence } from "framer-motion";
import { TableSkeleton } from "@/components/ui/Skeleton";

const STATUS_FILTER_LABELS = {
  All: "crm.contacts.filterAll",
  Active: "status.active",
  Approved: "crm.contacts.statusApproved",
  Pending: "crm.contacts.pendingApproval",
  Inactive: "crm.contacts.filterInactive",
  Archived: "status.archived",
};

const CONTACT_STATUS_LABELS = {
  active: "status.active",
  pending: "crm.contacts.pendingApproval",
  inactive: "crm.contacts.statusInactive",
  approved: "crm.contacts.statusApproved",
  unassigned: "crm.contacts.unassigned",
};

const INVITATION_STATUS_LABELS = {
  not_invited: "crm.contacts.invitationNotInvited",
  sent: "crm.contacts.invitationSent",
  activated: "crm.contacts.invitationActivated",
  expired: "crm.contacts.invitationExpired",
};

const GROUP_LABELS = {
  UNASSIGNED: "crm.contacts.unassigned",
};

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const { t } = useI18n();
  const goBack = useSafeBack("/admin/crm");

  const [contacts, setContacts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [teams, setTeams] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Contacts");
  const [selectedTeamTab, setSelectedTeamTab] = useState("All Teams");
  const [copiedGroup, setCopiedGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { id, message, onConfirm } or null
  const [contactPrograms, setContactPrograms] = useState([]);
  const [showBulkProgramModal, setShowBulkProgramModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);

  // Forms
  const [form, setForm] = useState({
    cid: "",
    name: "",
    email: "",
    phone: "",
    group_name: "",
  });
  const [showGroupModal, setShowGroupModal] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("individual");
  const [newGroupProgramId, setNewGroupProgramId] = useState("");

  // Group Keys
  const [showGroupKeysModal, setShowGroupKeysModal] = useState(null);
  const [groupKeysForm, setGroupKeysForm] = useState({
    id: "",
    name: "",
    shared_email: "",
    shared_password_read: "",
    shared_password_edit: "",
  });

  // Feedback
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All"); // All, Active, Inactive, Archived

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (roleParam) {
      const normalized =
        roleParam.toLowerCase() === "staff" ? "Future Studio" : roleParam;
      setSelectedGroup(normalized);
    }
  }, [roleParam]);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    } catch (e) {
      // ignore parse error
    }
  }, []);

  useEffect(() => {
    setSelectedTeamTab("All Teams");
  }, [selectedGroup]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter === "Archived" ? "?status=archived" : "";
      const [contRes, progRes] = await Promise.all([
        fetch(`/api/contacts/full-state${statusParam}`),
        fetch("/api/pm/programs"),
      ]);
      const [contData, progData] = await Promise.all([
        contRes.json(),
        progRes.json(),
      ]);

      if (contData.success) {
        const rows = (contData.contacts || []).map((c) => ({
          ...c,
          invitation_status:
            c.invitation_status ||
            (c.status === "active" ? "activated" : "not_invited"),
        }));
        setContacts(rows);
        setFamilies(contData.families || []);
        setTeams(contData.teams || []);
      }
      if (progData.success) setPrograms(progData.programs || []);
    } catch (e) {
      console.error("Registry Sync Failure:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleStatus = async (cid, currentStatus, currentGroup) => {
    const newStatus =
      currentStatus === "active" || currentStatus === "approved"
        ? "inactive"
        : "active";
    const payload = { cid, status: newStatus };
    // Role is auto-derived by the API from group membership
    try {
      await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResendActivation = async (c) => {
    if (!confirm(t("crm.contacts.confirmResendActivation") || `Resend activation email to ${c.name}?`)) return;
    setIsProcessing(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: c.email }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", text: t("crm.contacts.activationSent") || "Activation email sent" });
        fetchData();
      } else {
        setNotification({ type: "error", text: data.error || "Failed to send email" });
      }
    } catch (e) {
      setNotification({ type: "error", text: "Error sending email" });
    }
    setIsProcessing(false);
  };

  const handleInviteContact = async (c) => {
    if (!confirm(t("crm.contacts.confirmInvite") || `Send an invitation to ${c.name}?`)) return;
    setIsProcessing(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: c.email,
          name: c.name,
          role: c.role || "participant",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", text: t("crm.contacts.invitationSent") || "Invitation sent" });
        fetchData();
      } else {
        setNotification({ type: "error", text: data.error || "Failed to send invitation" });
      }
    } catch (e) {
      setNotification({ type: "error", text: "Error sending invitation" });
    }
    setIsProcessing(false);
  };

  const handleSaveContact = async () => {
    setIsProcessing(true);
    try {
      const payload = { ...form, program_ids: contactPrograms };
      // Remove role if empty to let API auto-detect
      if (!payload.role) delete payload.role;
      const method = form.cid ? "PUT" : "POST";
      // Manual creation by super admin is implicit approval — set active
      if (method === "POST") payload.status = "active";
      const res = await fetch("/api/contacts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowManualModal(false);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsProcessing(true);
    try {
      const isEdit = showGroupModal && typeof showGroupModal === "object";
      const res = await fetch("/api/families", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? showGroupModal.id : undefined,
          name: newGroupName.trim(),
          type: newGroupType,
          program_id: newGroupProgramId || null,
        }),
      });
      if ((await res.json()).success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowGroupModal(null);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSaveGroupKeys = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/families", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupKeysForm),
      });
      if ((await res.json()).success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowGroupKeysModal(null);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleArchive = async (c) => {
    setIsProcessing(true);
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : {};
      const archivedBy = user.name || user.email || "unknown";
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: c.cid,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.archivedToast", { name: c.name }) },
          }),
        );
        fetchData();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((data.error || t("crm.contacts.archiveFailed")) || "") || (data.error || t("crm.contacts.archiveFailed")),
            },
          }),
        );
      }
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (c) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: c.cid,
          archived_at: null,
          archived_by: null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.restoredToast", { name: c.name }) },
          }),
        );
        fetchData();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((data.error || t("crm.contacts.restoreFailed")) || "") || (data.error || t("crm.contacts.restoreFailed")),
            },
          }),
        );
      }
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSoftDelete = (c) => {
    setConfirmTarget({
      id: c.cid,
      message: t("crm.contacts.deleteConfirm", { name: c.name }),
      onConfirm: () => performSoftDelete(c),
    });
  };

  const performSoftDelete = async (c) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/contacts?cid=${encodeURIComponent(c.cid)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.permanentlyDeletedToast", { name: c.name }) },
          }),
        );
        fetchData();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((data.error || t("crm.contacts.deleteFailed")) || "") || (data.error || t("crm.contacts.deleteFailed")),
            },
          }),
        );
      }
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const copyJoinLink = async (groupName) => {
    let link = `${window.location.origin}/register-staff?group=${encodeURIComponent(groupName)}`;
    try {
      const gRes = await fetch(`/api/groups?search=${encodeURIComponent(groupName)}`);
      const gData = await gRes.json();
      if (gData.success && gData.groups && gData.groups.length > 0) {
        const group = gData.groups[0];
        const regId = group.registration_id || group.id;
        const frRes = await fetch(`/api/platform/form-runs?group_id=${encodeURIComponent(regId)}`);
        const frData = await frRes.json();
        if (frData.success && frData.runs && frData.runs.length > 0) {
          link = `${window.location.origin}/s/${frData.runs[0].public_slug}`;
        }
      }
    } catch (_) {}
    navigator.clipboard.writeText(link);
    setCopiedGroup(groupName);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  // Reset page when any filter changes
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, selectedGroup, selectedTeamTab]);

  const filtered = contacts.filter((c) => {
    const lowerSearch = search.toLowerCase();
    const matchesSearch =
      (c.name || "").toLowerCase().includes(lowerSearch) ||
      (c.email || "").toLowerCase().includes(lowerSearch);
    const matchesGroup =
      selectedGroup === "All Contacts" ||
      c.group_name?.toUpperCase() === selectedGroup.toUpperCase();

    // Nested Sub-team Filter
    const matchesTeam =
      selectedTeamTab === "All Teams" || c.v2_team_id === selectedTeamTab;

    let matchesStatus = true;
    if (statusFilter === "Active")
      matchesStatus = c.status === "active";
    else if (statusFilter === "Approved")
      matchesStatus = c.status === "approved";
    else if (statusFilter === "Pending")
      matchesStatus = c.status === "pending";
    else if (statusFilter === "Inactive")
      matchesStatus = c.status === "inactive";
    else if (statusFilter === "All")
      matchesStatus = true;
    // "Archived" is filtered server-side

    return (
      matchesSearch &&
      matchesGroup &&
      matchesTeam &&
      matchesStatus
    );
  });

  // Segment counts — how many contacts belong to each segment (used for the
  // sidebar badges; "All Contacts" shows the total in the current view).
  const segmentCounts = {};
  for (const c of contacts) {
    if (c.status === "pending") continue;
    const key = String(c.group_name || "UNASSIGNED").toUpperCase();
    segmentCounts[key] = (segmentCounts[key] || 0) + 1;
  }

  const handlePivotToEntity = async (c) => {
    setIsProcessing(true);
    try {
      const entityName = `${c.name} Entity`;
      await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entityName,
          type: "company",
          program_id: null,
        }),
      });
      await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: c.cid, group_name: entityName }),
      });
      setNotification({ type: "success", message: t("crm.contacts.done") });
      fetchData();
    } catch (e) {
      console.error("Pivot Error:", e);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="communication" fullWidth>
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[600] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 ${notification.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span className="text-xs font-bold uppercase tracking-widest">
              {notification.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-10 pb-20 animate-in text-left">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToPrevious")}
          </button>
          <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToCrm")}
          </Link>
        </nav>

        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em]">
                  {t("crm.contacts.contact")}
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                {t("crm.contacts.contactsTitle")}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {statusFilter !== "Archived" && (
              <>
                <button
                  onClick={() => {
                    setForm({
                      cid: "",
                      name: "",
                      email: "",
                      phone: "",
                      group_name: "",
                      program_id: "",
                    });
                    setContactPrograms([]);
                    setShowManualModal(true);
                  }}
                  className="btn btn-primary gap-2"
                >
                  <Plus className="w-4 h-4" /> {t("crm.contacts.addMember")}
                </button>
                <button
                  onClick={() => setShowBulkProgramModal(true)}
                  className="btn btn-secondary gap-2"
                >
                  <Users className="w-4 h-4" /> {t("crm.contacts.bulkAssign")}
                </button>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-1 space-y-6">
            <div className="card space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-2 mb-3">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("crm.contacts.segments")}
                  </p>
                  <button
                    onClick={() => setShowGroupModal(true)}
                    className="text-[10px] font-bold text-[var(--brand-orange)] hover:opacity-80 uppercase tracking-widest flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t("crm.contacts.new")}
                  </button>
                </div>
                {["All Contacts", ...families].map((f) => {
                  const name = typeof f === "string" ? f : f.name;
                  const isAll = name === "All Contacts";
                  return (
                    <div key={name} className="flex gap-2 group items-center">
                      <button
                        onClick={() => setSelectedGroup(name)}
                        className={`flex-1 flex items-center justify-between gap-2 text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${selectedGroup === name ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-primary"}`}
                      >
                        <span className="break-words whitespace-normal">
                          {isAll ? t("crm.contacts.allContacts") : name} {!!f.is_archived && t("crm.contacts.archivedSuffix")}
                        </span>
                        <span className={`shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full ${selectedGroup === name ? "bg-black/20" : "bg-tertiary"}`}>
                          {isAll ? contacts.length : segmentCounts[String(name).toUpperCase()] || 0}
                        </span>
                      </button>
                      {!isAll && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setNewGroupName(f.name);
                              setNewGroupType(f.type);
                              setNewGroupProgramId(f.program_id);
                              setShowGroupModal(f);
                            }}
                            title={t("crm.contacts.editSegment")}
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-[var(--brand-orange)]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setGroupKeysForm({ ...f });
                              setShowGroupKeysModal(f);
                            }}
                            title={t("crm.contacts.accessKeys")}
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-blue-500"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyJoinLink(name)}
                            title={t("crm.contacts.copyJoinLink")}
                            className={`p-2.5 rounded-lg border border-[var(--border-primary)] transition-all ${copiedGroup === name ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-primary text-slate-500 hover:text-[var(--brand-orange)]"}`}
                          >
                            {copiedGroup === name ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <LinkIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-6">
            {/* Unified toolbar: search + status tabs + result count + bulk actions */}
            <div className="card p-4 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("crm.contacts.filterIdentities")}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-10 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      title={t("common.clearFilter")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-rose-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="shrink-0">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] uppercase tracking-widest"
                  >
                    {["All", "Active", "Approved", "Pending", "Inactive", "Archived"].map((status) => (
                      <option key={status} value={status}>
                        {t(STATUS_FILTER_LABELS[status] || "") || status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-primary)] pt-3">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("crm.contacts.showingCount", { count: filtered.length })}
                </p>
              </div>
            </div>

            {/* SUB-TEAM TABS (Only shown when a group is selected and not in Archived mode) */}
            {selectedGroup !== "All Contacts" && statusFilter !== "Archived" && (
              <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                <button
                  onClick={() => setSelectedTeamTab("All Teams")}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${selectedTeamTab === "All Teams" ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
                >
                  {t("crm.contacts.allTeams")}
                </button>
                {teams
                  .filter(
                    (t) =>
                      t.group_name?.toUpperCase() ===
                      selectedGroup.toUpperCase(),
                  )
                  .map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamTab(team.id)}
                      className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${selectedTeamTab === team.id ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
                    >
                      {team.name}
                    </button>
                  ))}
              </div>
            )}

            {/* Pagination math */}
            {(() => {
              const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
              const safePage = Math.min(currentPage, totalPages);
              const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
              return (
                <>
            {loading ? (
              <TableSkeleton rows={8} />
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("crm.contacts.identity")}</th>
                      <th>{t("crm.contacts.groupStatus")}</th>
                      <th className="text-right">{t("crm.contacts.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((c) => (
                      <tr key={c.cid} className="group">
                        <td>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">
                              {c.name}
                            </span>
                            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                              {c.email}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-primary border border-[var(--border-primary)] rounded text-[9px] font-black uppercase text-[var(--brand-orange)]">
                                {t(GROUP_LABELS[c.group_name] || "") || c.group_name || t("crm.contacts.individual")}
                              </span>
                              {c.v2_team_id && (
                                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-black uppercase text-blue-500">
                                  {teams.find((t) => t.id === c.v2_team_id)
                                    ?.name || t("crm.contacts.subteam")}
                                </span>
                              )}
                            </div>
                            <span
                              className={`w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                c.status === "pending"
                                  ? "bg-orange-500/10 text-orange-400"
                                  : c.status === "inactive"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              {t(CONTACT_STATUS_LABELS[c.status] || "") || c.status}
                            </span>
                            <span
                              className={`w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                c.invitation_status === "activated"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : c.invitation_status === "sent"
                                    ? "bg-orange-500/10 text-orange-400"
                                    : c.invitation_status === "expired"
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-white/5 text-[var(--text-tertiary)]"
                              }`}
                            >
                              {t(INVITATION_STATUS_LABELS[c.invitation_status] || "") || c.invitation_status}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            {statusFilter === "Archived" ? (
                              <>
                                <button
                                  onClick={() => handleRestore(c)}
                                  title={t("crm.contacts.restoreContact")}
                                  disabled={isProcessing}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSoftDelete(c)}
                                  title={t("crm.contacts.permanentlyDelete")}
                                  disabled={isProcessing}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-rose-500 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => toggleStatus(c.cid, c.status, c.group_name)}
                                  title={
                                    c.status === "active"
                                      ? t("crm.contacts.deactivate")
                                      : t("crm.contacts.activate")
                                  }
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                                >
                                  {c.status === "active" ? (
                                    <UserX className="w-4 h-4" />
                                  ) : (
                                    <UserCheck className="w-4 h-4" />
                                  )}
                                </button>
                                {c.invitation_status !== "activated" &&
                                  (c.invitation_status === "not_invited" ? (
                                    <button
                                      onClick={() => handleInviteContact(c)}
                                      title={t("crm.contacts.inviteUser") || "Invite User"}
                                      disabled={isProcessing}
                                      className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-[var(--brand-orange)] transition-all"
                                    >
                                      <Send className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleResendActivation(c)}
                                      title={t("crm.contacts.resendActivation") || "Resend Activation Email (48h link)"}
                                      disabled={isProcessing}
                                      className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-blue-500 transition-all"
                                    >
                                      <Mail className="w-4 h-4" />
                                    </button>
                                  ))}
                                <button
                                  onClick={() => {
                                    setForm(c);
                                    setContactPrograms(c.program_ids || []);
                                    // Fetch actual program assignments
                                    fetch(
                                      "/api/participant-programs?participant_id=" +
                                        (c.cid || c.id),
                                    )
                                      .then((r) => r.json())
                                      .then((d) => {
                                        if (d.success)
                                          setContactPrograms(
                                            d.assignments.map((a) => a.program_id),
                                          );
                                      })
                                      .catch(() => {});
                                    setShowManualModal(true);
                                  }}
                                  title={t("crm.contacts.editContact")}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-[var(--brand-orange)]"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handlePivotToEntity(c)}
                                  title={t("crm.contacts.pivotToEntity")}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleArchive(c)}
                                  title={t("crm.contacts.archiveContact")}
                                  disabled={isProcessing}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-amber-500 transition-all"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-14 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Search className="w-8 h-8 text-[var(--text-secondary)] opacity-40" />
                            <p className="text-xs font-bold text-[var(--text-secondary)]">
                              {t("crm.contacts.noContactsFound")}
                            </p>
                            {(search || statusFilter !== "All" || selectedGroup !== "All Contacts") && (
                              <button
                                onClick={() => {
                                  setSearch("");
                                  setStatusFilter("All");
                                  setSelectedGroup("All Contacts");
                                  setSelectedTeamTab("All Teams");
                                }}
                                className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all"
                              >
                                {t("common.clearFilter")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination bar */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("crm.contacts.pageOf", { page: safePage, total: totalPages })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {t("common.previous")}
                  </button>

                  {/* Page number pills */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-[10px] text-[var(--text-secondary)]">{p}</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                              p === safePage
                                ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20"
                                : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-xl space-y-6 border-[var(--brand-orange)]/30 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">{t("crm.contacts.identityProfile")}</h3>
              <button onClick={() => setShowManualModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("crm.contacts.fullName")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t("crm.contacts.email")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={t("crm.contacts.phone")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <select
                value={form.group_name}
                onChange={(e) =>
                  setForm({ ...form, group_name: e.target.value })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("crm.contacts.selectSegment")}</option>
                {families.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name.toUpperCase()}
                  </option>
                ))}
              </select>
              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
                  {t("crm.contacts.roleOverride")}
                </label>
                <select
                  value={form.role || ""}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">{t("crm.contacts.autoDetect")}</option>
                  <option value="developer">{t("crm.contacts.roleDeveloper")}</option>
                  <option value="staff">{t("crm.contacts.roleStaff")}</option>
                  <option value="participant">{t("crm.contacts.roleParticipant")}</option>
                  <option value="intern">{t("crm.contacts.roleIntern")}</option>
                </select>
                <p className="text-[8px] text-[var(--text-secondary)] ml-1 opacity-60">
                  {t("crm.contacts.roleHelper")}
                </p>
              </div>
              {/* Program Assignments */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
                  {t("crm.contacts.programAssignment")}
                </label>
                <p className="text-[8px] text-[var(--text-secondary)] ml-1 mb-1 opacity-60">
                  {t("crm.contacts.programHelper")}
                </p>
                <select
                  value={contactPrograms[0] || ""}
                  onChange={(e) =>
                    setContactPrograms(e.target.value ? [e.target.value] : [])
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">{t("crm.contacts.selectProgram")}</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveContact}
                className="btn btn-primary w-full py-5 font-bold uppercase tracking-widest"
              >
                {t("crm.contacts.saveIdentity")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-[var(--brand-orange)]/30 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">
                {typeof showGroupModal === "object"
                  ? t("crm.contacts.editSegment")
                  : t("crm.contacts.newSegment")}
              </h3>
              <button onClick={() => setShowGroupModal(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t("crm.contacts.segmentName")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <select
                value={newGroupType}
                onChange={(e) => setNewGroupType(e.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="individual">{t("crm.contacts.individualFocus")}</option>
                <option value="company">{t("crm.contacts.entityFocus")}</option>
              </select>
              <select
                value={newGroupProgramId}
                onChange={(e) => setNewGroupProgramId(e.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("crm.contacts.selectProgram")}</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveGroup}
                className="btn btn-primary w-full py-4 font-bold uppercase"
              >
                {t("crm.contacts.syncSegment")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupKeysModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-blue-500/30 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">{t("crm.contacts.keyManagement")}</h3>
              <button onClick={() => setShowGroupKeysModal(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4 text-left">
              <input
                value={groupKeysForm.shared_email}
                onChange={(e) =>
                  setGroupKeysForm({
                    ...groupKeysForm,
                    shared_email: e.target.value,
                  })
                }
                placeholder={t("crm.contacts.sharedEmail")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={groupKeysForm.shared_password_read}
                  onChange={(e) =>
                    setGroupKeysForm({
                      ...groupKeysForm,
                      shared_password_read: e.target.value,
                    })
                  }
                  placeholder={t("crm.contacts.readKey")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-emerald-500 outline-none focus:border-emerald-500"
                />
                <input
                  value={groupKeysForm.shared_password_edit}
                  onChange={(e) =>
                    setGroupKeysForm({
                      ...groupKeysForm,
                      shared_password_edit: e.target.value,
                    })
                  }
                  placeholder={t("crm.contacts.editKey")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-blue-500 outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSaveGroupKeys}
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 w-full py-4 font-bold uppercase"
              >
                {t("crm.contacts.syncKeys")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK PROGRAM ASSIGNMENT MODAL */}
      {showBulkProgramModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-2xl space-y-6 border-[var(--brand-orange)]/30 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase">
                {t("crm.contacts.bulkProgramAssignment")}
              </h3>
              <button
                onClick={() => {
                  setShowBulkProgramModal(false);
                  setBulkSelected([]);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Program Selector */}
              <select
                id="bulk-program-select"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                defaultValue=""
              >
                <option value="" disabled>
                  {t("crm.contacts.selectProgram")}
                </option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Action Type */}
              <div className="flex gap-2">
                <button
                  id="bulk-action-add"
                  className="flex-1 py-2 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider"
                >
                  {t("crm.contacts.addToProgram")}
                </button>
                <button
                  id="bulk-action-remove"
                  className="flex-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-black uppercase tracking-wider"
                >
                  {t("crm.contacts.removeFromProgram")}
                </button>
              </div>

              {/* Select All / Clear */}
              <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-2">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t("crm.contacts.selectParticipants", {
                    count: bulkSelected.length,
                  })}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const parts = contacts.filter(
                        (c) => c.role === "participant",
                      );
                      setBulkSelected(
                        parts.map((c) => c.cid || c.id).filter(Boolean),
                      );
                    }}
                    className="text-[8px] font-bold text-blue-400 uppercase tracking-wider hover:underline"
                  >
                    {t("crm.contacts.selectAll")}
                  </button>
                  <button
                    onClick={() => setBulkSelected([])}
                    className="text-[8px] font-bold text-rose-400 uppercase tracking-wider hover:underline"
                  >
                    {t("crm.contacts.clear")}
                  </button>
                </div>
              </div>

              {/* Participant List */}
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {contacts
                  .filter(
                    (c) => c.role === "participant" || c.role === "unassigned",
                  )
                  .map((c) => {
                    const cid = c.cid || c.id;
                    const isSelected = bulkSelected.includes(cid);
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => {
                          setBulkSelected((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== cid)
                              : [...prev, cid],
                          );
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-left ${
                          isSelected
                            ? "bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[var(--brand-orange)]"
                            : "bg-tertiary border border-transparent text-[var(--text-secondary)] hover:border-[var(--border-primary)]"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                              : "border-[var(--border-primary)]"
                          }`}
                        >
                          {isSelected && (
                            <span className="text-[8px] text-black font-black">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{c.name || t("crm.contacts.unknown")}</p>
                          <p className="text-[7px] opacity-50 truncate">
                            {c.email || cid}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                {contacts.filter((c) => c.role === "participant").length ===
                  0 && (
                  <p className="text-[10px] text-slate-500 italic col-span-2 py-8 text-center">
                    {t("crm.contacts.noParticipantsFound")}
                  </p>
                )}
              </div>

              {/* Apply Button */}
              <button
                onClick={async () => {
                  const programId = document.getElementById(
                    "bulk-program-select",
                  ).value;
                  const actionEl = document.querySelector(
                    "#bulk-action-add.bg-\[var\(--brand-orange\)\/10\]",
                  );
                  const isAdd = true; // default to add
                  if (!programId || !bulkSelected.length) return;
                  setIsProcessing(true);
                  try {
                    const res = await fetch("/api/participant-programs/bulk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        participant_ids: bulkSelected,
                        program_id: programId,
                        action: "add",
                        assigned_by: "sa",
                        source: "bulk_assignment",
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setNotification({
                        type: "success",
                        message: t("crm.contacts.updated"),
                      });
                      setShowBulkProgramModal(false);
                      setBulkSelected([]);
                      fetchData();
                    }
                  } catch (e) {
                    setNotification({
                      type: "error",
                      message: t("crm.contacts.bulkAssignmentFailed"),
                    });
                  } finally {
                    setIsProcessing(false);
                    setTimeout(() => setNotification(null), 3000);
                  }
                }}
                disabled={isProcessing || !bulkSelected.length}
                className="w-full py-4 rounded-xl bg-[var(--brand-orange)] text-black text-[11px] font-black uppercase tracking-wider disabled:opacity-50 hover:brightness-110 transition-all"
              >
                {isProcessing
                  ? t("crm.contacts.processing")
                  : t("crm.contacts.assignToProgram", {
                      count: bulkSelected.length,
                    })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmTarget(null)}>
          <div className="card w-full max-w-sm space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">{t("crm.contacts.confirmAction")}</h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{confirmTarget.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">{t("crm.contacts.cancel")}</button>
              <button onClick={() => { confirmTarget.onConfirm(); setConfirmTarget(null); }} className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 transition-all">{t("crm.contacts.confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <ContactsPageContent />
    </Suspense>
  );
}
