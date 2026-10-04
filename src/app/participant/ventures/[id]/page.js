"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useRouter, useParams } from "next/navigation";
import { cacheGet, cacheSet, useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import { VentureWorkspace } from "@/components/ventures/workspace/VentureContext";
import VentureWorkspaceView from "@/components/participant/ventures/VentureWorkspaceView";
import {
  pickVenture, ventureToForm, pickMembers, pickInvitations, pickDashboard,
  pickProgress, pickCalendar, pickJourney, EMPTY_ROADMAP, pickBm,
  pickInterviews, pickValidations, pickAssessments, pickMilestones,
  pickDocuments, pickInvestmentReadiness, pickOptionLists,
} from "@/components/participant/ventures/ventureScreenModel";

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
  async function fetchActionPlans(bypassCache = false) {
    const url = `/api/ventures/${params.id}/action-plans`;
    const apply = (payload) => { if (payload.success) setActionPlans(payload.action_plans); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchTasks(bypassCache = false) {
    const url = `/api/ventures/${params.id}/tasks`;
    const apply = (payload) => { if (payload.success) setTasks(payload.tasks || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchStandups(bypassCache = false) {
    const url = `/api/ventures/${params.id}/standups`;
    const apply = (payload) => { if (payload.success) { setStandups(payload.standups || []); setCurrentWeekStandup(payload.current_week_submitted !== false); setCurrentWeekNum(payload.current_week); setCurrentWeekYear(payload.current_year); } };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchRetros(bypassCache = false) {
    const url = `/api/ventures/${params.id}/retros`;
    const apply = (payload) => { if (payload.success) { setRetros(payload.retros || []); setCurrentWeekRetro(payload.current_week_submitted !== false); setCurrentWeekNum(payload.current_week); setCurrentWeekYear(payload.current_year); } };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchBlockers(bypassCache = false) {
    const url = `/api/ventures/${params.id}/blockers`;
    const apply = (payload) => { if (payload.success) setBlockers(payload.blockers || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
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
  const documentParams = new URLSearchParams();
  if (documentSearch) documentParams.set("search", documentSearch);
  if (documentCategory) documentParams.set("category", documentCategory);
  const documentQuery = documentParams.toString();
  const { data: documents, refresh: fetchDocuments } = useApi(
    onJourney && journeySub === "documents"
      ? `/api/ventures/${params.id}/documents${documentQuery ? `?${documentQuery}` : ""}`
      : null,
    { defaultValue: [], transform: pickDocuments },
  );
  async function fetchAdvisors(bypassCache = false) {
    const url = `/api/ventures/${params.id}/advisors`;
    const apply = (payload) => { if (payload.success) setAdvisors(payload.advisors || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchCoaching(bypassCache = false) {
    const url = `/api/ventures/${params.id}/coaching`;
    const apply = (payload) => { if (payload.success) setCoachingSessions(payload.sessions || payload.coaching_sessions || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
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
        // Ensure all roles are present
        const existing = data.permissions || [];
        const roles = ['founder','team','advisor','administrator','investor'];
        const merged = roles.map(role => {
          const found = existing.find(permission => permission.role_scope === role);
          return found || { role_scope: role, access_level: 'view' };
        });
        setPermissions(merged);
      }
    } catch{}
    setPermissionsDoc({id: docId}); setShowPermissions(true);
  }
  async function handleSavePermission(docId, role_scope, access_level) {
    await fetch(`/api/ventures/${params.id}/documents/${docId}/permissions`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ role_scope, access_level }) });
    handlePermissions(docId);
  }
  async function fetchPlaybook(bypassCache = false) {
    const url = `/api/ventures/${params.id}/playbook`;
    const apply = (payload) => { if (payload.success) setPlaybookEntries(payload.playbook || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
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
      const payload = {
        id: params.id,
        name: form.name, description: form.description || null,
        mission: form.mission || null, vision: form.vision || null,
        industry: form.industry || null, sector: form.sector || null,
        business_stage: form.business_stage, website: form.website || null,
        country: form.country || null, country_code: form.country_code || null, registration_status: form.registration_status || null,
        north_star: form.north_star || null,
        social_media: { twitter: form.twitter || "", linkedin: form.linkedin || "", instagram: form.instagram || "", facebook: form.facebook || "" },
        status: form.status, visibility: form.visibility, language: form.language,
        branding: { color: form.brandColor || "#f60" },
      };
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

  const notifyMsg = (message, type = "info") => window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message: String(message || ""), duration: 4000 } }));

  const inputStyle = { backgroundColor: "rgb(15 23 42)", borderColor: "rgb(255 255 255 / 0.15)", color: "var(--text-primary)" };
  const cardStyle = { backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)" };

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

  if (loading) return (
    <>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: "var(--text-secondary)" }} size={32} /></div>
    </>
  );

  if (!venture) return (
    <>
      <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.loadError")}</div>
    </>
  );

  return (
    <VentureWorkspace.Provider value={ws}>
      {/* Edge spacing belongs to the SHELL (DashboardLayout's main already pads
          every page); this page used to add its own p-6 on top, which doubled the
          gap to the edges. The width cap matches the stand-alone Venture
          dashboard so the workspace uses the screen instead of hugging a narrow
          column in the middle. */}
      <VentureWorkspaceView
        venture={venture}
        brandColor={form.brandColor}
        activeTab={activeTab}
        journeySub={journeySub}
        onSection={openSection}
        onJourneySub={setJourneySub}
        onBack={() => router.push("/participant/ventures")}
        t={t}
      />
    </VentureWorkspace.Provider>
  );
}
