"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, UserPlus, X, Users, BarChart3, Bell, Clock, History, Briefcase, Target, Lightbulb, TrendingUp, CheckSquare, ListChecks, ChevronDown, ChevronUp, ListTodo, MessageCircle, RotateCcw, AlertTriangle, CalendarDays, Activity, FileText, GraduationCap, Award, Gauge, UserCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter, useParams } from "next/navigation";

const TABS = ["profile", "settings", "founders", "team", "dashboard", "history", "journey", "playbook", "businessModel", "discovery", "validation", "pmf", "milestones", "actionPlans", "tasks", "standups", "retros", "blockers", "calendar", "progress", "documents", "advisors", "coaching", "kpis", "investment"];
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

  function getFounders() { return members.filter(m => m.member_type === "founder"); }
  function getTeam() { return members.filter(m => m.member_type === "team_member"); }

  const notifyMsg = (msg, type = "info") => window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message: String(msg || ""), duration: 4000 } }));

  const inputStyle = { backgroundColor: "rgb(15 23 42)", borderColor: "rgb(255 255 255 / 0.15)", color: "var(--text-primary)" };
  const cardStyle = { backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)" };

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

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 max-w-4xl mx-auto space-y-6" style={{ color: "var(--text-primary)" }}>
        {/* Back */}
        <button onClick={() => router.push("/participant/ventures")} className="flex items-center gap-2 transition-colors" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={18} /> {t("venture.myVentures")}
        </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: form.brandColor || "#f60" }}>
            {venture.name?.charAt(0)?.toUpperCase() || "V"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{venture.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t(`venture.stages.${venture.business_stage || "idea"}`)}{venture.industry && <> • {venture.industry}</>}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b flex-wrap" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === tab ? "var(--brand-orange)" : "transparent",
                color: activeTab === tab ? "var(--brand-orange)" : "var(--text-secondary)",
              }}
            >{t(`venture.${tab}`)}</button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.namePlaceholder")}</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.description")}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.mission")}</label>
                  <textarea value={form.mission} onChange={e => setForm({...form, mission: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.vision")}</label>
                  <textarea value={form.vision} onChange={e => setForm({...form, vision: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.northStar")}</label>
                <textarea value={form.north_star} onChange={e => setForm({...form, north_star: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.industry")}</label>
                  <input list="venture-industry-options" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                  <datalist id="venture-industry-options">
                    {(optionLists.industry && optionLists.industry.length ? optionLists.industry : INDUSTRY_FALLBACK).map(i => <option key={i} value={i} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.sector")}</label>
                  <input value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
                <select value={form.business_stage} onChange={e => setForm({...form, business_stage: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {(optionLists.business_stage && optionLists.business_stage.length ? optionLists.business_stage : STAGES).map(s => <option key={s} value={s}>{t(`venture.stages.${s}`) || s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.website")}</label>
                <input value={form.website} onChange={e => setForm({...form, website: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder="https://" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.country")}</label>
                  <input value={form.country} onChange={e => setForm({...form, country: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.registrationStatus")}</label>
                  <select value={form.registration_status} onChange={e => setForm({...form, registration_status: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                    <option value="">—</option>
                    <option value="Not registered">{t("venture.registrationOptions.notRegistered")}</option>
                    <option value="Registered">{t("venture.registrationOptions.registered")}</option>
                    <option value="Pending registration">{t("venture.registrationOptions.pendingRegistration")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.socialMedia")}</label>
                <div className="space-y-2">
                  <input value={form.twitter} onChange={e => setForm({...form, twitter: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.twitter")} />
                  <input value={form.linkedin} onChange={e => setForm({...form, linkedin: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.linkedin")} />
                  <input value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.instagram")} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t("venture.saving") : t("venture.save")}
              </button>
            </div>
          </form>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.status")}</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {STATUSES.map(s => <option key={s} value={s}>{t(`venture.statuses.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
                <select value={form.business_stage} onChange={e => setForm({...form, business_stage: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {(optionLists.business_stage && optionLists.business_stage.length ? optionLists.business_stage : STAGES).map(s => <option key={s} value={s}>{t(`venture.stages.${s}`) || s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.visibility")}</label>
                <select value={form.visibility} onChange={e => setForm({...form, visibility: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {VISIBILITIES.map(v => <option key={v} value={v}>{t(`venture.visibilityOptions.${v}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.language")}</label>
                <select value={form.language} onChange={e => setForm({...form, language: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  <option value="en">English</option><option value="fr">Français</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.branding")}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
                    className="w-12 h-10 rounded border cursor-pointer" style={{ borderColor: "rgb(255 255 255 / 0.15)", backgroundColor: "transparent" }} />
                  <input value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
                    className="flex-1 px-3 py-2 rounded-lg outline-none border font-mono text-sm" style={inputStyle} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t("venture.saving") : t("venture.save")}
              </button>
            </div>
          </form>
        )}

        {/* Founders Tab */}
        {activeTab === "founders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("venture.founders")} ({getFounders().length})</h2>
              <button onClick={() => { setAddMemberType("founder"); setShowAddMember(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                <UserPlus size={16} /> {t("venture.addFounder")}
              </button>
            </div>
            <div className="rounded-xl border" style={cardStyle}>
              {getFounders().length === 0 ? (
                <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.noFoundersYet")}</div>
              ) : getFounders().map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <div>
                    <p className="font-medium">{m.contact_name || m.contact_id}</p>
                    <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <select value={m.role || "Founder"} onChange={e => handleUpdateMemberRole(m.id, e.target.value)}
                        className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "transparent", border: "1px solid rgb(255 255 255 / 0.15)", color: "var(--text-secondary)" }}>
                        {FOUNDER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      • {t("venture.memberSince")} {new Date(m.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => setRemoveConfirm(m)}
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
                    {t("venture.remove")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("venture.teamMembers")} ({getTeam().length})</h2>
              <button onClick={() => { setAddMemberType("team_member"); setShowAddMember(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                <UserPlus size={16} /> {t("venture.addTeamMember")}
              </button>
            </div>
            <div className="rounded-xl border" style={cardStyle}>
              {getTeam().length === 0 ? (
                <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.noTeamMembersYet")}</div>
              ) : getTeam().map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <div>
                    <p className="font-medium">{m.contact_name || m.contact_id}</p>
                    <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <select value={m.role || "Team Member"} onChange={e => handleUpdateMemberRole(m.id, e.target.value)}
                        className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "transparent", border: "1px solid rgb(255 255 255 / 0.15)", color: "var(--text-secondary)" }}>
                        {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      • {t("venture.memberSince")} {new Date(m.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => setRemoveConfirm(m)}
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
                    {t("venture.remove")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {!dashboardData ? (
              <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t("venture.founderCount"), value: dashboardData.founders?.total ?? 0, icon: Users },
                    { label: t("venture.memberCount"), value: (getFounders().length + getTeam().length) || 0, icon: Users },
                    { label: t("venture.businessStage"), value: t(`venture.stages.${dashboardData.venture?.business_stage || "idea"}`), icon: BarChart3 },
                    { label: t("venture.status"), value: t(`venture.statuses.${dashboardData.venture?.status || "active"}`), icon: Clock },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                      <stat.icon size={18} className="mb-2" style={{ color: "var(--brand-orange)" }} />
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl p-6 border" style={cardStyle}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock size={16} style={{ color: "var(--brand-orange)" }} />
                    {t("venture.recentActivity")}
                  </h3>
                  {dashboardData.recent_activity?.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noRecentActivity")}</p>
                  ) : dashboardData.recent_activity?.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--brand-orange)" }} />
                      <span className="font-medium">{a.actor || "System"}</span>
                      <span style={{ color: "var(--text-secondary)" }}>{a.action}</span>
                      <span style={{ color: "var(--text-secondary)" }}>• {new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>

                {/* Notifications */}
                <div className="rounded-xl p-6 border" style={cardStyle}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Bell size={16} style={{ color: "var(--brand-orange)" }} />
                    {t("venture.recentNotifications")} {dashboardData.notifications?.unread > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{dashboardData.notifications.unread} {t("venture.unread")}</span>}
                  </h3>
                  {!dashboardData.notifications?.recent?.length ? (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noNotifications")}</p>
                  ) : dashboardData.notifications.recent.map((n, i) => (
                    <div key={n.id || i} className="py-2 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                      <div className="flex items-center gap-2">
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                        <p className="text-sm font-medium">{n.title}</p>
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>

                {/* Progress Summary */}
                <div className="rounded-xl p-6 border" style={cardStyle}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity size={16} style={{ color: "var(--brand-orange)" }} />
                    {t("venture.progressSummary")}
                  </h3>
                  {progressData ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg p-3 border" style={cardStyle}>
                        <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.profileCompletion')||'Profile Completion'}</p>
                        <p className="text-xl font-bold mt-1" style={{color:'var(--brand-orange)'}}>{progressData.profile_completion||0}%</p>
                      </div>
                      <div className="rounded-lg p-3 border" style={cardStyle}>
                        <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.taskCompletion')}</p>
                        <p className="text-xl font-bold mt-1">{progressData.task_completion||0}%</p>
                      </div>
                      <div className="rounded-lg p-3 border" style={cardStyle}>
                        <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.avgMilestoneProgress')}</p>
                        <p className="text-xl font-bold mt-1">{progressData.avg_milestone_progress||0}%</p>
                      </div>
                      <div className="rounded-lg p-3 border" style={cardStyle}>
                        <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.standupsCount')}</p>
                        <p className="text-xl font-bold mt-1">{progressData.standups_count||0}</p>
                      </div>
                      <div className="rounded-lg p-3 border" style={cardStyle}>
                        <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.retrosCount')}</p>
                        <p className="text-xl font-bold mt-1">{progressData.retros_count||0}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noProgressData")}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {!historyData ? (
              <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
            ) : (
              <>
                {historyData.previous_program && (
                  <div className="rounded-xl p-6 border" style={cardStyle}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <History size={16} style={{ color: "var(--brand-orange)" }} />
                      {t("venture.previousProgram")}
                    </h3>
                    <p className="font-medium">{historyData.previous_program.name}</p>
                    {historyData.previous_program.start_date && (
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {new Date(historyData.previous_program.start_date).toLocaleDateString()}
                        {historyData.previous_program.end_date && ` - ${new Date(historyData.previous_program.end_date).toLocaleDateString()}`}
                      </p>
                    )}
                    {historyData.previous_program.deliverables?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("venture.deliverables")}:</p>
                        <div className="flex flex-wrap gap-1">
                          {historyData.previous_program.deliverables.map((d, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgb(255 255 255 / 0.1)" }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {historyData.graduation ? (
                  <div className="rounded-xl p-6 border" style={cardStyle}>
                    <h3 className="font-semibold mb-2">{t("venture.graduationInfo")}</h3>
                    <p className="text-sm">{new Date(historyData.graduation.graduated_at).toLocaleDateString()}</p>
                    {historyData.graduation.graduation_notes && (
                      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{historyData.graduation.graduation_notes}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl p-6 border" style={cardStyle}>
                    <h3 className="font-semibold mb-2">{t("venture.graduationInfo")}</h3>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.notYetGraduated")}</p>
                  </div>
                )}

                <div className="rounded-xl p-6 border" style={cardStyle}>
                  <h3 className="font-semibold mb-3">{t("venture.founderHistory")}</h3>
                  {historyData.founder_history?.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noFoundersYet")}</p>
                  ) : historyData.founder_history?.map((fh, i) => (
                    <div key={i} className="mb-4 pb-4 border-b last:border-0 last:mb-0 last:pb-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                      <p className="font-medium">{fh.contact_name || fh.contact_id}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {t("venture.founders")} {fh.removed_at ? `(removed ${new Date(fh.removed_at).toLocaleDateString()})` : `(${t("venture.statuses.active")})`}
                      </p>
                      {fh.programs?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.programs")}:</p>
                          {fh.programs.map((p, j) => (
                            <p key={j} className="text-xs pl-3" style={{ color: "var(--text-secondary)" }}>
                              • {p.program_name || `Program ${p.program_id}`} {p.joined_at && `(${new Date(p.joined_at).toLocaleDateString()})`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Journey Tab */}
        {activeTab === "journey" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('venture.standardJourney')||'Standard Venture Journey'}</h2>
            <p className="text-sm" style={{color:'var(--text-secondary)'}}>{t('venture.journeyDesc')||'Complete each stage to progress your venture. Stages unlock as the previous one is approved by your mentor.'}</p>
            <div className="space-y-2">
              {journeyStages.map((stage, i) => (
                <div key={stage.id} className={`rounded-xl p-4 border flex items-center gap-4 ${stage.status === 'locked' ? 'opacity-50' : ''}`} style={cardStyle}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    stage.status === 'completed' ? 'bg-green-600 text-white' :
                    stage.status === 'active' ? 'bg-blue-600 text-white' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {stage.status === 'completed' ? '✓' : stage.stage_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${stage.status === 'completed' ? 'line-through' : ''}`} style={{color: stage.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)'}}>{stage.name}</p>
                    {stage.description && <p className="text-xs" style={{color:'var(--text-secondary)'}}>{stage.description}</p>}
                    {stage.completed_at && <p className="text-xs mt-1" style={{color:'#22c55e'}}>✓ {new Date(stage.completed_at).toLocaleDateString()}</p>}
                  </div>
                  {stage.status === 'active' && (
                    <button onClick={() => handleCompleteStage(stage.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700">
                      {t('venture.markCompleted')||'Mark Completed'}
                    </button>
                  )}
                  {stage.status === 'locked' && (
                    <span className="text-xs px-2 py-1 rounded" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.1)'}}>🔒 {t('venture.locked')||'Locked'}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playbook Tab */}
        {activeTab === "playbook" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('venture.facilitatorPlaybook')||'Facilitator Playbook'}</h2>
            <p className="text-sm" style={{color:'var(--text-secondary)'}}>{t('venture.playbookDesc')||'Standard review guide for each incubation stage.'}</p>
            <div className="space-y-3">
              {playbookEntries.map(entry => (
                <details key={entry.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <summary className="font-medium cursor-pointer">{entry.stage_order}. {entry.stage_name}</summary>
                  <div className="mt-3 space-y-2 text-sm">
                    <div><strong>{t('venture.objective')||'Objective'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.objective}</span></div>
                    <div><strong>{t('venture.expectedOutcome')||'Expected Outcome'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.expected_outcome}</span></div>
                    <div><strong>{t('venture.questions')||'Questions to Ask'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.questions}</span></div>
                    <div><strong>{t('venture.evidence')||'Evidence Required'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.evidence}</span></div>
                    <div><strong>{t('venture.requiredDocuments')||'Required Documents'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.documents}</span></div>
                    <div><strong>{t('venture.commonMistakes')||'Common Mistakes'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.mistakes}</span></div>
                    <div><strong>{t('venture.approvalCriteria')||'Approval Criteria'}:</strong> <span style={{color:'var(--text-secondary)'}}>{entry.approval_criteria}</span></div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Business Model Tab */}
        {activeTab === "businessModel" && (
          <div className="space-y-4">
            <form onSubmit={async (e) => { e.preventDefault(); await fetch(`/api/ventures/${params.id}/business-model`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(bmData||{})}); notifyMsg('Saved'); fetchBm(); }} className="space-y-4">
              <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['keyPartners','keyActivities','keyResources','valuePropositions','customerRelationships','channels','customerSegments','costStructure','revenueStreams'].map(f => (
                    <div key={f}>
                      <label className="block text-sm font-medium mb-1">{t(`venture.${f}`)}</label>
                      <textarea className="w-full px-3 py-2 rounded-lg outline-none border text-sm" style={inputStyle} rows={3}
                        value={bmData?.business_model_canvas?.[f]||''}
                        onChange={(e) => {
                          const c = {...(bmData?.business_model_canvas||{}),[f]:e.target.value};
                          setBmData({...bmData, business_model_canvas: c, venture_id: params.id});
                        }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4 border-t" style={{borderColor:'rgb(255 255 255 / 0.1)'}}>
                  <button type="submit" className="px-6 py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Discovery Tab */}
        {activeTab === "discovery" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.discovery')} ({interviews.length})</h2>
              <button onClick={()=>setShowAddInterview(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><Lightbulb size={16}/> {t('venture.addInterview')}</button>
            </div>
            {interviews.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>No interviews yet</div>):
              interviews.map((iv,i)=>(
                <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex justify-between">
                    <div><p className="font-medium">{iv.interviewee_name||'Unknown'}</p><p className="text-xs" style={{color:'var(--text-secondary)'}}>{iv.customer_segment} {iv.interview_date&&`• ${new Date(iv.interview_date).toLocaleDateString()}`}</p></div>
                  </div>
                  {iv.notes&&<p className="text-sm mt-2" style={{color:'var(--text-secondary)'}}>{iv.notes}</p>}
                  {iv.insights&&<p className="text-sm mt-1" style={{color:'var(--brand-orange)'}}>💡 {iv.insights}</p>}
                </div>
              ))
            }
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === "validation" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.validation')} ({validations.length})</h2>
              <button onClick={()=>setShowAddValidation(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><Target size={16}/> {t('venture.addEntry')}</button>
            </div>
            {['problem','solution','product'].map(type=>{
              const items = validations.filter(v=>v.validation_type===type);
              return <div key={type} className="rounded-xl p-4 border" style={cardStyle}>
                <h3 className="font-semibold capitalize mb-2">{t(`venture.${type}`)}</h3>
                {items.length===0&&<p className="text-sm" style={{color:'var(--text-secondary)'}}>No entries</p>}
                {items.map(v=>(
                  <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{borderColor:'rgb(255 255 255 / 0.05)'}}>
                    <div><p className="text-sm">{v.notes||'—'}</p><p className="text-xs" style={{color:'var(--text-secondary)'}}>{new Date(v.created_at).toLocaleDateString()}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.status==='validated'?'bg-green-500/20 text-green-400':v.status==='invalidated'?'bg-red-500/20 text-red-400':v.status==='in_progress'?'bg-amber-500/20 text-amber-400':'bg-white/10 text-slate-400'}`}>
                      {t(`venture.${({not_started:'notStarted',in_progress:'inProgress',validated:'validated',invalidated:'invalidated'})[v.status]||v.status||'notStarted'}`)}
                    </span>
                  </div>
                ))}
              </div>;
            })}
          </div>
        )}

        {/* PMF Tab */}
        {activeTab === "pmf" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.pmf')} ({assessments.length})</h2>
              <button onClick={()=>setShowAddPmf(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><TrendingUp size={16}/> {t('venture.addAssessment')}</button>
            </div>
            {assessments.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>No assessments yet</div>):
              assessments.map((a,i)=>(
                <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{color:'var(--text-secondary)'}}>{new Date(a.created_at).toLocaleDateString()}</span>
                    <span className="text-sm font-bold" style={{color:'var(--brand-orange)'}}>{a.pmf_progress||0}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 mb-2"><div className="h-full rounded-full transition-all" style={{width:`${a.pmf_progress||0}%`,backgroundColor:'var(--brand-orange)'}}/></div>
                  {a.customer_feedback&&<p className="text-sm" style={{color:'var(--text-secondary)'}}>📝 {a.customer_feedback}</p>}
                  {a.improvements&&<p className="text-sm" style={{color:'var(--text-secondary)'}}>🔧 {a.improvements}</p>}
                </div>
              ))
            }
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === "milestones" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.milestones')} ({milestones.length})</h2>
              <button onClick={()=>setShowAddMilestone(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><CheckSquare size={16}/> {t('venture.addMilestone')}</button>
            </div>
            {milestones.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>No milestones yet</div>):
              milestones.map(m=>{
                const plans = actionPlans.filter(p=>p.milestone_id===m.id);
                return <div key={m.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div><h3 className="font-semibold">{m.title}</h3>{m.description&&<p className="text-sm" style={{color:'var(--text-secondary)'}}>{m.description}</p>}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status==='completed'?'bg-green-500/20 text-green-400':m.status==='in_progress'?'bg-amber-500/20 text-amber-400':'bg-white/10 text-slate-400'}`}>{t(`venture.${{not_started:'notStarted',in_progress:'inProgress',completed:'completed'}[m.status]||m.status||'notStarted'}`)}</span>
                  </div>
                  {m.target_date&&<p className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>🎯 {new Date(m.target_date).toLocaleDateString()}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <input type="range" min="0" max="100" value={m.progress||0} onChange={async e=>{const v=parseInt(e.target.value);await fetch(`/api/ventures/${params.id}/milestones?id=${m.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({progress:v})});fetchMilestones();}} className="flex-1" style={{accentColor:'var(--brand-orange)'}} />
                    <span className="text-xs font-bold" style={{color:'var(--brand-orange)',minWidth:'2.5rem',textAlign:'right'}}>{m.progress||0}%</span>
                  </div>
                  {m.status!=='completed'&&(<button onClick={async()=>{await fetch(`/api/ventures/${params.id}/milestones?id=${m.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'completed',progress:100})});fetchMilestones();}} className="mt-2 text-xs px-2 py-1 rounded" style={{border:'1px solid rgb(255 255 255 / 0.15)',color:'var(--text-secondary)'}}>✓ Mark Completed</button>)}
                  {plans.length>0&&<div className="mt-2 space-y-1"><p className="text-xs font-medium" style={{color:'var(--text-secondary)'}}>{t('venture.actionPlans')}:</p>{plans.map(p=>(
                    <div key={p.id} className="text-xs flex items-center gap-2" style={{color:'var(--text-secondary)'}}><span>• {p.title}</span><span className={`px-1.5 py-0.5 rounded ${p.priority==='high'?'bg-red-500/20 text-red-400':p.priority==='medium'?'bg-amber-500/20 text-amber-400':'bg-blue-500/20 text-blue-400'}`}>{t(`venture.${p.priority}`)}</span></div>
                  ))}</div>}
                </div>;
              })
            }
          </div>
        )}

        {/* Action Plans Tab */}
        {activeTab === "actionPlans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.actionPlans')} ({actionPlans.length})</h2>
              <button onClick={()=>setShowAddAction(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><ListChecks size={16}/> {t('venture.addAction')}</button>
            </div>
            {actionPlans.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>No actions yet</div>):
              actionPlans.map((p,i)=>(
                <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div><h3 className="font-semibold">{p.title}</h3>{p.owner_name&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>👤 {p.owner_name}</p>}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='done'?'bg-green-500/20 text-green-400':p.status==='in_progress'?'bg-amber-500/20 text-amber-400':'bg-white/10 text-slate-400'}`}>{t(`venture.${p.status||'open'}`)}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${p.priority==='high'?'bg-red-500/20 text-red-400':p.priority==='medium'?'bg-amber-500/20 text-amber-400':'bg-blue-500/20 text-blue-400'}`}>{t(`venture.${p.priority}`)}</span>
                    {p.deadline&&<span className="text-xs" style={{color:'var(--text-secondary)'}}>📅 {new Date(p.deadline).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.tasks')} ({tasks.length})</h2>
              <button onClick={()=>setShowAddTask(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><ListTodo size={16}/> {t('venture.addTask')}</button>
            </div>
            {tasks.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              tasks.map(tk=>(
                <div key={tk.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">{tk.title}</p>
                      {tk.parent_task_id&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>↳ {t('venture.subtaskOf')}: {tasks.find(p=>p.id===tk.parent_task_id)?.title||tk.parent_task_id}</p>}
                      {tk.assigned_to&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.assignedTo')}: {tk.assigned_to}</p>}
                      {tk.due_date&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>📅 {new Date(tk.due_date).toLocaleDateString()}</p>}
                    </div>
                    <select value={tk.status||'backlog'} onChange={e=>handleTaskStatusChange(tk.id, e.target.value)} className={`text-xs px-2 py-0.5 rounded-full outline-none cursor-pointer border-0 ${tk.status==='done'?'bg-green-500/20 text-green-400':tk.status==='in_progress'?'bg-amber-500/20 text-amber-400':tk.status==='review'?'bg-purple-500/20 text-purple-400':tk.status==='blocked'?'bg-red-500/20 text-red-400':'bg-white/10 text-slate-400'}`} style={{appearance:'none',WebkitAppearance:'none'}}>
                      {['backlog','todo','in_progress','review','done','blocked','cancelled'].map(s=><option key={s} value={s}>{t(`venture.${s}`)}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${tk.priority==='high'?'bg-red-500/20 text-red-400':tk.priority==='medium'?'bg-amber-500/20 text-amber-400':'bg-blue-500/20 text-blue-400'}`}>{t(`venture.${tk.priority||'medium'}`)}</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Standups Tab */}
        {activeTab === "standups" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.standups')} ({standups.length})</h2>
              <button onClick={()=>setShowAddStandup(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><MessageCircle size={16}/> {t('venture.addStandup')}</button>
            </div>
            {!currentWeekStandup && (
              <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/10" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-400">{t('venture.missingStandup')||'Weekly Standup Not Submitted'}</p>
                    <p className="text-xs mt-0.5" style={{color:'var(--text-secondary)'}}>{t('venture.standupReminderDesc')||'Submit your standup for this week (Monday: Weekly Focus, Planned Activities, Expected Deliverables).'}</p>
                  </div>
                  <button onClick={async()=>{await fetch(`/api/ventures/${params.id}/standups`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week_number:currentWeekNum||1,year:currentWeekYear||2026,top_priorities:'',expected_deliverables:'',weekly_priorities:''})}).then(r=>{if(r.status===409)notifyMsg('Already exists');});fetchStandups();}} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('venture.submitNow')||'Submit Now'}</button>
                </div>
              </div>
            )}
            {!currentWeekStandup && standups.length > 0 && (
              <div className="rounded-xl p-3 border border-red-500/20 bg-red-500/5" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.missedReportNotify')||'No standup for this week. Notify your mentor about the delay.'}</p>
                  <button onClick={async()=>{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({venture_id:params.id,type:'missed_standup',week:currentWeekNum,year:currentWeekYear})});notifyMsg('Mentor notified!');}} className="text-xs px-2 py-1 rounded bg-red-600/30 text-red-400 hover:bg-red-600/50">{t('venture.notifyMentor')||'Notify Mentor'}</button>
                </div>
              </div>
            )}
            {standups.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              standups.map(s=>{const now=new Date(s.year,0,1);const linkedTasks=tasks.filter(tk=>{if(!tk.created_at)return false;const d=new Date(tk.created_at);const soy=new Date(d.getFullYear(),0,1);const w=Math.ceil((((d-soy)/86400000)+soy.getDay()+1)/7);return w===s.week_number&&d.getFullYear()===s.year;});return(<div key={s.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <p className="font-semibold">Week {s.week_number}, {s.year}</p>
                  {s.top_priorities&&<div className="mt-2"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.topPriorities')}:</span><p className="text-sm">{s.top_priorities}</p></div>}
                  {s.expected_deliverables&&<div className="mt-2"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.expectedDeliverables')}:</span><p className="text-sm">{s.expected_deliverables}</p></div>}
                  {linkedTasks.length>0&&<div className="mt-3 pt-2 border-t" style={{borderColor:'rgb(255 255 255 / 0.08)'}}><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.tasks')} ({linkedTasks.length}):</span>{linkedTasks.map(tk=><div key={tk.id} className="text-sm mt-1 flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${tk.status==='done'?'bg-green-400':tk.status==='in_progress'?'bg-amber-400':'bg-slate-400'}`}/>{tk.title}</div>)}</div>}
                </div>)})
            }
          </div>
        )}

        {/* Retros Tab */}
        {activeTab === "retros" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.retros')} ({retros.length})</h2>
              <button onClick={()=>setShowAddRetro(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><RotateCcw size={16}/> {t('venture.addRetro')}</button>
            </div>
            {!currentWeekRetro && (
              <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/10" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-400">{t('venture.missingRetro')||'Weekly Retro Not Submitted'}</p>
                    <p className="text-xs mt-0.5" style={{color:'var(--text-secondary)'}}>{t('venture.retroReminderDesc')||'Submit your retro for this week (Friday: Progress Summary, Completed Activities, Current Challenges, Support Required, Next Week Focus).'}</p>
                  </div>
                  <button onClick={async()=>{await fetch(`/api/ventures/${params.id}/retros`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week_number:currentWeekNum||1,year:currentWeekYear||2026})}).then(r=>{if(r.status===409)notifyMsg('Already exists');});fetchRetros();}} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('venture.submitNow')||'Submit Now'}</button>
                </div>
              </div>
            )}
            {!currentWeekRetro && retros.length > 0 && (
              <div className="rounded-xl p-3 border border-red-500/20 bg-red-500/5" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.missedReportNotify')||'No retro for this week. Notify your mentor about the delay.'}</p>
                  <button onClick={async()=>{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({venture_id:params.id,type:'missed_retro',week:currentWeekNum,year:currentWeekYear})});notifyMsg('Mentor notified!');}} className="text-xs px-2 py-1 rounded bg-red-600/30 text-red-400 hover:bg-red-600/50">{t('venture.notifyMentor')||'Notify Mentor'}</button>
                </div>
              </div>
            )}
            {retros.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              retros.map(r=>{const linkedTasks=tasks.filter(tk=>tk.status==='done'&&tk.created_at&&(()=>{const d=new Date(tk.created_at);const soy=new Date(d.getFullYear(),0,1);const w=Math.ceil((((d-soy)/86400000)+soy.getDay()+1)/7);return w===r.week_number&&d.getFullYear()===r.year;})());return(<div key={r.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <p className="font-semibold">Week {r.week_number}, {r.year}</p>
                  {r.completed_tasks&&<div className="mt-2"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.completedTasks')}:</span><p className="text-sm">{r.completed_tasks}</p></div>}
                  {r.outstanding_tasks&&<div className="mt-2"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.outstandingTasks')}:</span><p className="text-sm">{r.outstanding_tasks}</p></div>}
                  {r.carry_forward_notes&&<div className="mt-2"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.carryForwardNotes')}:</span><p className="text-sm">{r.carry_forward_notes}</p></div>}
                  {linkedTasks.length>0&&<div className="mt-3 pt-2 border-t" style={{borderColor:'rgb(255 255 255 / 0.08)'}}><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('venture.linkedCompletedTasks')} ({linkedTasks.length}):</span>{linkedTasks.map(tk=><div key={tk.id} className="text-sm mt-1 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400"/>{tk.title}</div>)}</div>}
                </div>)})
            }
          </div>
        )}

        {/* Blockers Tab */}
        {activeTab === "blockers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.blockers')} ({blockers.length})</h2>
              <button onClick={()=>setShowAddBlocker(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><AlertTriangle size={16}/> {t('venture.addBlocker')}</button>
            </div>
            {blockers.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              blockers.map(b=>(
                <div key={b.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{b.title}</p>
                      {b.description&&<p className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>{b.description}</p>}
                      {b.supporting_url&&<a href={b.supporting_url} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-block text-blue-400 hover:underline break-all">{b.supporting_url}</a>}
                    </div>
                    {b.status==='resolved'?(
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1 shrink-0 ml-2"><span>✓</span> {t('venture.resolved')}</span>
                    ):(
                      <button onClick={()=>handleResolveBlocker(b.id)} className="text-xs px-3 py-1 rounded-lg shrink-0 ml-2" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}>{t('venture.resolve')}</button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === "calendar" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarDays size={18}/> {t('venture.calendar')}</h2>
            {calendarEvents.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              calendarEvents.map((ev,i)=>{
                const typeIcon = ev.type==='milestone'?'🗓':ev.type==='task'?'📋':ev.type==='action'?'📌':ev.type==='coaching'?'🎯':ev.type==='followup'?'📅':'📅';
                const statusMap = {not_started:'notStarted',in_progress:'inProgress',completed:'completed',done:'completed',pending_review:'pendingReview',revision_requested:'revisionRequested'};
                const statusClass = ev.status==='completed'||ev.status==='done'?'bg-green-500/20 text-green-400':ev.status==='in_progress'?'bg-amber-500/20 text-amber-400':'bg-white/10 text-slate-400';
                return (
                  <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold mb-1 flex items-center gap-2">
                          <span className="shrink-0">{typeIcon}</span>
                          <span className="truncate">{ev.title}</span>
                        </p>
                        {ev.date&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>📅 {new Date(ev.date).toLocaleDateString()}{ev.start_time?` at ${ev.start_time}`:''}</p>}
                        {ev.location&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>📍 {ev.location}</p>}
                        {ev.meeting_link&&<p className="text-xs"><a href={ev.meeting_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">🔗 Link</a></p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusClass}`}>
                        {t(`venture.${statusMap[ev.status]||ev.status||'notStarted'}`)}
                      </span>
                    </div>
                    {(ev.type==='task'||ev.type==='action')&&ev.priority&&(
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ev.priority==='high'?'bg-red-500/20 text-red-400':ev.priority==='medium'?'bg-amber-500/20 text-amber-400':'bg-blue-500/20 text-blue-400'}`}>
                          {t(`venture.${ev.priority}`)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            }
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === "progress" && (
          <div className="space-y-4">
            {!progressData?(<div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{color:'var(--text-secondary)'}} size={24}/></div>):(
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  {label:t('venture.profileCompletion'),value:`${progressData.profile_completion||0}%`,icon:UserCheck},
                  {label:t('venture.taskCompletion'),value:`${progressData.task_completion||0}%`,icon:Activity},
                  {label:t('venture.avgMilestoneProgress'),value:`${progressData.avg_milestone_progress||0}%`,icon:CheckSquare},
                  {label:t('venture.standupsCount'),value:progressData.standups_count||0,icon:MessageCircle},
                  {label:t('venture.retrosCount'),value:progressData.retros_count||0,icon:RotateCcw},
                ].map((stat,i)=>(
                  <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                    <stat.icon size={18} className="mb-2" style={{color:'var(--brand-orange)'}}/>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs" style={{color:'var(--text-secondary)'}}>{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.documents')} ({documents.length})</h2>
              <button onClick={()=>setShowAddDocument(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><FileText size={16}/> {t('venture.upload')}</button>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Search documents..." className="flex-1 px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentSearch} onChange={e=>{setDocumentSearch(e.target.value);}} onKeyUp={()=>fetchDocuments()} />
              <select className="px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentCategory} onChange={e=>{setDocumentCategory(e.target.value);setTimeout(()=>fetchDocuments(null,e.target.value),100);}}>
                <option value="">All categories</option>
                {['business','legal','financial','investment','brand','general'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {documents.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              documents.map(doc=>(
                <div key={doc.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-center justify-between">
                    <div><a href={doc.file_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{doc.name}</a><p className="text-xs" style={{color:'var(--text-secondary)'}}>{doc.category}{doc.folder&&` / ${doc.folder}`}</p></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{t(`venture.${doc.approval_status==='shared_with_investor'?'sharedWithInvestor':doc.approval_status==='pending_review'?'pendingReview':doc.approval_status}`)}</span>
                      <button onClick={()=>{const u=prompt('New file URL:',doc.file_url); if(u) handleDocumentUpdate(doc.id,u);}} className="text-xs px-2 py-0.5 rounded" style={{color:'var(--brand-orange)',border:'1px solid var(--brand-orange)'}}>{t('venture.replace')}</button>
                      <button onClick={async()=>{const r=await fetch(`/api/ventures/${params.id}/documents?type=detail&document_id=${doc.id}`);const d=await r.json();if(d.success&&d.document&&d.document.versions)setVersions(d.document.versions);else{const r2=await fetch(`/api/ventures/${params.id}/documents/${doc.id}/versions`);const d2=await r2.json();setVersions(d2.versions||[]);}setVersionsDoc(doc);setShowVersions(true);}} className="text-xs px-2 py-0.5 rounded" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}>{t('venture.versions')}</button>
                      {doc.approval_status==='pending_review'&&<button onClick={()=>handleReview(doc.id)} className="text-xs px-2 py-0.5 rounded" style={{color:'#22c55e',border:'1px solid rgb(34 197 94 / 0.3)'}}>{t('venture.review')}</button>}
                      <button onClick={()=>handlePermissions(doc.id)} className="text-xs px-2 py-0.5 rounded" style={{color:'#a78bfa',border:'1px solid rgb(167 139 250 / 0.3)'}}>{t('venture.permissions')}</button>
                      <button onClick={()=>{if(confirm('Delete this document?')) handleDocumentDelete(doc.id);}} className="text-xs px-2 py-0.5 rounded" style={{color:'#ef4444',border:'1px solid rgb(239 68 68 / 0.3)'}}>{t('venture.delete')}</button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {['private','pending_review','approved','shared_with_investor'].map(s=>(
                      <button key={s} onClick={()=>handleDocumentTransition(doc.id,s)} disabled={doc.approval_status===s}
                        className="text-xs px-2 py-1 rounded-lg disabled:opacity-40" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}>
                        {t(`venture.${s==='shared_with_investor'?'sharedWithInvestor':s==='pending_review'?'pendingReview':s}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Advisors Tab */}
        {activeTab === "advisors" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.advisors')} ({advisors.length})</h2>
              <button onClick={()=>setShowAddAdvisor(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><GraduationCap size={16}/> {t('venture.addAdvisor')}</button>
            </div>
            {advisors.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              advisors.map(a=>(
                <div key={a.id} className="rounded-xl p-4 border flex items-center justify-between" style={cardStyle}>
                  <div><p className="font-medium">{a.advisor_name||a.advisor_contact_id}</p></div>
                  <div className="flex items-center gap-2">
                    {a.is_primary?(
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{t('venture.primary')}</span>
                    ):(
                      <button onClick={()=>handleMakePrimaryAdvisor(a.id)} className="text-xs px-3 py-1 rounded-lg" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}>{t('venture.makePrimary')}</button>
                    )}
                    <button onClick={()=>handleRemoveAdvisor(a.id)} className="text-xs px-3 py-1 rounded-lg" style={{color:'#ef4444',border:'1px solid rgb(239 68 68 / 0.3)'}}>{t('venture.remove')}</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Coaching Tab */}
        {activeTab === "coaching" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.coaching')} ({coachingSessions.length})</h2>
              <button onClick={()=>setShowAddCoaching(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><Award size={16}/> {t('venture.addSession')}</button>
            </div>
            {coachingSessions.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              coachingSessions.map(s=>(
                <div key={s.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs" style={{color:'var(--text-secondary)'}}>{s.advisor_name||s.advisor_contact_id} {s.session_date&&`• ${new Date(s.session_date).toLocaleDateString()}`}{s.start_time&&` at ${s.start_time}`}</p>
                    <div className="flex items-center gap-2">
                      {s.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status==='approved' ? 'bg-green-500/20 text-green-400' :
                          s.status==='revision_requested' ? 'bg-amber-500/20 text-amber-400' :
                          s.status==='pending_review' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}
                        >{t(`venture.${s.status==='revision_requested'?'requestRevision':s.status==='pending_review'?'pendingReview':s.status}`)||s.status}</span>
                      )}
                      <button onClick={()=>{setEditingCoaching(s);setShowEditCoaching(true);setCoachingForm({});}} className="text-xs px-2 py-0.5 rounded" style={{color:'var(--brand-orange)',border:'1px solid var(--brand-orange)'}}>{t('venture.edit')}</button>
                    </div>
                  </div>
                  {s.location&&<p className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>📍 {s.location}</p>}
                  {s.meeting_link&&<p className="text-xs mt-1"><a href={s.meeting_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">🔗 {s.meeting_link}</a></p>}
                  {s.notes&&<p className="text-sm mt-1">{s.notes}</p>}
                  {s.observations&&<p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>{s.observations}</p>}
                  {s.recommendations&&<p className="text-sm mt-1" style={{color:'var(--brand-orange)'}}>💡 {s.recommendations}</p>}
                  {s.follow_up_date&&<p className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>📅 Follow-up: {new Date(s.follow_up_date).toLocaleDateString()}</p>}
                  <div className="flex gap-2 mt-2">
                    {s.status!=='approved'&&(<button onClick={async()=>{await fetch(`/api/ventures/${params.id}/coaching?id=${s.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'approved'})});fetchCoaching();}} className="text-xs px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700">{t('venture.approve')}</button>)}
                    {s.status!=='revision_requested'&&(<button onClick={async()=>{await fetch(`/api/ventures/${params.id}/coaching?id=${s.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'revision_requested'})});fetchCoaching();}} className="text-xs px-2 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('venture.requestRevision')}</button>)}
                    {s.status!=='pending_review'&&!s.status&&(<button onClick={async()=>{await fetch(`/api/ventures/${params.id}/coaching?id=${s.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'pending_review'})});fetchCoaching();}} className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{t('venture.pendingReview')}</button>)}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* KPIs Tab */}
        {activeTab === "kpis" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t('venture.kpis')} ({kpis.length})</h2>
              <div className="flex gap-2">
                <button onClick={()=>setShowAddKpiDefinition(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}><Gauge size={16}/> {t('venture.create')}</button>
                <button onClick={()=>setShowAddKpi(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{backgroundColor:'var(--brand-orange)'}}><Gauge size={16}/> {t('venture.assignKpi')}</button>
              </div>
            </div>
            {kpis.length===0?(<div className="rounded-xl p-6 border text-center" style={{...cardStyle,color:'var(--text-secondary)'}}>{t('venture.noEvents')}</div>):
              kpis.map(k=>(
                <div key={k.id} className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{k.name}</p>
                      <button onClick={()=>{const def=kpiDefinitions.find(d=>d.id===k.kpi_definition_id); if(def){setKpiDefForm(def);setEditingKpiDef(def);setShowAddKpiDefinition(true);}}} className="text-xs px-2 py-0.5 rounded" style={{color:'var(--brand-orange)',border:'1px solid var(--brand-orange)'}}>{t('venture.edit')}</button>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{k.auto_calc_source?t('venture.autoCalculated'):t('venture.manualEntry')}</span>
                  </div>
                  <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>{t('venture.current')}: {k.current_value ?? 0}{k.target_value&&` / ${t('venture.target')}: ${k.target_value}`} {k.unit}</p>
                  {!k.auto_calc_source && (
                    <button onClick={()=>{const v=prompt(t('venture.updateValue'),k.current_value||0); if(v!==null) handleUpdateKpi(k.id, parseFloat(v)||0);}}
                      className="text-xs px-3 py-1 mt-2 rounded-lg" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}>{t('venture.updateValue')}</button>
                  )}
                </div>
              ))
            }
  	        </div>
  	      )}

          {/* Investment Readiness Tab */}
          {activeTab === "investment" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('venture.investmentReadiness')||'Investment Readiness'}</h2>
              <p className="text-sm" style={{color:'var(--text-secondary)'}}>{t('venture.investmentDesc')||'Documents required before a venture can be introduced to investors.'}</p>
              {investmentReadiness ? (
                <>
                  <div className={`rounded-xl p-6 border ${investmentReadiness.is_investment_ready ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}`} style={cardStyle}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold" style={{color: investmentReadiness.is_investment_ready ? '#22c55e' : '#f59e0b'}}>
                          {investmentReadiness.is_investment_ready ? (t('venture.investmentReady')||'✅ Investment Ready') : (t('venture.notReady')||'⏳ Not Yet Ready')}
                        </p>
                        <p className="text-sm mt-0.5" style={{color:'var(--text-secondary)'}}>
                          {investmentReadiness.approved_count}/{investmentReadiness.total_required} {t('venture.documentsApproved')||'documents approved'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold" style={{color: investmentReadiness.is_investment_ready ? '#22c55e' : 'var(--brand-orange)'}}>
                          {investmentReadiness.readiness_percent}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-gray-700 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{
                        width: `${investmentReadiness.readiness_percent}%`,
                        backgroundColor: investmentReadiness.is_investment_ready ? '#22c55e' : 'var(--brand-orange)'
                      }}/>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {investmentReadiness.checklist.map(item => (
                      <div key={item.key} className={`rounded-xl p-4 border flex items-center gap-4 ${item.status === 'approved' ? 'border-green-500/20 bg-green-500/5' : item.status === 'submitted' ? 'border-amber-500/20 bg-amber-500/5' : 'opacity-60'}`} style={cardStyle}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${item.status === 'approved' ? 'bg-green-600/30' : item.status === 'submitted' ? 'bg-amber-600/30' : 'bg-gray-700'}`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs" style={{color:'var(--text-secondary)'}}>
                            {item.status === 'approved' ? '✅ Approved' : item.status === 'submitted' ? (item.documents?.length ? `📄 ${item.documents.length} document(s) awaiting approval` : '📝 Submitted') : '❌ Missing'}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${item.status === 'approved' ? 'bg-green-500/20 text-green-400' : item.status === 'submitted' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.status === 'approved' ? '✓' : item.status === 'submitted' ? '⏳' : '✗'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{color:'var(--text-secondary)'}} size={24}/></div>
              )}
            </div>
          )}

          {/* Add Interview Modal */}
        {showAddInterview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddInterview(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addInterview')}</h2><button onClick={()=>setShowAddInterview(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/interviews`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...interviewForm,created_by:user.cid})});setShowAddInterview(false);setInterviewForm({});fetchInterviews();}} className="space-y-3">
                <input placeholder={t('venture.interviewee')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={interviewForm.interviewee_name||''} onChange={e=>setInterviewForm({...interviewForm,interviewee_name:e.target.value})} />
                <input placeholder={t('venture.segment')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={interviewForm.customer_segment||''} onChange={e=>setInterviewForm({...interviewForm,customer_segment:e.target.value})} />
                <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={interviewForm.interview_date||''} onChange={e=>setInterviewForm({...interviewForm,interview_date:e.target.value})} />
                <textarea placeholder={t('venture.notes')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={interviewForm.notes||''} onChange={e=>setInterviewForm({...interviewForm,notes:e.target.value})} />
                <textarea placeholder={t('venture.insights')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={interviewForm.insights||''} onChange={e=>setInterviewForm({...interviewForm,insights:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Validation Modal */}
        {showAddValidation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddValidation(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addEntry')}</h2><button onClick={()=>setShowAddValidation(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/validations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({validation_type:validationForm.type,notes:validationForm.notes,status:validationForm.status})});setShowAddValidation(false);setValidationForm({type:'problem'});fetchValidations();}} className="space-y-3">
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={validationForm.type} onChange={e=>setValidationForm({...validationForm,type:e.target.value})}>
                  {['problem','solution','product'].map(vt=><option key={vt} value={vt}>{t(`venture.${vt}`)}</option>)}
                </select>
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={validationForm.status||'in_progress'} onChange={e=>setValidationForm({...validationForm,status:e.target.value})}>
                  {['not_started','in_progress','validated','invalidated'].map(s=>{const k={not_started:'notStarted',in_progress:'inProgress'}[s]||s;return <option key={s} value={s}>{t(`venture.${k}`)}</option>;})}
                </select>
                <textarea placeholder={t('venture.notes')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} value={validationForm.notes||''} onChange={e=>setValidationForm({...validationForm,notes:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add PMF Modal */}
        {showAddPmf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddPmf(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addAssessment')}</h2><button onClick={()=>setShowAddPmf(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/pmf`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pmfForm)});setShowAddPmf(false);setPmfForm({});fetchPmf();}} className="space-y-3">
                <textarea placeholder={t('venture.feedback')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={pmfForm.customer_feedback||''} onChange={e=>setPmfForm({...pmfForm,customer_feedback:e.target.value})} />
                <textarea placeholder={t('venture.improvements')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={pmfForm.improvements||''} onChange={e=>setPmfForm({...pmfForm,improvements:e.target.value})} />
                <div><label className="block text-sm mb-1">{t('venture.progress')}: {pmfForm.pmf_progress||0}%</label><input type="range" min="0" max="100" className="w-full" value={pmfForm.pmf_progress||0} onChange={e=>setPmfForm({...pmfForm,pmf_progress:parseInt(e.target.value)})} /></div>
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Milestone Modal */}
        {showAddMilestone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddMilestone(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addMilestone')}</h2><button onClick={()=>setShowAddMilestone(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/milestones`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(milestoneForm)});setShowAddMilestone(false);setMilestoneForm({});fetchMilestones();}} className="space-y-3">
                <input placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={milestoneForm.title||''} onChange={e=>setMilestoneForm({...milestoneForm,title:e.target.value})} required />
                <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={milestoneForm.description||''} onChange={e=>setMilestoneForm({...milestoneForm,description:e.target.value})} />
                <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={milestoneForm.target_date||''} onChange={e=>setMilestoneForm({...milestoneForm,target_date:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Action Plan Modal */}
        {showAddAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddAction(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addAction')}</h2><button onClick={()=>setShowAddAction(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/action-plans`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(actionForm)});setShowAddAction(false);setActionForm({});fetchActionPlans();}} className="space-y-3">
                <input placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.title||''} onChange={e=>setActionForm({...actionForm,title:e.target.value})} required />
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.priority||'medium'} onChange={e=>setActionForm({...actionForm,priority:e.target.value})}>
                  {['low','medium','high'].map(p=><option key={p} value={p}>{t(`venture.${p}`)}</option>)}
                </select>
                <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.deadline||''} onChange={e=>setActionForm({...actionForm,deadline:e.target.value})} />
                {milestones.length>0&&<select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.milestone_id||''} onChange={e=>setActionForm({...actionForm,milestone_id:e.target.value||null})}>
                  <option value="">{t('venture.unassigned')}</option>
                  {milestones.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
                </select>}
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddTask(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addTask')}</h2><button onClick={()=>setShowAddTask(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/tasks`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(taskForm)});setShowAddTask(false);setTaskForm({});fetchTasks();}} className="space-y-3">
                <input placeholder={t('venture.namePlaceholder')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.title||''} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} required />
                <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={taskForm.description||''} onChange={e=>setTaskForm({...taskForm,description:e.target.value})} />
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.priority||'medium'} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>
                  {['low','medium','high'].map(p=>(<option key={p} value={p}>{t(`venture.${p}`)}</option>))}
                </select>
                {tasks.length>0&&<select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.parent_task_id||''} onChange={e=>setTaskForm({...taskForm,parent_task_id:e.target.value||null})}>
                  <option value="">{t('venture.unassigned')}</option>
                  {tasks.map(tk=><option key={tk.id} value={tk.id}>{tk.title}</option>)}
                </select>}
                <input placeholder={t('venture.assignedTo')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.assigned_cid||''} onChange={e=>setTaskForm({...taskForm,assigned_cid:e.target.value})} />
                <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.due_date||''} onChange={e=>setTaskForm({...taskForm,due_date:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Standup Modal */}
        {showAddStandup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddStandup(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addStandup')}</h2><button onClick={()=>setShowAddStandup(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              {(()=>{const now=new Date();const startOfYear=new Date(now.getFullYear(),0,1);const week=Math.ceil((((now-startOfYear)/86400000)+startOfYear.getDay()+1)/7);return(<form onSubmit={async e=>{e.preventDefault();const y=now.getFullYear();const res=await fetch(`/api/ventures/${params.id}/standups`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week_number:week,year:y,top_priorities:standupForm.top_priorities,expected_deliverables:standupForm.expected_deliverables,weekly_priorities:standupForm.weekly_priorities})});const d=await res.json();if(!d.success){notifyMsg(t(d.error || "") || d.error);if(d.error?.includes('already exists'))return;}setShowAddStandup(false);setStandupForm({});fetchStandups();}} className="space-y-3">
                <div className="text-sm text-center py-1 rounded-lg" style={{color:'var(--text-secondary)',backgroundColor:'rgb(255 255 255 / 0.05)'}}>Week {week}, {now.getFullYear()}</div>
                <textarea placeholder={t('venture.topPriorities')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={standupForm.top_priorities||''} onChange={e=>setStandupForm({...standupForm,top_priorities:e.target.value})} />
                <textarea placeholder={t('venture.expectedDeliverables')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={standupForm.expected_deliverables||''} onChange={e=>setStandupForm({...standupForm,expected_deliverables:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>)})()}
            </div>
          </div>
        )}

        {/* Add Retro Modal */}
        {showAddRetro && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddRetro(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addRetro')}</h2><button onClick={()=>setShowAddRetro(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              {(()=>{const now=new Date();const startOfYear=new Date(now.getFullYear(),0,1);const week=Math.ceil((((now-startOfYear)/86400000)+startOfYear.getDay()+1)/7);return(<form onSubmit={async e=>{e.preventDefault();const y=now.getFullYear();const res=await fetch(`/api/ventures/${params.id}/retros`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week_number:week,year:y,completed_tasks:retroForm.completed_tasks,outstanding_tasks:retroForm.outstanding_tasks,carry_forward_notes:retroForm.carry_forward_notes})});const d=await res.json();if(!d.success){notifyMsg(t(d.error || "") || d.error);if(d.error?.includes('already exists'))return;}setShowAddRetro(false);setRetroForm({});fetchRetros();}} className="space-y-3">
                <div className="text-sm text-center py-1 rounded-lg" style={{color:'var(--text-secondary)',backgroundColor:'rgb(255 255 255 / 0.05)'}}>Week {week}, {now.getFullYear()}</div>
                <textarea placeholder={t('venture.completedTasks')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={retroForm.completed_tasks||''} onChange={e=>setRetroForm({...retroForm,completed_tasks:e.target.value})} />
                <textarea placeholder={t('venture.outstandingTasks')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={retroForm.outstanding_tasks||''} onChange={e=>setRetroForm({...retroForm,outstanding_tasks:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>)})()}
            </div>
          </div>
        )}

        {/* Add Blocker Modal */}
        {showAddBlocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddBlocker(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addBlocker')}</h2><button onClick={()=>setShowAddBlocker(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();const res=await fetch(`/api/ventures/${params.id}/blockers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(blockerForm)});const d=await res.json();if(!d.success)notifyMsg(t(d.error || "") || d.error);setShowAddBlocker(false);setBlockerForm({});fetchBlockers();}} className="space-y-3">
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.venture_retro_id||''} onChange={e=>setBlockerForm({...blockerForm,venture_retro_id:e.target.value})} required>
                  <option value="">{t('venture.selectRetro')}</option>
                  {retros.map(r=><option key={r.id} value={r.id}>{t('venture.week')} {r.week_number}/{r.year}</option>)}
                </select>
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.task_id||''} onChange={e=>setBlockerForm({...blockerForm,task_id:e.target.value})} required>
                  <option value="">{t('venture.tasks')}</option>
                  {tasks.map(tk=><option key={tk.id} value={tk.id}>{tk.title}</option>)}
                </select>
                <input placeholder={t('venture.namePlaceholder')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.title||''} onChange={e=>setBlockerForm({...blockerForm,title:e.target.value})} required />
                <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={blockerForm.description||''} onChange={e=>setBlockerForm({...blockerForm,description:e.target.value})} />
                <input placeholder="Supporting URL (optional)" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.supporting_url||''} onChange={e=>setBlockerForm({...blockerForm,supporting_url:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Document Modal */}
        {showAddDocument && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddDocument(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.upload')}</h2><button onClick={()=>setShowAddDocument(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();const r=await fetch(`/api/ventures/${params.id}/documents`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upload',title:documentForm.name,file_name:documentForm.name+'.pdf',file_url:documentForm.file_url,category:documentForm.category})});const d=await r.json();if(!d.success)notifyMsg(t((d.error||'Upload failed') || "") || (d.error||'Upload failed'));setShowAddDocument(false);setDocumentForm({});fetchDocuments();}} className="space-y-3">
                <input placeholder="Document name" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentForm.name||''} onChange={e=>setDocumentForm({...documentForm,name:e.target.value})} required />
                <input placeholder="https://... (file URL)" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentForm.file_url||''} onChange={e=>setDocumentForm({...documentForm,file_url:e.target.value})} required />
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentForm.category||'general'} onChange={e=>setDocumentForm({...documentForm,category:e.target.value})}>
                  {['business','legal','financial','investment','brand','general'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Advisor Modal */}
        {showAddAdvisor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddAdvisor(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addAdvisor')}</h2><button onClick={()=>setShowAddAdvisor(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();const res=await fetch(`/api/ventures/${params.id}/advisors`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(advisorForm)});const d=await res.json();if(!d.success)notifyMsg(t(d.error || "") || d.error);setShowAddAdvisor(false);setAdvisorForm({});fetchAdvisors();}} className="space-y-3">
                <input placeholder="Advisor contact ID (cid)" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={advisorForm.advisor_contact_id||''} onChange={e=>setAdvisorForm({...advisorForm,advisor_contact_id:e.target.value})} required />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Coaching Session Modal */}
        {showAddCoaching && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddCoaching(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addSession')}</h2><button onClick={()=>setShowAddCoaching(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();await fetch(`/api/ventures/${params.id}/coaching`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(coachingForm)});setShowAddCoaching(false);setCoachingForm({});fetchCoaching();}} className="space-y-3">
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.advisor_contact_id||''} onChange={e=>setCoachingForm({...coachingForm,advisor_contact_id:e.target.value})}>
                  <option value="">{t('venture.advisors')}</option>
                  {advisors.map(a=><option key={a.id} value={a.advisor_contact_id}>{a.advisor_name||a.advisor_contact_id}</option>)}
                </select>
                <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.session_date||''} onChange={e=>setCoachingForm({...coachingForm,session_date:e.target.value})} />
                <input type="time" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.start_time||''} onChange={e=>setCoachingForm({...coachingForm,start_time:e.target.value})} placeholder="HH:MM" />
                <input type="text" placeholder="Location" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.location||''} onChange={e=>setCoachingForm({...coachingForm,location:e.target.value})} />
                <input type="url" placeholder="Meeting Link" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.meeting_link||''} onChange={e=>setCoachingForm({...coachingForm,meeting_link:e.target.value})} />
                <textarea placeholder={t('venture.observations')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={coachingForm.observations||''} onChange={e=>setCoachingForm({...coachingForm,observations:e.target.value})} />
                <textarea placeholder={t('venture.notes')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={coachingForm.notes||''} onChange={e=>setCoachingForm({...coachingForm,notes:e.target.value})} />
                <textarea placeholder={t('venture.recommendations')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={coachingForm.recommendations||''} onChange={e=>setCoachingForm({...coachingForm,recommendations:e.target.value})} />
                <div><label className="block text-sm mb-1">{t('venture.followUpDate')||'Follow-up Date'}</label><input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.follow_up_date||''} onChange={e=>setCoachingForm({...coachingForm,follow_up_date:e.target.value})} /></div>
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReview && reviewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowReview(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.review')}</h2><button onClick={()=>{setShowReview(false);setReviews([]);}} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              {/* Existing reviews */}
              {reviews.length>0&&<div className="mb-4 space-y-2 max-h-40 overflow-y-auto">{reviews.map((rv,i)=>(<div key={i} className="text-xs p-2 rounded-lg border" style={{borderColor:'rgb(255 255 255 / 0.08)'}}><span className={`${rv.decision==='approved'?'text-green-400':rv.decision==='revision_requested'?'text-amber-400':'text-blue-400'}`}>{rv.decision}</span>{rv.comment&&<span className="block" style={{color:'var(--text-secondary)'}}>{rv.comment}</span>}</div>))}</div>}
              <textarea placeholder={t('venture.comments')} className="w-full px-3 py-2 rounded-lg outline-none border mb-3" style={inputStyle} rows={3} value={reviewComment} onChange={e=>setReviewComment(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={()=>handleSubmitReview(reviewDoc.id,'comment')} className="flex-1 py-2 rounded-lg text-sm text-white" style={{backgroundColor:'#3b82f6'}}>{t('venture.comments')}</button>
                <button onClick={()=>handleSubmitReview(reviewDoc.id,'approved')} className="flex-1 py-2 rounded-lg text-sm text-white" style={{backgroundColor:'#22c55e'}}>{t('venture.approve')}</button>
                <button onClick={()=>handleSubmitReview(reviewDoc.id,'revision_requested')} className="flex-1 py-2 rounded-lg text-sm text-white" style={{backgroundColor:'#f59e0b'}}>{t('venture.requestRevision')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissions && permissionsDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowPermissions(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.permissions')||'Permissions'}</h2><button onClick={()=>setShowPermissions(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>{t('venture.permissionsDesc')||'Configure who can access this document'}</p>
              <div className="space-y-3">
                {permissions.map(p => (
                  <div key={p.role_scope} className="flex items-center justify-between py-2 border-b" style={{borderColor:'rgb(255 255 255 / 0.05)'}}>
                    <span className="text-sm capitalize">{p.role_scope}</span>
                    <select
                      className="px-2 py-1 rounded-lg text-xs outline-none border"
                      style={inputStyle}
                      value={p.access_level||'view'}
                      onChange={e => {
                        setPermissions(prev => prev.map(pp => pp.role_scope === p.role_scope ? {...pp, access_level: e.target.value} : pp));
                        handleSavePermission(permissionsDoc.id, p.role_scope, e.target.value);
                      }}
                    >
                      <option value="none">{t('venture.noAccess')||'No Access'}</option>
                      <option value="view">{t('venture.canView')||'Can View'}</option>
                      <option value="edit">{t('venture.canEdit')||'Can Edit'}</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Versions Modal */}
        {showVersions && versionsDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowVersions(false)}>
            <div className="rounded-2xl p-6 w-full max-w-lg mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.versions')}: {versionsDoc.name}</h2><button onClick={()=>setShowVersions(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              {versions.length===0?(<p className="text-sm" style={{color:'var(--text-secondary)'}}>No versions</p>):versions.map((v,i)=>(
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0" style={{borderColor:'rgb(255 255 255 / 0.05)'}}>
                  <div>
                    <p className="text-sm font-medium">v{v.version_number||v.version||(i+1)}</p>
                    {v.file_url&&<a href={v.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">{v.file_url}</a>}
                    {v.change_notes&&<p className="text-xs" style={{color:'var(--text-secondary)'}}>{v.change_notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <a href={v.file_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg" style={{color:'var(--text-secondary)',border:'1px solid rgb(255 255 255 / 0.15)'}}>{t('venture.download')}</a>
                    <button onClick={()=>handleVersionRestore(v.file_url, v.version_number)} className="text-xs px-2 py-1 rounded-lg" style={{color:'var(--brand-orange)',border:'1px solid var(--brand-orange)'}}>{t('venture.restore')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create KPI Definition Modal */}
        {showAddKpiDefinition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddKpiDefinition(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{editingKpiDef?t('venture.edit'):t('venture.create')} KPI</h2><button onClick={()=>{setShowAddKpiDefinition(false);setEditingKpiDef(null);setKpiDefForm({});}} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();const method=editingKpiDef?'PATCH':'POST';const url=editingKpiDef?'/api/venture-kpi-definitions':'/api/venture-kpi-definitions';const body=editingKpiDef?{...kpiDefForm,id:editingKpiDef.id}:kpiDefForm;await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setShowAddKpiDefinition(false);setEditingKpiDef(null);setKpiDefForm({});fetchKpiDefinitions();fetchKpis();}} className="space-y-3">
                <input placeholder="KPI Name" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiDefForm.name||''} onChange={e=>setKpiDefForm({...kpiDefForm,name:e.target.value})} required />
                <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={kpiDefForm.description||''} onChange={e=>setKpiDefForm({...kpiDefForm,description:e.target.value})} />
                <input placeholder={t('venture.unit')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiDefForm.unit||''} onChange={e=>setKpiDefForm({...kpiDefForm,unit:e.target.value})} />
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiDefForm.auto_calc_source||''} onChange={e=>setKpiDefForm({...kpiDefForm,auto_calc_source:e.target.value})}>
                  <option value="">{t('venture.manualEntry')}</option>
                  <option value="customer_interviews">{t('venture.autoCalculated')} — Customer Interviews</option>
                  <option value="milestones">{t('venture.autoCalculated')} — Milestones</option>
                  <option value="tasks">{t('venture.autoCalculated')} — Tasks</option>
                </select>
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Coaching Session Modal */}
        {showEditCoaching && editingCoaching && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>{setShowEditCoaching(false);setEditingCoaching(null);}}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.edit')} Session</h2><button onClick={()=>{setShowEditCoaching(false);setEditingCoaching(null);}} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();const body={...coachingForm,session_date:coachingForm.session_date||editingCoaching.session_date,start_time:coachingForm.start_time||editingCoaching.start_time,location:coachingForm.location||editingCoaching.location,meeting_link:coachingForm.meeting_link||editingCoaching.meeting_link,notes:coachingForm.notes||editingCoaching.notes,observations:coachingForm.observations||editingCoaching.observations,recommendations:coachingForm.recommendations||editingCoaching.recommendations,follow_up_date:coachingForm.follow_up_date||editingCoaching.follow_up_date};await fetch(`/api/ventures/${params.id}/coaching?id=${editingCoaching.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setShowEditCoaching(false);setEditingCoaching(null);setCoachingForm({});fetchCoaching();}} className="space-y-3">
                <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.session_date||editingCoaching.session_date||''} onChange={e=>setCoachingForm({...coachingForm,session_date:e.target.value})} />
                <input type="time" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.start_time||editingCoaching.start_time||''} onChange={e=>setCoachingForm({...coachingForm,start_time:e.target.value})} />
                <input type="text" placeholder="Location" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.location||editingCoaching.location||''} onChange={e=>setCoachingForm({...coachingForm,location:e.target.value})} />
                <input type="url" placeholder="Meeting Link" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.meeting_link||editingCoaching.meeting_link||''} onChange={e=>setCoachingForm({...coachingForm,meeting_link:e.target.value})} />
                <textarea placeholder={t('venture.notes')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={coachingForm.notes||editingCoaching.notes||''} onChange={e=>setCoachingForm({...coachingForm,notes:e.target.value})} />
                <textarea placeholder={t('venture.recommendations')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={coachingForm.recommendations||editingCoaching.recommendations||''} onChange={e=>setCoachingForm({...coachingForm,recommendations:e.target.value})} />
                <div><label className="block text-sm mb-1">{t('venture.followUpDate')||'Follow-up Date'}</label><input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.follow_up_date||editingCoaching.follow_up_date||''} onChange={e=>setCoachingForm({...coachingForm,follow_up_date:e.target.value})} /></div>
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Assign KPI Modal */}
        {showAddKpi && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:'rgb(0 0 0 / 0.6)'}} onClick={()=>setShowAddKpi(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{backgroundColor:'#0f172a',borderColor:'rgb(255 255 255 / 0.1)',color:'var(--text-primary)'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.assignKpi')}</h2><button onClick={()=>setShowAddKpi(false)} style={{color:'var(--text-secondary)'}}><X size={20}/></button></div>
              <form onSubmit={async e=>{e.preventDefault();const res=await fetch(`/api/ventures/${params.id}/kpis`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(kpiForm)});const d=await res.json();if(!d.success)notifyMsg(t(d.error || "") || d.error);setShowAddKpi(false);setKpiForm({});fetchKpis();}} className="space-y-3">
                <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiForm.kpi_definition_id||''} onChange={e=>setKpiForm({...kpiForm,kpi_definition_id:e.target.value})} required>
                  <option value="">{t('venture.kpis')}</option>
                  {kpiDefinitions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <input type="number" placeholder={t('venture.target')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiForm.target_value||''} onChange={e=>setKpiForm({...kpiForm,target_value:e.target.value})} />
                <button type="submit" className="w-full py-2 rounded-lg text-white" style={{backgroundColor:'var(--brand-orange)'}}>{t('venture.save')}</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setShowAddMember(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{addMemberType === "founder" ? t("venture.addFounder") : t("venture.addTeamMember")}</h2>
                <button onClick={() => setShowAddMember(false)} style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.searchContacts")}</label>
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg outline-none border mb-2" style={inputStyle} placeholder={t("venture.searchContacts")} />
              </div>
              {searching && <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>Searching...</p>}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map(c => (
                  <button key={c.cid} onClick={() => handleAddMember(c.cid)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/10">
                    <span className="font-medium">{c.name || c.cid}</span>
                    {c.email && <span className="ml-2" style={{ color: "var(--text-secondary)" }}>({c.email})</span>}
                  </button>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                  <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>No contacts found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Remove Confirm Modal */}
        {removeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setRemoveConfirm(null)}>
            <div className="rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-2">{t("venture.confirmRemove")}</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                {removeConfirm.contact_name || removeConfirm.contact_id}
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.cancel")}
                </button>
                <button onClick={() => handleRemoveMember(removeConfirm.id)}
                  className="px-4 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: "#ef4444" }}>
                  {t("venture.remove")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
