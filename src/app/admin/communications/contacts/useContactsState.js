"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import {
  PROGRAMS_URL,
  EMPTY_REGISTRY,
  pickRegistry,
  pickPrograms,
  PAGE_SIZE,
} from "./contactsConstants";

export function useContactsState() {
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openNewContact = () => {
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
  };

  const openEditContact = (contact) => {
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
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setSelectedGroup("All Contacts");
    setSelectedTeamTab("All Teams");
  };

  return {
    t,
    goBack,
    search,
    setSearch,
    copiedGroup,
    showManualModal,
    setShowManualModal,
    isProcessing,
    setIsProcessing,
    confirmTarget,
    setConfirmTarget,
    contactPrograms,
    setContactPrograms,
    showBulkProgramModal,
    setShowBulkProgramModal,
    bulkSelected,
    setBulkSelected,
    form,
    setForm,
    showGroupModal,
    setShowGroupModal,
    newGroupName,
    setNewGroupName,
    newGroupType,
    setNewGroupType,
    newGroupProgramId,
    setNewGroupProgramId,
    showInviteModal,
    setShowInviteModal,
    inviteForm,
    setInviteForm,
    notification,
    setNotification,
    statusFilter,
    setStatusFilter,
    selectedGroup,
    setSelectedGroup,
    selectedTeamTab,
    setSelectedTeamTab,
    contacts,
    families,
    teams,
    programs,
    loading,
    refreshAll,
    toggleStatus,
    handleResendActivation,
    handleInviteContact,
    handleSaveContact,
    handleSaveGroup,
    handleInvite,
    handleArchive,
    handleRestore,
    handleSoftDelete,
    copyJoinLink,
    currentPage,
    setCurrentPage,
    filtered,
    segmentCounts,
    handlePivotToEntity,
    totalPages,
    safePage,
    paginated,
    openNewContact,
    openEditContact,
    clearFilters,
  };
}
