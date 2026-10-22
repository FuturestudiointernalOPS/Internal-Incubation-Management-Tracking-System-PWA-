"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import VentureWorkspaceScreen from "@/components/participant/ventures/VentureWorkspaceScreen";
import {
  pickVenture, ventureToForm, pickMembers, pickInvitations, pickDashboard,
  pickProgress, pickMyWork, pickCalendar, pickJourney, EMPTY_ROADMAP,
  pickInvestmentReadiness, pickOptionLists, TABS,
} from "@/components/participant/ventures/ventureScreenModel";
import {
  ventureToPayload, inputStyle, cardStyle, notifyMsg,
} from "@/components/participant/ventures/ventureScreenHelpers";
import { createVentureLoaders } from "@/components/participant/ventures/ventureScreenLoaders";

export default function VentureDetail() {
  const [saving, setSaving] = useState(false);

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
  const searchParams = useSearchParams();

  // The open tab lives in the address (`?tab=`), so a reload, a shared link or a
  // bookmark lands on the same tab instead of falling back to the dashboard.
  // Derived, never copied into state: the address is the single source.
  const requestedTab = searchParams?.get("tab");
  const activeTab = TABS.includes(requestedTab) ? requestedTab : "dashboard";

  // The signed-in identity comes from the shell's session cache rather than the
  // browser's stored copy, so it needs no effect and no read of its own.
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser || {};

  // The venture record is read through the shared hook, which owns the cache,
  // the cache-first paint and the discarding of a stale answer.
  const { data: venture, loading, status: ventureStatus, refresh: refreshVenture } = useApi(
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
    if (section === activeTab) return;
    router.replace(
      section === "dashboard"
        ? `/participant/ventures/${params.id}`
        : `/participant/ventures/${params.id}?tab=${section}`,
      { scroll: false },
    );
  }

  // ── The screen's reads ───────────────────────────────────────────────────
  // Arriving on a section IS the request, so nothing has to decide WHEN to
  // load: each read's ADDRESS says which section is asking, and a section that
  // is not open reads nothing. `ready` is the guard the old loader effect used
  // - the Venture record has to be known before its sub-resources are asked for.
  const ready = !!params.id && !!venture;
  const onDashboard = ready && activeTab === "dashboard";

  // The roster is the TEAM tab's read. The dashboard no longer needs it: its
  // people figures now come from the dashboard aggregate (`team`), so one read
  // has stopped being fetched to be unused.
  const { data: members, loading: membersLoading, refresh: loadMembers } = useApi(
    ready && activeTab === "team" ? `/api/ventures/${params.id}/members` : null,
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

  const { data: dashboardData, loading: dashboardLoading } = useApi(
    onDashboard ? `/api/ventures/${params.id}/dashboard` : null,
    { defaultValue: null, transform: pickDashboard },
  );

  const {
    data: progressData,
    loading: progressLoading,
    error: progressError,
    status: progressStatus,
    refresh: fetchProgress,
  } = useApi(
    onDashboard ? `/api/ventures/${params.id}/progress` : null,
    { defaultValue: null, transform: pickProgress },
  );
  // Same three failure shapes as the work queue: a refused or broken read must
  // never be drawn as 0%.
  const progressFailed =
    Boolean(progressError) || (progressStatus !== null && progressStatus >= 400);

  // The caller's own work queue (WS1). Addressed on the dashboard only, so the
  // Journey tab never pays for it.
  const {
    data: myWork,
    loading: myWorkLoading,
    error: myWorkError,
    status: myWorkStatus,
    refresh: fetchMyWork,
  } = useApi(
    onDashboard ? `/api/ventures/${params.id}/my-work` : null,
    { defaultValue: null, transform: pickMyWork },
  );

  // THREE ways this read can fail, and none of them is an empty queue: a network
  // throw (`error`), an HTTP refusal (`status` ≥ 400), or a 200 body carrying
  // `success: false` (which the shaper turns into null). The screen must say so
  // rather than showing zero counts.
  const myWorkFailed =
    Boolean(myWorkError) || (myWorkStatus !== null && myWorkStatus >= 400);

  const { data: calendarEvents, loading: calendarLoading, refresh: fetchCalendar } = useApi(
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
      if (data.success) {
        // The profile changed, so the setup score must not be served from the
        // 30-second read cache. Refresh the record and the progress read now.
        await refreshVenture();
        fetchProgress(true);
      }
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
    form, setForm, saving, members, membersLoading, dashboardData, historyData,
    dashboardLoading, calendarLoading,
    actionPlans, tasks, standups, retros, blockers, calendarEvents,
    progressData, advisors, coachingSessions,
    progressLoading, progressFailed,
    myWork, myWorkLoading, myWorkFailed,
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
    showAddAdvisor, setShowAddAdvisor,
    showAddCoaching, setShowAddCoaching,
    showAddMember, setShowAddMember,
    showEditCoaching, setShowEditCoaching, editingCoaching, setEditingCoaching,
    addMemberType, setAddMemberType, inviteEmail, setInviteEmail, inviting, removeConfirm, setRemoveConfirm,
    invitations, handleInviteMember, handleRevokeInvitation,
    interviewForm, setInterviewForm, validationForm, setValidationForm, pmfForm, setPmfForm,
    milestoneForm, setMilestoneForm, actionForm, setActionForm, taskForm, setTaskForm,
    standupForm, setStandupForm, retroForm, setRetroForm, blockerForm, setBlockerForm,
    advisorForm, setAdvisorForm, coachingForm, setCoachingForm,
    loadMembers, handleSave, handleUpdateMemberRole, handleRemoveMember,
    handleTaskStatusChange, handleResolveBlocker, handleMakePrimaryAdvisor, handleRemoveAdvisor,
    fetchActionPlans, fetchTasks, fetchStandups, fetchRetros, fetchBlockers,
    fetchCalendar, fetchProgress,
    fetchMyWork,
    fetchAdvisors, fetchCoaching,
    fetchJourney, fetchPlaybook, fetchInvestmentReadiness,
  };

  return (
    <VentureWorkspaceScreen
      loading={loading}
      notFound={ventureStatus === 404 || ventureStatus === 403}
      venture={venture}
      brandColor={form.brandColor}
      activeTab={activeTab}
      onSection={openSection}
      onBack={() => router.push("/participant/ventures")}
      workspace={ws}
      t={t}
    />
  );
}
