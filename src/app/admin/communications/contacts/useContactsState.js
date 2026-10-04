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
} from "./contactsConstants";
import {
  filterContacts,
  buildSegmentCounts,
  paginateContacts,
} from "./contactsDerivations";
import { createContactsMutations } from "./useContactsMutations";

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

  // The mutation flows (fetch, notify, refresh) live in their own module; this
  // hook owns the state they act on and hands them exactly the values they read.
  const {
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
    handlePivotToEntity,
  } = createContactsMutations({
    t,
    confirm,
    refreshAll,
    setIsProcessing,
    setNotification,
    setCopiedGroup,
    form,
    contactPrograms,
    setShowManualModal,
    showGroupModal,
    setShowGroupModal,
    newGroupName,
    newGroupType,
    newGroupProgramId,
    showInviteModal,
    setShowInviteModal,
    inviteForm,
    setInviteForm,
    setConfirmTarget,
  });

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

  const filtered = filterContacts(contacts, {
    search,
    selectedGroup,
    selectedTeamTab,
    statusFilter,
  });

  // Segment counts — how many contacts belong to each segment (used for the
  // sidebar badges; "All Contacts" shows the total in the current view).
  const segmentCounts = buildSegmentCounts(contacts);

  const { totalPages, safePage, paginated } = paginateContacts(filtered, currentPage);

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
