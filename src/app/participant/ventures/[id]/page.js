"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter, useParams } from "next/navigation";
import VenturePageHeader from "@/components/ventures/VenturePageHeader";
import { VentureWorkspace } from "@/components/ventures/workspace/VentureContext";
import { ProfileTab, SettingsTab } from "@/components/ventures/workspace/tabs/ProfileSettingsTabs";
import { FoundersTab, TeamTab } from "@/components/ventures/workspace/tabs/MembersTabs";
import { DashboardTab, ProgressTab } from "@/components/ventures/workspace/tabs/DashboardHistoryTabs";
import { JourneyTab, BusinessModelTab } from "@/components/ventures/workspace/tabs/JourneyPlaybookTabs";
import { DiscoveryTab, ValidationTab, PmfTab } from "@/components/ventures/workspace/tabs/LeanStartupTabs";
import { MilestonesTab, ActionPlansTab, TasksTab } from "@/components/ventures/workspace/tabs/MilestoneTabs";
import { CalendarTab } from "@/components/ventures/workspace/tabs/ScheduleTabs";
import { DocumentsTab } from "@/components/ventures/workspace/tabs/DocumentsTabs";
import { AdvisorsTab, KpisTab, InvestmentTab } from "@/components/ventures/workspace/tabs/GrowthTabs";

const TABS = [
  "profile", "settings", "founders", "team", "dashboard",
  // "history", // Program history — staff/admin view only (not founder-facing)
  "journey",
  // "playbook", // Facilitator review guide — staff only
  "businessModel", "discovery", "validation", "pmf", "milestones", "actionPlans", "tasks",
  // "standups", "retros", "blockers", // Weekly review reports — staff/facilitator only
  "calendar", "progress", "documents", "advisors",
  // "coaching", // Coaching/session management — facilitator only
  "kpis", "investment",
];
const STAGES = ["idea", "validation", "mvp", "growth", "scale"];
const INDUSTRY_FALLBACK = ["Fintech", "Healthtech", "Edtech", "Cleantech", "SaaS", "E-commerce", "Agritech", "Logistics", "AI / ML", "Blockchain", "Media & Entertainment", "Real Estate", "Other"];
const STATUSES = ["active", "paused", "graduated", "archived"];
const VISIBILITIES = ["private", "public", "inviteOnly"];

export default function VentureDetail() {
  const [user, setUser] = useState({});
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({});

  // Members state
  const [members, setMembers] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  // Track 2 state
  const [bmData, setBmData] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [validations, setValidations] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [milestones, setMilestones] = useState([]);
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
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddRetro, setShowAddRetro] = useState(false);
  const [showAddBlocker, setShowAddBlocker] = useState(false);
  const [taskForm, setTaskForm] = useState({});
  const [standupForm, setStandupForm] = useState({});
  const [retroForm, setRetroForm] = useState({});
  const [blockerForm, setBlockerForm] = useState({});

  // Configurable taxonomies (Phase 4 — Venture Setup): fall back to built-ins
  const [optionLists, setOptionLists] = useState({ business_stage: [], industry: [] });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/venture-options");
        const d = await res.json();
        if (d.success) {
          const byType = {};
          for (const o of d.options || []) {
            (byType[o.option_type] = byType[o.option_type] || []).push(o.value);
          }
          setOptionLists(byType);
        }
      } catch (_) {}
    })();
  }, []);

  // Track 4 state
  const [documents, setDocuments] = useState([]);
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
  const [journeyStages, setJourneyStages] = useState([]);
  const [playbookEntries, setPlaybookEntries] = useState([]);
  const [investmentReadiness, setInvestmentReadiness] = useState(null);
  const [currentWeekStandup, setCurrentWeekStandup] = useState(true);
  const [currentWeekRetro, setCurrentWeekRetro] = useState(true);
  const [currentWeekNum, setCurrentWeekNum] = useState(null);
  const [currentWeekYear, setCurrentWeekYear] = useState(null);

  // Track 5 state
  const [advisors, setAdvisors] = useState([]);
  const [coachingSessions, setCoachingSessions] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [kpiDefinitions, setKpiDefinitions] = useState([]);
  const [showAddAdvisor, setShowAddAdvisor] = useState(false);
  const [showAddCoaching, setShowAddCoaching] = useState(false);
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [showAddKpiDefinition, setShowAddKpiDefinition] = useState(false);
  const [editingKpiDef, setEditingKpiDef] = useState(null);
  const [showEditCoaching, setShowEditCoaching] = useState(false);
  const [editingCoaching, setEditingCoaching] = useState(null);
  const [advisorForm, setAdvisorForm] = useState({});
  const [coachingForm, setCoachingForm] = useState({});
  const [kpiForm, setKpiForm] = useState({});
  const [kpiDefForm, setKpiDefForm] = useState({});
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentCategory, setDocumentCategory] = useState('');

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberType, setAddMemberType] = useState("founder");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  // Load venture
  useEffect(() => {
    if (!params.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${params.id}`);
        const d = await res.json();
        if (d.success) {
          setVenture(d.venture);
          const v = d.venture;
          setForm({
            name: v.name || "",
            description: v.description || "",
            mission: v.mission || "",
            vision: v.vision || "",
            industry: v.industry || "",
            sector: v.sector || "",
            business_stage: v.business_stage || "idea",
            website: v.website || "",
            twitter: v.social_media?.twitter || "",
            linkedin: v.social_media?.linkedin || "",
            instagram: v.social_media?.instagram || "",
            status: v.status || "active",
            visibility: v.visibility || "private",
            language: v.language || "en",
            brandColor: v.branding?.color || "#f60",
          });
        }
      } catch (e) {
        console.error("Failed to load venture", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  // Load members, dashboard, history for their tabs
  useEffect(() => {
    if (!params.id || !venture) return;
    if (activeTab === "founders" || activeTab === "team") loadMembers();
    if (activeTab === "dashboard") { loadDashboard(); fetchProgress(); }
    if (activeTab === "history") loadHistory();
    if (activeTab === "businessModel") fetchBm();
    if (activeTab === "discovery") fetchInterviews();
    if (activeTab === "validation") fetchValidations();
    if (activeTab === "pmf") fetchPmf();
    if (activeTab === "milestones") fetchMilestones();
    if (activeTab === "actionPlans") fetchActionPlans();
    if (activeTab === "tasks") fetchTasks();
    if (activeTab === "standups") { fetchStandups(); fetchTasks(); }
    if (activeTab === "retros") fetchRetros();
    if (activeTab === "blockers") { fetchBlockers(); fetchRetros(); fetchTasks(); }
    if (activeTab === "calendar") fetchCalendar();
    if (activeTab === "progress") fetchProgress();
    if (activeTab === "documents") fetchDocuments();
    if (activeTab === "advisors") fetchAdvisors();
    if (activeTab === "coaching") { fetchCoaching(); fetchAdvisors(); }
    if (activeTab === "kpis") { fetchKpis(); fetchKpiDefinitions(); }
    if (activeTab === "journey") fetchJourney();
    if (activeTab === "playbook") fetchPlaybook();
    if (activeTab === "investment") fetchInvestmentReadiness();
  }, [activeTab, venture, params.id]);

  async function loadMembers() {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`);
      const d = await res.json();
      if (d.success) setMembers(d.members);
    } catch (e) { console.error(e); }
  }

  async function loadDashboard() {
    try {
      const res = await fetch(`/api/ventures/${params.id}/dashboard`);
      const d = await res.json();
      if (d.success) setDashboardData(d.dashboard);
    } catch (e) { console.error(e); }
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/ventures/${params.id}/history`);
      const d = await res.json();
      if (d.success) setHistoryData(d);
    } catch (e) { console.error(e); }
  }

  async function fetchBm() {
    try { const r = await fetch(`/api/ventures/${params.id}/business-model`); const d = await r.json(); if (d.success) setBmData(d.business_model); } catch(e){}
  }
  async function fetchInterviews() {
    try { const r = await fetch(`/api/ventures/${params.id}/interviews`); const d = await r.json(); if (d.success) setInterviews(d.interviews); } catch(e){}
  }
  async function fetchValidations() {
    try { const r = await fetch(`/api/ventures/${params.id}/validations`); const d = await r.json(); if (d.success) setValidations(d.validations); } catch(e){}
  }
  async function fetchPmf() {
    try { const r = await fetch(`/api/ventures/${params.id}/pmf`); const d = await r.json(); if (d.success) setAssessments(d.assessments); } catch(e){}
  }
  async function fetchMilestones() {
    try { const r = await fetch(`/api/ventures/${params.id}/milestones`); const d = await r.json(); if (d.success) setMilestones(d.milestones); } catch(e){}
  }
  async function fetchActionPlans() {
    try { const r = await fetch(`/api/ventures/${params.id}/action-plans`); const d = await r.json(); if (d.success) setActionPlans(d.action_plans); } catch(e){}
  }
  async function fetchTasks() {
    try { const r = await fetch(`/api/ventures/${params.id}/tasks`); const d = await r.json(); if (d.success) setTasks(d.tasks || []); } catch(e){}
  }
  async function fetchStandups() {
    try { const r = await fetch(`/api/ventures/${params.id}/standups`); const d = await r.json(); if (d.success) { setStandups(d.standups || []); setCurrentWeekStandup(d.current_week_submitted !== false); setCurrentWeekNum(d.current_week); setCurrentWeekYear(d.current_year); } } catch(e){}
  }
  async function fetchRetros() {
    try { const r = await fetch(`/api/ventures/${params.id}/retros`); const d = await r.json(); if (d.success) { setRetros(d.retros || []); setCurrentWeekRetro(d.current_week_submitted !== false); setCurrentWeekNum(d.current_week); setCurrentWeekYear(d.current_year); } } catch(e){}
  }
  async function fetchBlockers() {
    try { const r = await fetch(`/api/ventures/${params.id}/blockers`); const d = await r.json(); if (d.success) setBlockers(d.blockers || []); } catch(e){}
  }
  async function fetchCalendar() {
    try { const r = await fetch(`/api/ventures/${params.id}/calendar`); const d = await r.json(); if (d.success) setCalendarEvents(d.events || []); } catch(e){}
  }
  async function handleTaskStatusChange(taskId, newStatus) {
    try {
      const r = await fetch(`/api/ventures/${params.id}/tasks?id=${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      const d = await r.json();
      if (d.success) { fetchTasks(); fetchProgress(); }
    } catch(e) {}
  }
  async function fetchProgress() {
    try { const r = await fetch(`/api/ventures/${params.id}/progress`); const d = await r.json(); if (d.success) setProgressData(d.progress); } catch(e){}
  }
  async function fetchDocuments(search, cat) {
    try { const p = new URLSearchParams(); if (search||documentSearch) p.set('search', search||documentSearch); if (cat||documentCategory) p.set('category', cat||documentCategory);
    const r = await fetch(`/api/ventures/${params.id}/documents?${p.toString()}`); const d = await r.json(); if (d.success) setDocuments(d.documents || []); } catch(e){}
  }
  async function fetchAdvisors() {
    try { const r = await fetch(`/api/ventures/${params.id}/advisors`); const d = await r.json(); if (d.success) setAdvisors(d.advisors || []); } catch(e){}
  }
  async function fetchCoaching() {
    try { const r = await fetch(`/api/ventures/${params.id}/coaching`); const d = await r.json(); if (d.success) setCoachingSessions(d.sessions || d.coaching_sessions || []); } catch(e){}
  }
  async function fetchKpis() {
    try { const r = await fetch(`/api/ventures/${params.id}/kpis`); const d = await r.json(); if (d.success) setKpis(d.kpis || []); } catch(e){}
  }
  async function fetchKpiDefinitions() {
    try { const r = await fetch(`/api/venture-kpi-definitions`); const d = await r.json(); if (d.success) setKpiDefinitions(d.kpi_definitions || []); } catch(e){}
  }
  async function handleResolveBlocker(blockerId) {
    await fetch(`/api/ventures/${params.id}/blockers`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ blocker_id: blockerId, action: "resolve" }) });
    fetchBlockers();
  }
  async function handleMakePrimaryAdvisor(advisorId) {
    await fetch(`/api/ventures/${params.id}/advisors`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ advisor_id: advisorId, is_primary: true }) });
    fetchAdvisors();
  }
  async function handleRemoveAdvisor(advisorId) {
    if (!confirm(t('venture.confirmRemove')||'Remove this advisor?')) return;
    await fetch(`/api/ventures/${params.id}/advisors`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ advisor_id: advisorId, action: "remove" }) });
    fetchAdvisors();
  }
  async function handleDocumentTransition(docId, approval_status) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "transition", document_id: docId, approval_status }) });
    await fetchDocuments();
  }
  async function handleDocumentUpdate(docId, file_url) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "update", document_id: docId, updates: { file_url } }) });
    fetchDocuments();
  }
  async function handleDocumentDelete(docId) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "delete", document_id: docId }) });
    fetchDocuments();
  }
  async function handleVersionRestore(file_url) {
    await fetch(`/api/ventures/${params.id}/documents`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "update", document_id: versionsDoc.id, updates: { file_url } }) });
    setShowVersions(false); fetchDocuments();
  }
  async function handleReview(docId) {
    const r = await fetch(`/api/ventures/${params.id}/documents/${docId}/reviews`);
    const d = await r.json(); if (d.success) setReviews(d.reviews);
    setReviewDoc({id: docId}); setShowReview(true);
  }
  async function handleSubmitReview(docId, decision) {
    await fetch(`/api/ventures/${params.id}/documents/${docId}/reviews`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ comment: reviewComment, decision }) });
    setShowReview(false); setReviews([]); fetchDocuments();
  }
  async function handlePermissions(docId) {
    try {
      const r = await fetch(`/api/ventures/${params.id}/documents/${docId}/permissions`);
      const d = await r.json();
      if (d.success) {
        // Ensure all roles are present
        const existing = d.permissions || [];
        const roles = ['founder','team','advisor','administrator','investor'];
        const merged = roles.map(role => {
          const found = existing.find(p => p.role_scope === role);
          return found || { role_scope: role, access_level: 'view' };
        });
        setPermissions(merged);
      }
    } catch(e){}
    setPermissionsDoc({id: docId}); setShowPermissions(true);
  }
  async function handleSavePermission(docId, role_scope, access_level) {
    await fetch(`/api/ventures/${params.id}/documents/${docId}/permissions`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ role_scope, access_level }) });
    handlePermissions(docId);
  }
  async function fetchJourney() {
    try { const r = await fetch(`/api/ventures/${params.id}/journey`); const d = await r.json(); if (d.success) setJourneyStages(d.stages || []); } catch(e){}
  }
  async function fetchPlaybook() {
    try { const r = await fetch(`/api/ventures/${params.id}/playbook`); const d = await r.json(); if (d.success) setPlaybookEntries(d.playbook || []); } catch(e){}
  }
  async function fetchInvestmentReadiness() {
    try { const r = await fetch(`/api/ventures/${params.id}/investment-readiness`); const d = await r.json(); if (d.success) setInvestmentReadiness(d.investment_readiness); } catch(e){}
  }
  async function handleCompleteStage(stageId) {
    await fetch(`/api/ventures/${params.id}/journey`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ stage_id: stageId, action: 'complete' }) });
    fetchJourney();
  }
  async function handleUpdateKpi(assignmentId, current_value) {
    await fetch(`/api/ventures/${params.id}/kpis`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id: assignmentId, current_value }) });
    fetchKpis();
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: params.id,
        name: form.name, description: form.description || null,
        mission: form.mission || null, vision: form.vision || null,
        industry: form.industry || null, sector: form.sector || null,
        business_stage: form.business_stage, website: form.website || null,
        country: form.country || null, registration_status: form.registration_status || null,
        north_star: form.north_star || null,
        social_media: { twitter: form.twitter || "", linkedin: form.linkedin || "", instagram: form.instagram || "" },
        status: form.status, visibility: form.visibility, language: form.language,
        branding: { color: form.brandColor || "#f60" },
      };
      const res = await fetch("/api/ventures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      notifyMsg(d.success ? t("venture.updateSuccess") : (d.error || t("venture.updateError")));
    } catch (e) {
      notifyMsg(t("venture.updateError"));
    } finally { setSaving(false); }
  }

  const FOUNDER_ROLES = ["Founder", "Lead Founder", "Co-Founder", "Technical Founder", "Business Founder"];
  const TEAM_ROLES = ["Team Member", "Developer", "Designer", "Product Manager", "Marketing", "Operations", "Advisor"];

  async function handleUpdateMemberRole(memberId, newRole) {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, role: newRole }),
      });
      const d = await res.json();
      if (!d.success) notifyMsg(t(d.error || "") || d.error);
      else loadMembers();
    } catch (e) { notifyMsg(t(e.message || "") || e.message); }
  }

  async function handleAddMember(contactId) {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, member_type: addMemberType, invited_by: user.cid }),
      });
      const d = await res.json();
      if (d.success) {
        setShowAddMember(false);
        setSearchQuery("");
        setSearchResults([]);
        await loadMembers();
      } else {
        notifyMsg(t((d.error || t("venture.addError")) || "") || (d.error || t("venture.addError")));
      }
    } catch (e) { notifyMsg(t("venture.addError")); }
  }

  async function handleRemoveMember(memberId) {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, action: "remove" }),
      });
      const d = await res.json();
      if (d.success) {
        setRemoveConfirm(null);
        await loadMembers();
      } else {
        notifyMsg(t((d.error || t("venture.removeError")) || "") || (d.error || t("venture.removeError")));
      }
    } catch (e) { notifyMsg(t("venture.removeError")); }
  }

  async function searchContacts(q) {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      // Scoped to the venture's program: external users may only search
      // within their own program context (MVP boundary), never the general
      // Future Studio CRM directory.
      const programId = venture?.program_id;
      if (!programId) { setSearchResults([]); return; }
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}&program_id=${encodeURIComponent(programId)}`);
      const d = await res.json();
      if (d.success) {
        const existingIds = new Set(members.map(m => m.contact_id));
        setSearchResults((d.contacts || []).filter(c => !existingIds.has(c.cid)));
      }
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }

  const notifyMsg = (msg, type = "info") => window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message: String(msg || ""), duration: 4000 } }));

  const inputStyle = { backgroundColor: "rgb(15 23 42)", borderColor: "rgb(255 255 255 / 0.15)", color: "var(--text-primary)" };
  const cardStyle = { backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)" };

  // Workspace context — everything the extracted tab components may consume
  // (Phase 2). Provided under the same identifiers the tabs destructure.
  const ws = {
    params, user, inputStyle, cardStyle, notifyMsg, optionLists,
    form, setForm, saving, members, dashboardData, historyData,
    bmData, setBmData, interviews, validations, assessments, milestones,
    actionPlans, tasks, standups, retros, blockers, calendarEvents,
    progressData, documents, advisors, coachingSessions, kpis, kpiDefinitions,
    journeyStages, playbookEntries, investmentReadiness,
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
    showAddKpi, setShowAddKpi,
    showAddKpiDefinition, setShowAddKpiDefinition,
    showAddMember, setShowAddMember,
    showVersions, setShowVersions, versionsDoc, setVersionsDoc, versions, setVersions,
    showReview, setShowReview, reviewDoc, setReviewDoc, reviewComment, setReviewComment, reviews, setReviews,
    showPermissions, setShowPermissions, permissionsDoc, setPermissionsDoc, permissions, setPermissions,
    editingKpiDef, setEditingKpiDef, showEditCoaching, setShowEditCoaching, editingCoaching, setEditingCoaching,
    addMemberType, setAddMemberType, searchQuery, setSearchQuery, searchResults, setSearchResults, searching, removeConfirm, setRemoveConfirm,
    interviewForm, setInterviewForm, validationForm, setValidationForm, pmfForm, setPmfForm,
    milestoneForm, setMilestoneForm, actionForm, setActionForm, taskForm, setTaskForm,
    standupForm, setStandupForm, retroForm, setRetroForm, blockerForm, setBlockerForm,
    documentForm, setDocumentForm, advisorForm, setAdvisorForm, coachingForm, setCoachingForm,
    kpiForm, setKpiForm, kpiDefForm, setKpiDefForm, documentSearch, setDocumentSearch, documentCategory, setDocumentCategory,
    loadMembers, handleSave, handleUpdateMemberRole, handleAddMember, handleRemoveMember, searchContacts,
    handleTaskStatusChange, handleResolveBlocker, handleMakePrimaryAdvisor, handleRemoveAdvisor,
    handleDocumentTransition, handleDocumentUpdate, handleDocumentDelete, handleVersionRestore,
    handleReview, handleSubmitReview, handlePermissions, handleSavePermission,
    handleCompleteStage, handleUpdateKpi,
    fetchBm, fetchInterviews, fetchValidations, fetchPmf, fetchMilestones, fetchActionPlans,
    fetchTasks, fetchStandups, fetchRetros, fetchBlockers, fetchCalendar, fetchProgress,
    fetchDocuments, fetchAdvisors, fetchCoaching, fetchKpis, fetchKpiDefinitions,
    fetchJourney, fetchPlaybook, fetchInvestmentReadiness,
  };

  if (loading) return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: "var(--text-secondary)" }} size={32} /></div>
    </DashboardLayout>
  );

  if (!venture) return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.loadError")}</div>
    </DashboardLayout>
  );

  // Phase 1/2 shell: identity + status are shared components (see
  // components/ventures). Display name follows the admin rule company_name
  // first.
  const ventureDisplayName = venture.company_name || venture.name || "Venture";

  return (
    <DashboardLayout role={user.role || "participant"}>
      <VentureWorkspace.Provider value={ws}>
      <div className="p-6 max-w-4xl mx-auto space-y-6" style={{ color: "var(--text-primary)" }}>
        {/* Back */}
        <button onClick={() => router.push("/participant/ventures")} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={16} /> {t("venture.myVentures")}
        </button>

        {/* Venture identity — shared header component (admin-consistent) */}
        <VenturePageHeader
          displayName={ventureDisplayName}
          brandColor={form.brandColor}
          ventureId={venture.venture_id}
          status={venture.status}
          metaItems={[
            t(`venture.stages.${venture.business_stage || "idea"}`),
            venture.industry,
            venture.country,
          ]}
        />

        {/* Tabs — admin-style: scrollable, uppercase, orange active underline */}
        <div className="flex items-center gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              style={{ borderColor: activeTab === tab ? "var(--brand-orange)" : "transparent" }}
            >{t(`venture.${tab}`)}</button>
          ))}
        </div>


        {/* Tab content — Phase 2: extracted into components/ventures/workspace/tabs */}
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "founders" && <FoundersTab />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "dashboard" && <DashboardTab />}
        {/* "history" removed — program history is staff/admin-only */}
        {activeTab === "journey" && <JourneyTab />}
        {/* "playbook" removed — facilitator guide is staff-only */}
        {activeTab === "businessModel" && <BusinessModelTab />}
        {activeTab === "discovery" && <DiscoveryTab />}
        {activeTab === "validation" && <ValidationTab />}
        {activeTab === "pmf" && <PmfTab />}
        {activeTab === "milestones" && <MilestonesTab />}
        {activeTab === "actionPlans" && <ActionPlansTab />}
        {activeTab === "tasks" && <TasksTab />}
        {/* "standups", "retros", "blockers" removed — weekly review reports are staff/facilitator-only */}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "progress" && <ProgressTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "advisors" && <AdvisorsTab />}
        {/* "coaching" removed — session management is facilitator-only */}
        {activeTab === "kpis" && <KpisTab />}
        {activeTab === "investment" && <InvestmentTab />}

      </div>
      </VentureWorkspace.Provider>
    </DashboardLayout>
  );
}
