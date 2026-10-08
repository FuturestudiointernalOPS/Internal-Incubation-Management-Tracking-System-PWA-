"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useRouter, useParams } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import VentureWorkspaceScreen from "@/components/participant/ventures/VentureWorkspaceScreen";
import {
  pickVenture, ventureToForm, pickMembers, pickInvitations, pickDashboard,
  pickProgress, pickCalendar, pickJourney, EMPTY_ROADMAP, pickBm,
  pickInterviews, pickValidations, pickAssessments, pickMilestones,
  pickDocuments, pickInvestmentReadiness, pickOptionLists,
} from "@/components/participant/ventures/ventureScreenModel";
import {
  ventureToPayload, mergePermissionRoles, buildDocumentQuery,
  inputStyle, cardStyle, notifyMsg,
} from "@/components/participant/ventures/ventureScreenHelpers";
import { createVentureLoaders } from "@/components/participant/ventures/ventureScreenLoaders";

export default function VentureDetail() {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Journey view: the milestone timeline by default, or one of the Venture
  // work tools (JOURNEY_TOOLS) that live inside Journey.
  const [journeySub, setJourneySub] = useState("timeline");

  // The screen's reads are declared further down, together with the addresses
  // that say which of them the open screen is asking for.
  const [historyData] = useState(null);

  // Track 2 state
  const [actionPlans, setActionPlans] = useState([]);
  const [showAddInterview, setShowAddInterview] = useState(false);
  const [showAddValidation, setShowAddValidation] = useState(false);
  const [showAddPmf, setShowAddPmf] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [interviewForm, setInterviewForm] = useState({});
  const [validationForm, setValidationForm] = useState({ type: 'problem' });
  const [pmfForm, setPmfForm] = useState({});
  const [milestoneForm, setMilestoneForm] = useState({});
  const [actionForm, setActionForm] = useState({});

  // Track 3 state
  const [tasks, setTasks] = useState([]);
  const [standups, setStandups] = useState([]);
  const [retros, setRetros] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddRetro, setShowAddRetro] = useState(false);
  const [showAddBlocker, setShowAddBlocker] = useState(false);
  const [taskForm, setTaskForm] = useState({});
  const [standupForm, setStandupForm] = useState({});
  const [retroForm, setRetroForm] = useState({});
  const [blockerForm, setBlockerForm] = useState({});

  // Track 4 state
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [documentForm, setDocumentForm] = useState({});
  const [showVersions, setShowVersions] = useState(false);
  const [versionsDoc, setVersionsDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviews, setReviews] = useState([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionsDoc, setPermissionsDoc] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [playbookEntries, setPlaybookEntries] = useState([]);
  const [currentWeekStandup, setCurrentWeekStandup] = useState(true);
  const [currentWeekRetro, setCurrentWeekRetro] = useState(true);
  const [currentWeekNum, setCurrentWeekNum] = useState(null);
  const [currentWeekYear, setCurrentWeekYear] = useState(null);

  // Track 5 state
  const [advisors, setAdvisors] = useState([]);
  const [coachingSessions, setCoachingSessions] = useState([]);
  const [showAddAdvisor, setShowAddAdvisor] = useState(false);
  const [showAddCoaching, setShowAddCoaching] = useState(false);
  const [showEditCoaching, setShowEditCoaching] = useState(false);
  const [editingCoaching, setEditingCoaching] = useState(null);
  const [advisorForm, setAdvisorForm] = useState({});
  const [coachingForm, setCoachingForm] = useState({});
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentCategory, setDocumentCategory] = useState('');

  // Add member modal — a founder invites by EMAIL; the person only joins once
  // they open the emailed link and accept.
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberType, setAddMemberType] = useState("founder");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const { t } = useI18n();
  const { confirm } = useDialogs();
  const router = useRouter();
  const params = useParams();

  // The signed-in identity comes from the shell's session cache rather than the
  // browser's stored copy, so it needs no effect and no read of its own.
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser || {};

  // The venture record is read through the shared hook, which owns the cache,
  // the cache-first paint and the discarding of a stale answer.
  const { data: venture, loading } = useApi(
    params.id ? `/api/ventures/${params.id}` : null,
    { defaultValue: null, transform: pickVenture },
  );

  // The profile form is the Venture's stored values with the person's UNSAVED
  // edits laid over them, and neither half is written from an effect. A re-read
  // therefore cannot wipe what someone is in the middle of typing, and a saved
  // change never has to be pushed back into a copy of the record. The tabs keep
  // calling `setForm` with a whole form object, exactly as before, so the
  // contract they consume is unchanged.
  const baseForm = useMemo(
    () => (venture ? ventureToForm(venture) : null),
    [venture],
  );
  const [formEdits, setFormEdits] = useState(null);
  const form = baseForm ? { ...baseForm, ...(formEdits || {}) } : {};
  const setForm = setFormEdits;

  // Navigate top-level sections. Re-entering Journey resets to the milestone
  // timeline so the primary tab always behaves predictably.
  function openSection(section) {
    if (section === activeTab && section !== "journey") return;
    setActiveTab(section);
    if (section === "journey") setJourneySub("timeline");
  }

  // ── The screen's reads ───────────────────────────────────────────────────
  // Arriving on a section IS the request, so nothing has to decide WHEN to
  // load: each read's ADDRESS says which section is asking, and a section that
  // is not open reads nothing. `ready` is the guard the old loader effect used
  // - the Venture record has to be known before its sub-resources are asked for.
  const ready = !!params.id && !!venture;
  const onDashboard = ready && activeTab === "dashboard";
  const onJourney = ready && activeTab === "journey";

  const { data: members, refresh: loadMembers } = useApi(
    ready && (activeTab === "team" || activeTab === "dashboard")
      ? `/api/ventures/${params.id}/members`
      : null,
    { defaultValue: [], transform: pickMembers },
  );

  // Pending invitations sit beside the roster, so a founder can see who has been
  // asked and withdraw an invitation that was never accepted.
  const { data: invitations, refresh: loadInvitations } = useApi(
    ready && activeTab === "team"
      ? `/api/ventures/${params.id}/member-invitations`
      : null,
    { defaultValue: [], transform: pickInvitations },
  );

  const { data: dashboardData } = useApi(
    onDashboard ? `/api/ventures/${params.id}/dashboard` : null,
    { defaultValue: null, transform: pickDashboard },
  );

  const { data: progressData, refresh: fetchProgress } = useApi(
    onDashboard ? `/api/ventures/${params.id}/progress` : null,
    { defaultValue: null, transform: pickProgress },
  );

  const { data: calendarEvents, refresh: fetchCalendar } = useApi(
    onDashboard ? `/api/ventures/${params.id}/calendar` : null,
    { defaultValue: [], transform: pickCalendar },
  );

  const { data: roadmap, refresh: fetchJourney } = useApi(
    ready && (activeTab === "dashboard" || activeTab === "journey")
      ? `/api/ventures/${params.id}/journey`
      : null,
    { defaultValue: EMPTY_ROADMAP, transform: pickJourney },
  );
  const journeyStages = roadmap.stages;

  const { data: bmData, setData: setBmData, refresh: fetchBm } = useApi(
    onJourney && journeySub === "businessModel"
      ? `/api/ventures/${params.id}/business-model`
      : null,
    { defaultValue: null, transform: pickBm },
  );
  const { data: interviews, refresh: fetchInterviews } = useApi(
    onJourney && journeySub === "discovery"
      ? `/api/ventures/${params.id}/interviews`
      : null,
    { defaultValue: [], transform: pickInterviews },
  );
  const { data: validations, refresh: fetchValidations } = useApi(
    onJourney && journeySub === "validation"
      ? `/api/ventures/${params.id}/validations`
      : null,
    { defaultValue: [], transform: pickValidations },
  );
  const { data: assessments, refresh: fetchPmf } = useApi(
    onJourney && journeySub === "pmf" ? `/api/ventures/${params.id}/pmf` : null,
    { defaultValue: [], transform: pickAssessments },
  );
  const { data: milestones, refresh: fetchMilestones } = useApi(
    onJourney && journeySub === "milestones"
      ? `/api/ventures/${params.id}/milestones`
      : null,
    { defaultValue: [], transform: pickMilestones },
  );
  const {
    fetchActionPlans, fetchTasks, fetchStandups, fetchRetros,
    fetchBlockers, fetchAdvisors, fetchCoaching, fetchPlaybook,
  } = createVentureLoaders({
    params,
    setActionPlans, setTasks, setStandups, setRetros, setBlockers,
    setAdvisors, setCoachingSessions, setPlaybookEntries,
    setCurrentWeekStandup, setCurrentWeekNum, setCurrentWeekYear, setCurrentWeekRetro,
  });
  // (progressData and calendarEvents are read above, with the section they
  // belong to.)
  async function handleTaskStatusChange(taskId, newStatus) {
    try {
      const response = await fetch(`/api/ventures/${params.id}/tasks?id=${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      const data = await response.json();
      if (data.success) { fetchTasks(true); fetchProgress(true); }
    } catch {}
  }
  // The document list is ADDRESSED on the two filters, so writing in the search
  // box or choosing a category re-asks by itself: the tab no longer has to call
  // this to reload, which is why its debounce and its key-up reload are gone.
  const documentQuery = buildDocumentQuery(documentSearch, documentCategory);
  const { data: documents, refresh: fetchDocuments } = useApi(
    onJourney && journeySub === "documents"
      ? `/api/ventures/${params.id}/documents${documentQuery ? `?${documentQuery}` : ""}`
      : null,
    { defaultValue: [], transform: pickDocuments },
  );
  async function handleResolveBlocker(blockerId) {
    await fetch(`/api/ventures/${params.id}/blockers`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ blocker_id: blockerId, action: "resolve" }) });
    fetchBlockers(true);
  }
  async function handleMakePrimaryAdvisor(advisorId) {
    await fetch(`/api/ventures/${params.id}/advisors`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ advisor_id: advisorId, is_primary: true }) });
    fetchAdvisors(true);
  }
  async function handleRemoveAdvisor(advisorId) {
    if (!(await confirm({ message: t('venture.confirmRemoveAdvisor'), tone: "danger" }))) return;
    await fetch(`/api/ventures/${params.id}/advisors`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ advisor_id: advisorId, action: "remove" }) });
    fetchAdvisors(true);
  }
  async function handleDocumentTransition(docId, approval_status) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "transition", document_id: docId, approval_status }) });
    await fetchDocuments(null, null, true);
  }
  async function handleDocumentUpdate(docId, file_url) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "update", document_id: docId, updates: { file_url } }) });
    fetchDocuments(null, null, true);
  }
  async function handleDocumentDelete(docId) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "delete", document_id: docId }) });
    fetchDocuments(null, null, true);
  }
  async function handleVersionRestore(file_url) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "update", document_id: versionsDoc.id, updates: { file_url } }) });
    setShowVersions(false); fetchDocuments(null, null, true);
  }
  async function handleReview(docId) {
    const response = await fetch(`/api/ventures/${params.id}/documents/${docId}/reviews`);
    const data = await response.json(); if (data.success) setReviews(data.reviews);
    setReviewDoc({id: docId}); setShowReview(true);
  }
  async function handleSubmitReview(docId, decision) {
    await fetch(`/api/ventures/${params.id}/documents/${docId}/reviews`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ comment: reviewComment, decision }) });
    setShowReview(false); setReviews([]); fetchDocuments(null, null, true);
  }
  async function handlePermissions(docId) {
    try {
      const response = await fetch(`/api/ventures/${params.id}/documents/${docId}/permissions`);
      const data = await response.json();
      if (data.success) {
        setPermissions(mergePermissionRoles(data.permissions || []));
      }
    } catch{}
    setPermissionsDoc({id: docId}); setShowPermissions(true);
  }
  async function handleSavePermission(docId, role_scope, access_level) {
    await fetch(`/api/ventures/${params.id}/documents/${docId}/permissions`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ role_scope, access_level }) });
    handlePermissions(docId);
  }
  const { data: investmentReadiness, refresh: fetchInvestmentReadiness } = useApi(
    ready && activeTab === "investment"
      ? `/api/ventures/${params.id}/investment-readiness`
      : null,
    { defaultValue: null, transform: pickInvestmentReadiness },
  );

  // Configurable taxonomies (Phase 4 — Venture Setup): fall back to built-ins.
  // Read once, and it does not depend on the address being visited.
  const { data: optionLists } = useApi("/api/venture-options", {
    defaultValue: {},
    transform: pickOptionLists,
  });

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = ventureToPayload(params.id, form);
      const response = await fetch("/api/ventures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      notifyMsg(data.success ? t("venture.updateSuccess") : (data.error || t("venture.updateError")));
    } catch {
      notifyMsg(t("venture.updateError"));
    } finally { setSaving(false); }
  }

  async function handleUpdateMemberRole(memberId, newRole) {
    try {
      const response = await fetch(`/api/ventures/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, role: newRole }),
      });
      const data = await response.json();
      if (!data.success) notifyMsg(t(data.error || "") || data.error);
      else loadMembers(true);
    } catch (error) { notifyMsg(t(error.message || "") || error.message); }
  }

  // Invite (not add): the person is emailed a link and joins by accepting it.
  async function handleInviteMember() {
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      notifyMsg(t("venture.inviteEmailInvalid"));
      return;
    }
    setInviting(true);
    try {
      const response = await fetch(`/api/ventures/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, member_type: addMemberType }),
      });
      const data = await response.json();
      if (data.success) {
        setShowAddMember(false);
        setInviteEmail("");
        // The invitation is saved either way; a delivery failure must not read
        // as "sent". Tell the founder the email did not go out so they can retry.
        if (data.email_sent === false) {
          notifyMsg(t("venture.invitationSavedEmailFailed"), "error");
        } else {
          notifyMsg(t("venture.invitationSent"));
        }
        await loadInvitations();
      } else {
        notifyMsg(t(data.error || "") || data.error || t("venture.inviteFailed"));
      }
    } catch {
      notifyMsg(t("venture.inviteFailed"));
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId) {
    try {
      const response = await fetch(`/api/ventures/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, action: "remove" }),
      });
      const data = await response.json();
      if (data.success) {
        setRemoveConfirm(null);
        await loadMembers(true);
      } else {
        notifyMsg(t((data.error || t("venture.removeError")) || "") || (data.error || t("venture.removeError")));
      }
    } catch { notifyMsg(t("venture.removeError")); }
  }

  async function handleRevokeInvitation(invitationId) {
    try {
      const response = await fetch(`/api/ventures/${params.id}/member-invitations?id=${invitationId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        notifyMsg(t("venture.invitationRevoked"));
        await loadInvitations();
      } else {
        notifyMsg(t(data.error || "") || data.error || t("venture.inviteFailed"));
      }
    } catch {
      notifyMsg(t("venture.inviteFailed"));
    }
  }

  // Workspace context — everything the extracted tab components may consume
  // (Phase 2). Provided under the same identifiers the tabs destructure.
  const ws = {
    params, user, inputStyle, cardStyle, notifyMsg, optionLists,
    form, setForm, saving, members, dashboardData, historyData,
    bmData, setBmData, interviews, validations, assessments, milestones,
    actionPlans, tasks, standups, retros, blockers, calendarEvents,
    progressData, documents, advisors, coachingSessions,
    journeyStages, playbookEntries, investmentReadiness,
    journeyDeliverablesUnavailable: roadmap.deliverablesUnavailable,
    currentWeekStandup, currentWeekRetro, currentWeekNum, currentWeekYear,
    showAddInterview, setShowAddInterview,
    showAddValidation, setShowAddValidation,
    showAddPmf, setShowAddPmf,
    showAddMilestone, setShowAddMilestone,
    showAddAction, setShowAddAction,
    showAddTask, setShowAddTask,
    showAddStandup, setShowAddStandup,
    showAddRetro, setShowAddRetro,
    showAddBlocker, setShowAddBlocker,
    showAddDocument, setShowAddDocument,
    showAddAdvisor, setShowAddAdvisor,
    showAddCoaching, setShowAddCoaching,
    showAddMember, setShowAddMember,
    showVersions, setShowVersions, versionsDoc, setVersionsDoc, versions, setVersions,
    showReview, setShowReview, reviewDoc, setReviewDoc, reviewComment, setReviewComment, reviews, setReviews,
    showPermissions, setShowPermissions, permissionsDoc, setPermissionsDoc, permissions, setPermissions,
    showEditCoaching, setShowEditCoaching, editingCoaching, setEditingCoaching,
    addMemberType, setAddMemberType, inviteEmail, setInviteEmail, inviting, removeConfirm, setRemoveConfirm,
    invitations, handleInviteMember, handleRevokeInvitation,
    interviewForm, setInterviewForm, validationForm, setValidationForm, pmfForm, setPmfForm,
    milestoneForm, setMilestoneForm, actionForm, setActionForm, taskForm, setTaskForm,
    standupForm, setStandupForm, retroForm, setRetroForm, blockerForm, setBlockerForm,
    documentForm, setDocumentForm, advisorForm, setAdvisorForm, coachingForm, setCoachingForm,
    documentSearch, setDocumentSearch, documentCategory, setDocumentCategory,
    loadMembers, handleSave, handleUpdateMemberRole, handleRemoveMember,
    handleTaskStatusChange, handleResolveBlocker, handleMakePrimaryAdvisor, handleRemoveAdvisor,
    handleDocumentTransition, handleDocumentUpdate, handleDocumentDelete, handleVersionRestore,
    handleReview, handleSubmitReview, handlePermissions, handleSavePermission,
    fetchBm, fetchInterviews, fetchValidations, fetchPmf, fetchMilestones, fetchActionPlans,
    fetchTasks, fetchStandups, fetchRetros, fetchBlockers, fetchCalendar, fetchProgress,
    fetchDocuments, fetchAdvisors, fetchCoaching,
    fetchJourney, fetchPlaybook, fetchInvestmentReadiness,
  };

  return (
    <VentureWorkspaceScreen
      loading={loading}
      venture={venture}
      brandColor={form.brandColor}
      activeTab={activeTab}
      journeySub={journeySub}
      onSection={openSection}
      onJourneySub={setJourneySub}
      onBack={() => router.push("/participant/ventures")}
      workspace={ws}
      t={t}
    />
  );
}
