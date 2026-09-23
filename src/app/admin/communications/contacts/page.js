"use client";
// Updated Role Override per user request

import React, { useState, Suspense } from "react";
import {
  Plus,
  Users,
  Mail,
  Search,
  X,
  CheckCircle,
  Edit3,
  Shield,
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
import { INTERNAL_OPS_ROLES } from "@/lib/platform/roles";
import { motion, AnimatePresence } from "framer-motion";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";

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

// Internal Future Studio staff are created manually (not via an invitation/application
// form) and therefore do not need an activation email — hide that status for them.
const INTERNAL_ROLE_SET = new Set(INTERNAL_OPS_ROLES);
const isInternalContact = (contact) =>
  INTERNAL_ROLE_SET.has(String(contact.role || "").toLowerCase()) ||
  String(contact.group_name || "").toUpperCase() === "FUTURE STUDIO";

const PROGRAMS_URL = "/api/pm/programs";

// Module scope on purpose: the hook mirrors what the caller passes, so these are
// built once here rather than on every render.
const EMPTY_REGISTRY = { contacts: [], families: [], teams: [] };

/**
 * The registry rows for the current status filter.
 *
 * The loader this replaces painted the contacts, the families and the teams from
 * ONE answer, so they are shaped together: one read, and the three lists the rest
 * of the screen already reads separately.
 */
const pickRegistry = (payload) => {
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

const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const goBack = useSafeBack("/admin/crm");

  const [search, setSearch] = useState("");
  // The group and the team tab are DERIVED, so what is stored here is only the
  // person's choice, recorded against what it was chosen under (see below).
  const [groupChoice, setGroupChoice] = useState(null);
  const [teamChoice, setTeamChoice] = useState(null);
  const [copiedGroup, setCopiedGroup] = useState(null);

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

  // Group invite
  const [showInviteModal, setShowInviteModal] = useState(null); // { name }
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "", role: "member" });

  // Feedback
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All"); // All, Active, Inactive, Archived

  // Pagination
  const PAGE_SIZE = 50;
  // What is stored is the page chosen under a set of filters; which page is
  // current is derived (see below).
  const [pageChoice, setPageChoice] = useState(null);

  // The group under review comes from the address (`?role=`), and the person's
  // choice is recorded WITH the parameter it was made under: a new address shows
  // that address's group, and nothing has to be written from an effect.
  const groupFromAddress = roleParam
    ? roleParam.toLowerCase() === "staff"
      ? "Future Studio"
      : roleParam
    : "All Contacts";
  const selectedGroup =
    groupChoice && groupChoice.roleParam === roleParam
      ? groupChoice.group
      : groupFromAddress;
  const setSelectedGroup = (group) => setGroupChoice({ roleParam, group });

  // The team tab belongs to the group it was chosen under for the same reason, so
  // changing group cannot leave the grid filtered by the previous group's team.
  const selectedTeamTab =
    teamChoice && teamChoice.group === selectedGroup ? teamChoice.team : "All Teams";
  const setSelectedTeamTab = (team) => setTeamChoice({ group: selectedGroup, team });

  // Both reads go through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer, so the screen keeps no copy of its
  // own and never sets state from an effect. The registry's address carries the
  // status filter, so switching it asks for that filter's rows.
  const {
    data: registry,
    loading: registryLoading,
    refresh: refreshRegistry,
  } = useApi(
    `/api/contacts/full-state${statusFilter === "Archived" ? "?status=archived" : ""}`,
    { defaultValue: EMPTY_REGISTRY, transform: pickRegistry },
  );
  const {
    data: programs,
    loading: programsLoading,
    refresh: refreshPrograms,
  } = useApi(PROGRAMS_URL, { defaultValue: [], transform: pickPrograms });

  const contacts = registry.contacts;
  const families = registry.families;
  const teams = registry.teams;
  // The grid leaves its spinner once both reads have settled, exactly as the old
  // combined loader did.
  const loading = registryLoading || programsLoading;

  // Mutation flows must not read back from the cache, so both reads are refreshed
  // the way the old bypassCache argument did.
  const refreshAll = () => {
    refreshRegistry();
    refreshPrograms();
  };

  const toggleStatus = async (cid, currentStatus, _currentGroup) => {
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
      refreshAll();
    } catch (error) {
      console.error(error);
    }
  };

  const handleResendActivation = async (contact) => {
    if (!(await confirm({ message: t("crm.contacts.confirmResendActivation") }))) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: contact.email }),
      });
      const payload = await response.json();
      if (payload.success) {
        setNotification({ type: "success", text: t("crm.contacts.activationSent") || "Activation email sent" });
        refreshAll();
      } else {
        setNotification({ type: "error", text: payload.error || "Failed to send email" });
      }
    } catch {
      setNotification({ type: "error", text: "Error sending email" });
    }
    setIsProcessing(false);
  };

  const handleInviteContact = async (contact) => {
    if (!(await confirm({ message: t("crm.contacts.confirmInvite") }))) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          name: contact.name,
          role: contact.role || "member",
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        // The invitation exists either way; only say it was SENT when the
        // sender actually sent it.
        setNotification(
          payload.email_sent === false
            ? { type: "error", text: t("crm.contacts.inviteEmailFailed", { error: payload.email_error || t("crm.contacts.inviteFailed") }) }
            : { type: "success", text: t("crm.contacts.invitationSent") || "Invitation sent" },
        );
        refreshAll();
      } else {
        setNotification({ type: "error", text: payload.error || "Failed to send invitation" });
      }
    } catch {
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
      const response = await fetch("/api/contacts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowManualModal(false);
        refreshAll();
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
      const response = await fetch("/api/families", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? showGroupModal.id : undefined,
          name: newGroupName.trim(),
          type: newGroupType,
          program_id: newGroupProgramId || null,
        }),
      });
      if ((await response.json()).success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowGroupModal(null);
        refreshAll();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleInvite = async () => {
    if (!showInviteModal || !inviteForm.email.trim()) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          group_id: showInviteModal.name,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        setNotification(
          payload.email_sent === false
            ? { type: "error", message: t("crm.contacts.inviteEmailFailed", { error: payload.email_error || t("crm.contacts.inviteFailed") }) }
            : { type: "success", message: t("crm.contacts.inviteSent") },
        );
        setShowInviteModal(null);
        setInviteForm({ name: "", email: "", phone: "", role: "member" });
        refreshAll();
      } else {
        setNotification({ type: "error", message: payload.error || t("crm.contacts.inviteFailed") });
      }
    } catch (_) {
      setNotification({ type: "error", message: t("crm.contacts.inviteFailed") });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleArchive = async (contact) => {
    setIsProcessing(true);
    try {
      // The who and the when are the server's to record: the body carries the
      // intent only (see PUT /api/contacts).
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: contact.cid, archived: true }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.archivedToast", { name: contact.name }) },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.contacts.archiveFailed")) || "") || (payload.error || t("crm.contacts.archiveFailed")),
            },
          }),
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (contact) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: contact.cid, archived: false }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.restoredToast", { name: contact.name }) },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.contacts.restoreFailed")) || "") || (payload.error || t("crm.contacts.restoreFailed")),
            },
          }),
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSoftDelete = (contact) => {
    setConfirmTarget({
      id: contact.cid,
      message: t("crm.contacts.deleteConfirm", { name: contact.name }),
      onConfirm: () => performSoftDelete(contact),
    });
  };

  const performSoftDelete = async (contact) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/contacts?cid=${encodeURIComponent(contact.cid)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.permanentlyDeletedToast", { name: contact.name }) },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.contacts.deleteFailed")) || "") || (payload.error || t("crm.contacts.deleteFailed")),
            },
          }),
        );
      }
    } catch {
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
      const groupsResponse = await fetch(`/api/groups?search=${encodeURIComponent(groupName)}`);
      const groupsData = await groupsResponse.json();
      if (groupsData.success && groupsData.groups && groupsData.groups.length > 0) {
        const group = groupsData.groups[0];
        const registrationId = group.registration_id || group.id;
        const formRunsResponse = await fetch(`/api/platform/form-runs?group_id=${encodeURIComponent(registrationId)}`);
        const formRunsData = await formRunsResponse.json();
        if (formRunsData.success && formRunsData.runs && formRunsData.runs.length > 0) {
          link = `${window.location.origin}/s/${formRunsData.runs[0].public_slug}`;
        }
      }
    } catch (_) {}
    navigator.clipboard.writeText(link);
    setCopiedGroup(groupName);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  // Pagination
  //
  // The page belongs to the filters it was chosen under: changing the search, the
  // status, the group or the team tab starts again at the first page. Kept as an
  // effect this ran after the render, so the grid was drawn for one frame under the
  // previous filter's page number.
  const pageIsChosenForCurrentFilters =
    !!pageChoice &&
    pageChoice.search === search &&
    pageChoice.status === statusFilter &&
    pageChoice.group === selectedGroup &&
    pageChoice.team === selectedTeamTab;
  const currentPage = pageIsChosenForCurrentFilters ? pageChoice.page : 1;
  const setCurrentPage = (next) =>
    setPageChoice({
      search,
      status: statusFilter,
      group: selectedGroup,
      team: selectedTeamTab,
      page: typeof next === "function" ? next(currentPage) : next,
    });

  const filtered = contacts.filter((contact) => {
    const lowerSearch = search.toLowerCase();
    const matchesSearch =
      (contact.name || "").toLowerCase().includes(lowerSearch) ||
      (contact.email || "").toLowerCase().includes(lowerSearch);
    const matchesGroup =
      selectedGroup === "All Contacts" ||
      contact.group_name?.toUpperCase() === selectedGroup.toUpperCase();

    // Nested Sub-team Filter
    const matchesTeam =
      selectedTeamTab === "All Teams" || contact.v2_team_id === selectedTeamTab;

    let matchesStatus = true;
    if (statusFilter === "Active")
      matchesStatus = contact.status === "active";
    else if (statusFilter === "Approved")
      matchesStatus = contact.status === "approved";
    else if (statusFilter === "Pending")
      matchesStatus = contact.status === "pending";
    else if (statusFilter === "Inactive")
      matchesStatus = contact.status === "inactive";
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
  for (const contact of contacts) {
    if (contact.status === "pending") continue;
    const key = String(contact.group_name || "UNASSIGNED").toUpperCase();
    segmentCounts[key] = (segmentCounts[key] || 0) + 1;
  }

  const handlePivotToEntity = async (contact) => {
    setIsProcessing(true);
    try {
      const entityName = `${contact.name} Entity`;
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
        body: JSON.stringify({ cid: contact.cid, group_name: entityName }),
      });
      setNotification({ type: "success", message: t("crm.contacts.done") });
      refreshAll();
    } catch (error) {
      console.error("Pivot Error:", error);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <>
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
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
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
                {["All Contacts", ...families].map((family) => {
                  const name = typeof family === "string" ? family : family.name;
                  const isAll = name === "All Contacts";
                  return (
                    <div key={name} className="flex gap-2 group items-center">
                      <button
                        onClick={() => setSelectedGroup(name)}
                        className={`flex-1 flex items-center justify-between gap-2 text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${selectedGroup === name ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-primary"}`}
                      >
                        <span className="break-words whitespace-normal">
                          {isAll ? t("crm.contacts.allContacts") : name} {!!family.is_archived && t("crm.contacts.archivedSuffix")}
                        </span>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedGroup === name ? "bg-black/20" : "bg-tertiary"}`}>
                          {isAll ? contacts.length : segmentCounts[String(name).toUpperCase()] || 0}
                        </span>
                      </button>
                      {!isAll && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setInviteForm({ name: "", email: "", phone: "", role: "member" });
                              setShowInviteModal({ name });
                            }}
                            title={t("crm.contacts.invite")}
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-[var(--brand-orange)]"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setNewGroupName(family.name);
                              setNewGroupType(family.type);
                              setNewGroupProgramId(family.program_id);
                              setShowGroupModal(family);
                            }}
                            title={t("crm.contacts.editSegment")}
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-[var(--brand-orange)]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
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
                    onChange={(event) => setSearch(event.target.value)}
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
                    onChange={(event) => setStatusFilter(event.target.value)}
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
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedTeamTab === "All Teams" ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
                >
                  {t("crm.contacts.allTeams")}
                </button>
                {teams
                  .filter(
                    (team) =>
                      team.group_name?.toUpperCase() ===
                      selectedGroup.toUpperCase(),
                  )
                  .map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamTab(team.id)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedTeamTab === team.id ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
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
                    {paginated.map((contact) => (
                      <tr key={contact.cid} className="group">
                        <td>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">
                              {contact.name}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                              {contact.email}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-primary border border-[var(--border-primary)] rounded text-[10px] font-bold uppercase text-[var(--brand-orange)]">
                                {t(GROUP_LABELS[contact.group_name] || "") || contact.group_name || t("crm.contacts.individual")}
                              </span>
                              {contact.v2_team_id && (
                                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold uppercase text-blue-500">
                                  {teams.find((team) => team.id === contact.v2_team_id)
                                    ?.name || t("crm.contacts.subteam")}
                                </span>
                              )}
                            </div>
                            <span
                              className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                contact.status === "pending"
                                  ? "bg-orange-500/10 text-orange-400"
                                  : contact.status === "inactive"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              {t(CONTACT_STATUS_LABELS[contact.status] || "") || contact.status}
                            </span>
                            <span
                              className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                contact.invitation_status === "activated"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : contact.invitation_status === "sent"
                                    ? "bg-orange-500/10 text-orange-400"
                                    : contact.invitation_status === "expired"
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-white/5 text-[var(--text-tertiary)]"
                              }`}
                            >
                              {t(INVITATION_STATUS_LABELS[contact.invitation_status] || "") || contact.invitation_status}
                            </span>
                            {!isInternalContact(contact) && (
                              <span
                                title={
                                  contact.activation_email_status === "failed"
                                    ? (contact.activation_email_error || t("crm.contacts.activationEmailFailed"))
                                    : contact.activation_email_sent_at
                                      ? `${t("crm.contacts.activationEmailSent")} — ${new Date(contact.activation_email_sent_at).toLocaleString()}`
                                      : (contact.activation_email_error || t("crm.contacts.activationEmailNotSent"))
                                }
                                className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  contact.activation_email_status === "failed"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : contact.activation_email_sent_at
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-white/5 text-[var(--text-tertiary)]"
                                }`}
                              >
                                {contact.activation_email_status === "failed"
                                  ? t("crm.contacts.activationEmailFailed")
                                  : contact.activation_email_sent_at
                                    ? t("crm.contacts.activationEmailSent")
                                    : t("crm.contacts.activationEmailNotSent")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            {statusFilter === "Archived" ? (
                              <>
                                <button
                                  onClick={() => handleRestore(contact)}
                                  title={t("crm.contacts.restoreContact")}
                                  disabled={isProcessing}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSoftDelete(contact)}
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
                                  onClick={() => toggleStatus(contact.cid, contact.status, contact.group_name)}
                                  title={
                                    contact.status === "active"
                                      ? t("crm.contacts.deactivate")
                                      : t("crm.contacts.activate")
                                  }
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                                >
                                  {contact.status === "active" ? (
                                    <UserX className="w-4 h-4" />
                                  ) : (
                                    <UserCheck className="w-4 h-4" />
                                  )}
                                </button>
                                {contact.invitation_status !== "activated" &&
                                  (contact.invitation_status === "not_invited" ? (
                                    <button
                                      onClick={() => handleInviteContact(contact)}
                                      title={t("crm.contacts.inviteUser") || "Invite User"}
                                      disabled={isProcessing}
                                      className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-[var(--brand-orange)] transition-all"
                                    >
                                      <Send className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleResendActivation(contact)}
                                      title={t("crm.contacts.resendActivation") || "Resend Activation Email (48h link)"}
                                      disabled={isProcessing}
                                      className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-blue-500 transition-all"
                                    >
                                      <Mail className="w-4 h-4" />
                                    </button>
                                  ))}
                                <button
                                  onClick={() => {
                                    setForm(contact);
                                    setContactPrograms(contact.program_ids || []);
                                    // Fetch actual program assignments
                                    fetch(
                                      "/api/participant-programs?participant_id=" +
                                        (contact.cid || contact.id),
                                    )
                                      .then((response) => response.json())
                                      .then((payload) => {
                                        if (payload.success)
                                          setContactPrograms(
                                            payload.assignments.map((assignment) => assignment.program_id),
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
                                  onClick={() => handlePivotToEntity(contact)}
                                  title={t("crm.contacts.pivotToEntity")}
                                  className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleArchive(contact)}
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
                                className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all"
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
                    onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                    disabled={safePage === 1}
                    className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {t("common.previous")}
                  </button>

                  {/* Page number pills */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, index) => index + 1)
                      .filter((pageNumber) => pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - safePage) <= 2)
                      .reduce((accumulator, pageNumber, index, pages) => {
                        if (index > 0 && pageNumber - pages[index - 1] > 1) accumulator.push("...");
                        accumulator.push(pageNumber);
                        return accumulator;
                      }, [])
                      .map((pageNumber, index) =>
                        pageNumber === "..." ? (
                          <span key={`ellipsis-${index}`} className="px-1 text-[10px] text-[var(--text-secondary)]">{pageNumber}</span>
                        ) : (
                          <button
                            key={pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                              pageNumber === safePage
                                ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20"
                                : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        )
                      )}
                  </div>

                  <button
                    onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
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
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t("crm.contacts.fullName")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder={t("crm.contacts.email")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder={t("crm.contacts.phone")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <select
                value={form.group_name}
                onChange={(event) =>
                  setForm({ ...form, group_name: event.target.value })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("crm.contacts.selectSegment")}</option>
                {families.map((family) => (
                  <option key={family.id ?? family.name} value={family.name}>
                    {family.name.toUpperCase()}
                  </option>
                ))}
              </select>
              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
                  {t("crm.contacts.roleOverride")}
                </label>
                <select
                  value={form.role || ""}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">{t("crm.contacts.autoDetect")}</option>
                  <option value="staff">{t("crm.contacts.roleStaff")}</option>
                  <option value="participant">{t("crm.contacts.roleParticipant")}</option>
                  <option value="member">{t("crm.contacts.roleMember")}</option>
                  <option value="intern">{t("crm.contacts.roleIntern")}</option>
                  <option value="facilitator">{t("crm.contacts.roleFacilitator")}</option>
                </select>
                <p className="text-[10px] text-[var(--text-secondary)] ml-1 opacity-60">
                  {t("crm.contacts.roleHelper")}
                </p>
              </div>
              {/* Program Assignments */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
                  {t("crm.contacts.programAssignment")}
                </label>
                <p className="text-[10px] text-[var(--text-secondary)] ml-1 mb-1 opacity-60">
                  {t("crm.contacts.programHelper")}
                </p>
                <select
                  value={contactPrograms[0] || ""}
                  onChange={(event) =>
                    setContactPrograms(event.target.value ? [event.target.value] : [])
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">{t("crm.contacts.selectProgram")}</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
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
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder={t("crm.contacts.segmentName")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <select
                value={newGroupType}
                onChange={(event) => setNewGroupType(event.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="individual">{t("crm.contacts.individualFocus")}</option>
                <option value="company">{t("crm.contacts.entityFocus")}</option>
              </select>
              <select
                value={newGroupProgramId}
                onChange={(event) => setNewGroupProgramId(event.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("crm.contacts.selectProgram")}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
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

      {showInviteModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-[var(--brand-orange)]/30 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">
                {t("crm.contacts.inviteTo")}: {showInviteModal.name}
              </h3>
              <button onClick={() => setShowInviteModal(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={inviteForm.name}
                onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })}
                placeholder={t("crm.contacts.fullName")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <input
                type="email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
                placeholder={t("crm.contacts.email")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <input
                type="tel"
                value={inviteForm.phone}
                onChange={(event) => setInviteForm({ ...inviteForm, phone: event.target.value })}
                placeholder={t("crm.contacts.phone")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <select
                value={inviteForm.role}
                onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="participant">{t("crm.contacts.roleParticipant")}</option>
                <option value="member">{t("crm.contacts.roleMember")}</option>
                <option value="staff">{t("crm.contacts.roleStaff")}</option>
                <option value="intern">{t("crm.contacts.roleIntern")}</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={!inviteForm.email.trim() || isProcessing}
                className="btn btn-primary w-full py-4 font-bold uppercase disabled:opacity-50"
              >
                {isProcessing ? t("crm.contacts.processing") : t("crm.contacts.invite")}
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
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
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
                      const participants = contacts.filter(
                        (contact) =>
                          contact.is_participant === true ||
                          contact.role === "participant",
                      );
                      setBulkSelected(
                        participants.map((contact) => contact.cid || contact.id).filter(Boolean),
                      );
                    }}
                    className="text-[10px] font-bold text-blue-400 uppercase tracking-wide hover:underline"
                  >
                    {t("crm.contacts.selectAll")}
                  </button>
                  <button
                    onClick={() => setBulkSelected([])}
                    className="text-[10px] font-bold text-rose-400 uppercase tracking-wide hover:underline"
                  >
                    {t("crm.contacts.clear")}
                  </button>
                </div>
              </div>

              {/* Participant List */}
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {contacts
                  .filter(
                    (contact) =>
                      contact.is_participant === true ||
                      contact.role === "participant" ||
                      contact.role === "unassigned",
                  )
                  .map((contact) => {
                    const cid = contact.cid || contact.id;
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
                        className={`flex items-center gap-2 p-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-left ${
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
                            <span className="text-[10px] text-black font-black">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{contact.name || t("crm.contacts.unknown")}</p>
                          <p className="text-[10px] opacity-50 truncate">
                            {contact.email || cid}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                {contacts.filter(
                  (contact) =>
                    contact.is_participant === true ||
                    contact.role === "participant" ||
                    contact.role === "unassigned",
                ).length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)] col-span-2 py-8 text-center">
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
                  const _actionEl = document.querySelector(
                    "#bulk-action-add.bg-[var(--brand-orange)/10]",
                  );
                  if (!programId || !bulkSelected.length) return;
                  setIsProcessing(true);
                  try {
                    const response = await fetch("/api/participant-programs/bulk", {
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
                    const payload = await response.json();
                    if (payload.success) {
                      setNotification({
                        type: "success",
                        message: t("crm.contacts.updated"),
                      });
                      setShowBulkProgramModal(false);
                      setBulkSelected([]);
                      refreshAll();
                    }
                  } catch {
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
          <div className="card w-full max-w-sm space-y-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">{t("crm.contacts.confirmAction")}</h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{confirmTarget.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">{t("crm.contacts.cancel")}</button>
              <button onClick={() => { confirmTarget.onConfirm(); setConfirmTarget(null); }} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 transition-all">{t("crm.contacts.confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <ContactsPageContent />
    </Suspense>
  );
}
