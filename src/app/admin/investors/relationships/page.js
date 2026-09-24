"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Users, Building2, Calendar, Loader2, Plus, CheckCircle2,
  ArrowRight, UserPlus, X,
  FileText, Target, ChevronLeft, MapPin, Shield, Upload,
} from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const RELATIONSHIPS_URL = "/api/investor/relationships";
const STAFF_URL = "/api/contacts?role=super_admin,staff,program_manager";

const pickWorkspaces = (payload) => (payload?.success ? payload.workspaces || [] : []);
const pickStaff = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickIntros = (payload) => (payload?.success ? payload.pipeline || [] : []);

const PIPELINE_INTROS_URL = "/api/investor/pipeline?stage=meeting_requested";

const MEETING_TYPES = [
  { value: "introductory", label: "investorAdmin.relationships.meetingIntroductory" },
  { value: "follow_up", label: "investorAdmin.relationships.meetingFollowUp" },
  { value: "product_demo", label: "investorAdmin.relationships.meetingProductDemo" },
  { value: "financial_review", label: "investorAdmin.relationships.meetingFinancialReview" },
  { value: "dd_session", label: "investorAdmin.relationships.meetingDdSession" },
  { value: "committee", label: "investorAdmin.relationships.meetingCommittee" },
  { value: "closing", label: "investorAdmin.relationships.meetingClosing" },
];

const MEETING_ICONS = {
  introductory: Users,
  follow_up: ArrowRight,
  product_demo: Target,
  financial_review: FileText,
  dd_session: FileText,
  committee: Building2,
  closing: CheckCircle2,
};

export default function AdminRelationshipsPage() {
  const { t } = useI18n();

  // The list and the assignable staff, read through the shared hook: it owns the
  // cache, the cache-first paint and the discarding of a stale answer, so the
  // page keeps no copy of its own and reads during render.
  const { data: workspaces, loading, refresh: refreshWorkspaces } = useApi(
    RELATIONSHIPS_URL,
    { defaultValue: [], transform: pickWorkspaces },
  );
  const { data: staffList } = useApi(STAFF_URL, {
    defaultValue: [],
    transform: pickStaff,
  });
  // The introductions still waiting for a workspace. Read independently, and
  // refreshed alongside every action (see reloadWorkspaces / reloadDetail).
  const { data: pendingIntros, refresh: refreshIntros } = useApi(
    PIPELINE_INTROS_URL,
    { defaultValue: [], transform: pickIntros },
  );

  // Who is signed in, from the shell's session cache. This screen used to ask the
  // session endpoint for itself, which the shell has already done - and fell back
  // to the browser's stored copy when that failed.
  const { cid: currentUserCid } = useSessionUser();

  const [selected, setSelected] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [showCompleteMeeting, setShowCompleteMeeting] = useState(null);
  const [detailTab, setDetailTab] = useState("meetings"); // meetings | diligence
  const [ddData, setDdData] = useState(null); // { workspace, requests }
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", category: "financial", priority: "medium", due_date: "", description: "" });
  const [toast, setToast] = useState(null);
  const [assignField, setAssignField] = useState(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [expandedIntros, setExpandedIntros] = useState({});

  // Meeting form
  const [meetingForm, setMeetingForm] = useState({
    meeting_type: "introductory", scheduled_date: "", scheduled_time: "",
    duration_minutes: 60, location: "", notes: "",
  });

  // Complete form
  const [completeForm, setCompleteForm] = useState({
    outcome: "", notes: "", action_items: "",
  });

  const handleAssign = async (field, cid, name) => {
    try {
      const res = await fetch("/api/investor/relationships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, [field + "_id"]: cid || name }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: field === "relationship_manager" ? t("investorAdmin.relationships.rmAssigned") : t("investorAdmin.relationships.imAssigned") });
        setAssignField(null);
        setAssignSearch("");
        reloadDetail();
      }
    } catch (_) {}
  };

  const selectWorkspace = async (ws, bypassCache = false) => {
    const url = `/api/investor/relationships?id=${ws.id}`;
    const apply = (data) => {
      if (data.success) {
        if (data.workspace) setSelected(data.workspace);
        else setSelected(ws);
        setMeetings(data.meetings || []);
        setTimeline(data.timeline || []);
      }
    };
    try {
      // Cache-first paint: opening a previously viewed workspace renders
      // instantly from fresh snapshots; mutation flows pass bypassCache=true
      // so the detail always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
      if ((data.workspace || ws).pipeline_id) {
        const pipelineId = (data.workspace || ws).pipeline_id;
        const ddUrl = `/api/investor/diligence?pipeline_id=${pipelineId}`;
        const cachedDd = bypassCache ? null : cacheGet(ddUrl);
        const dd =
          cachedDd !== null && cachedDd.success
            ? cachedDd
            : await (await fetch(ddUrl)).json();
        if (dd.success) {
          if (cachedDd === null || !cachedDd.success) cacheSet(ddUrl, dd);
          setDdData(dd);
        }
      }
    } catch (_) {}
  };

  // Every action below re-reads what it changed. The pending introductions are a
  // read of their own, so they are refreshed with it: the old code got that for
  // free by keying that read on the workspace list, which re-read it whenever the
  // list was replaced.
  const reloadWorkspaces = () => {
    refreshWorkspaces();
    refreshIntros();
  };
  const reloadDetail = () => {
    selectWorkspace(selected, true);
    refreshIntros();
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.scheduled_date) {
      setToast({ type: "error", message: t("investorAdmin.relationships.dateRequired") });
      return;
    }
    try {
      const res = await fetch("/api/investor/relationships/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: selected.id, ...meetingForm }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.relationships.meetingScheduled") });
        setShowCreateMeeting(false);
        setMeetingForm({ meeting_type: "introductory", scheduled_date: "", scheduled_time: "", duration_minutes: 60, location: "", notes: "" });
        reloadDetail();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
  };

  const handleCompleteMeeting = async () => {
    try {
      const res = await fetch("/api/investor/relationships/meetings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showCompleteMeeting.id,
          status: "completed",
          outcome: completeForm.outcome,
          notes: completeForm.notes,
          action_items: completeForm.action_items ? completeForm.action_items.split("\n").filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.relationships.meetingCompleted") });
        setShowCompleteMeeting(null);
        setCompleteForm({ outcome: "", notes: "", action_items: "" });
        reloadDetail();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
  };

  const handleCreateWorkspace = async (pipelineId) => {
    try {
      const res = await fetch("/api/investor/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.relationships.workspaceCreated") });
        reloadWorkspaces();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
  };

  // DD handlers
  const handleDdCreateWorkspace = async () => {
    try {
      const res = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: selected.pipeline_id, action: "create_workspace" }),
      });
      const data = await res.json();
      if (data.success) { setToast({ type: "success", message: t("investorAdmin.relationships.ddWorkspaceCreated") }); reloadDetail(); }
      else { setToast({ type: "error", message: t(data.error || "") || data.error }); }
    } catch (_) {}
  };

  const handleAddDdRequest = async () => {
    if (!requestForm.title) return;
    try {
      const res = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: selected.pipeline_id, action: "add_request", ...requestForm }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.relationships.ddRequestAdded") });
        setShowAddRequest(false);
        setRequestForm({ title: "", category: "financial", priority: "medium", due_date: "", description: "" });
        reloadDetail();
      } else { setToast({ type: "error", message: t(data.error || "") || data.error }); }
    } catch (_) {}
  };

  const handleUpdateDdRequest = async (requestId, newStatus) => {
    try {
      const res = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: selected.pipeline_id, action: "update_request", request_id: requestId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) { setToast({ type: "success", message: t("investorAdmin.relationships.requestStatusToast", { status: newStatus }) }); reloadDetail(); }
      else { setToast({ type: "error", message: t(data.error || "") || data.error }); }
    } catch (_) {}
  };

  const [uploadReqId, setUploadReqId] = useState(null);
  const [ddDocs, setDdDocs] = useState({});

  const handleFileUpload = async (requestId, file) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(",")[1];
      try {
        const res = await fetch("/api/investor/diligence/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, file_name: file.name, file_type: file.type, file_data: base64 }),
        });
        const data = await res.json();
        if (data.success) {
          setToast({ type: "success", message: t("investorAdmin.relationships.fileUploadedToast", { fileName: file.name }) });
          setUploadReqId(null);
          reloadDetail();
          // Fetch docs for this request
          fetchDdDocs(requestId);
        } else { setToast({ type: "error", message: t(data.error || "") || data.error }); }
      } catch (_) {}
    };
    reader.readAsDataURL(file);
  };

  const fetchDdDocs = async (requestId) => {
    try {
      const res = await fetch(`/api/investor/diligence/documents?request_id=${requestId}`);
      const data = await res.json();
      if (data.success) setDdDocs(prev => ({ ...prev, [requestId]: data.documents }));
    } catch (_) {}
  };

  const handleDownload = async (docId) => {
    try {
      const res = await fetch(`/api/investor/diligence/documents?id=${docId}&download=true`);
      const data = await res.json();
      if (data.success && data.document?.file_data) {
        const link = document.createElement("a");
        link.href = `data:${data.document.file_type};base64,${data.document.file_data}`;
        link.download = data.document.file_name;
        link.click();
      }
    } catch (_) {}
  };

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-xs font-bold shadow-lg ${
            toast.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          }`} onClick={() => setToast(null)}>
            {toast.message}
          </div>
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("investorAdmin.relationships.title")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t("investorAdmin.relationships.subtitle")}
            </p>
          </div>
        </div>

        {selected ? (
          /* WORKSPACE DETAIL VIEW */
          <div className="space-y-4">
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider hover:underline">
              <ChevronLeft className="w-3.5 h-3.5" /> {t("investorAdmin.relationships.backToList")}
            </button>

            {/* Workspace header */}
            <AppCard padding="lg">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)]">{selected.venture_name || t("investorAdmin.relationships.venture")}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{selected.investor_name || t("investorAdmin.relationships.investor")} · {selected.organization_name || t("investorAdmin.relationships.individual")}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${selected.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                  {selected.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {[
                  ["relationshipManager", selected.relationship_manager_name || "Unassigned", "rm"],
                  ["investmentManager", selected.investment_manager_name || "Unassigned", "im"],
                  ["pipelineStage", selected.pipeline_stage || "—", null],
                  ["nextAction", selected.next_action || "—", null],
                ].map(([l, v, field], i) => (
                  <div key={i} className="p-3 rounded-xl bg-[var(--surface-2)]">
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{t(`investorAdmin.relationships.${l}`)}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{v === "Unassigned" ? t("investorAdmin.relationships.unassigned") : v}</p>
                      {field && v === "Unassigned" && (
                        <div className="relative">
                          <button onClick={() => { setAssignField(field === "rm" ? "relationship_manager" : "investment_manager"); setAssignSearch(""); }}
                            className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">{t("investorAdmin.relationships.assign")}</button>
                          {assignField === (field === "rm" ? "relationship_manager" : "investment_manager") && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-50">
                              <input value={assignSearch} onChange={event => setAssignSearch(event.target.value)}
                                placeholder={t("investorAdmin.relationships.searchStaffPlaceholder")} autoFocus
                                className="w-full px-3 py-2 bg-transparent border-b border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                              <div className="max-h-36 overflow-y-auto">
                                {staffList.filter(staff => !assignSearch || staff.name?.toLowerCase().includes(assignSearch.toLowerCase()) || staff.email?.toLowerCase().includes(assignSearch.toLowerCase())).slice(0, 10).map(staff => (
                                  <button key={staff.cid} onClick={() => handleAssign(field === "rm" ? "relationship_manager" : "investment_manager", staff.cid, staff.name)}
                                    className="w-full text-left px-3 py-2 hover:bg-[var(--surface-3)] text-[10px] font-bold text-[var(--text-primary)]">
                                    {staff.name}<br/><span className="text-[10px] text-[var(--text-tertiary)]">{staff.email} · {staff.role}</span>
                                  </button>
                                ))}
                                {staffList.filter(staff => !assignSearch || staff.name?.toLowerCase().includes(assignSearch.toLowerCase())).length === 0 && (
                                  <p className="px-3 py-4 text-[10px] text-[var(--text-tertiary)] text-center">{t("investorAdmin.relationships.noStaffFound")}</p>
                                )}
                              </div>
                              <button onClick={() => setAssignField(null)}
                                className="w-full px-3 py-2 border-t border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("investorAdmin.relationships.cancel")}</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AppCard>

            {/* Tabs: Meetings | Due Diligence */}
            <div className="flex gap-1 border-b border-[var(--border-primary)]">
              {[
                { id: "meetings", label: t("investorAdmin.relationships.meetings"), icon: Calendar, count: meetings.length },
                { id: "diligence", label: t("investorAdmin.relationships.dueDiligence"), icon: Shield, count: ddData?.requests?.length || 0 },
              ].map(tab => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
                    detailTab === tab.id ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}>
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label} ({tab.count})
                  {detailTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />}
                </button>
              ))}
            </div>

            {detailTab === "meetings" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Meetings */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.meetings")} ({meetings.length})</h3>
                  <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setShowCreateMeeting(true)}>
                    {t("investorAdmin.relationships.scheduleMeeting")}
                  </AppButton>
                </div>
                {meetings.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noMeetingsScheduled")}</p>
                ) : (
                  <div className="space-y-2">
                    {meetings.map(meeting => {
                      const MIcon = MEETING_ICONS[meeting.meeting_type] || Calendar;
                      return (
                        <AppCard key={meeting.id} padding="md">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-xl ${meeting.status === "completed" ? "bg-emerald-500/10" : meeting.status === "cancelled" ? "bg-rose-500/10" : "bg-brand-orange/10"}`}>
                                <MIcon className={`w-4 h-4 ${meeting.status === "completed" ? "text-emerald-400" : meeting.status === "cancelled" ? "text-rose-400" : "text-[var(--brand-orange)]"}`} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-[var(--text-primary)]">
                                  {t(MEETING_TYPES.find(meetingType => meetingType.value === meeting.meeting_type)?.label) || meeting.meeting_type}
                                </p>
                                <p className="text-[10px] text-[var(--text-secondary)]">
                                  {meeting.scheduled_date ? new Date(meeting.scheduled_date).toLocaleDateString() : t("investorAdmin.relationships.tbd")}
                                  {meeting.scheduled_time ? t("investorAdmin.relationships.atTime", { time: meeting.scheduled_time }) : ""}
                                  {meeting.duration_minutes ? t("investorAdmin.relationships.durationSuffix", { minutes: meeting.duration_minutes }) : ""}
                                </p>
                                {meeting.location && (
                                  <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-2.5 h-2.5" /> {meeting.location}
                                  </p>
                                )}
                                {meeting.notes && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{meeting.notes}</p>}
                                {meeting.outcome && (
                                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">{t("investorAdmin.relationships.outcome")}</p>
                                    <p className="text-[10px] text-[var(--text-primary)] mt-0.5">{meeting.outcome}</p>
                                  </div>
                                )}
                                {meeting.action_items && (() => {
                                  try {
                                    const items = typeof meeting.action_items === "string" ? JSON.parse(meeting.action_items) : meeting.action_items;
                                    if (!Array.isArray(items) || items.length === 0) return null;
                                    return (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.actionItems")}</p>
                                        {items.map((item, i) => (
                                          <p key={i} className="text-[10px] text-[var(--text-primary)] flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-[var(--brand-orange)]" /> {item}
                                          </p>
                                        ))}
                                      </div>
                                    );
                                  } catch (_) { return null; }
                                })()}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                meeting.status === "scheduled" ? "bg-amber-500/10 text-amber-400" :
                                meeting.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                "bg-rose-500/10 text-rose-400"
                              }`}>{meeting.status}</span>
                              {meeting.status === "scheduled" && (
                                <AppButton variant="secondary" size="sm" icon={CheckCircle2}
                                  onClick={() => { setShowCompleteMeeting(meeting); setCompleteForm({ outcome: "", notes: "", action_items: "" }); }}>
                                  {t("investorAdmin.relationships.complete")}
                                </AppButton>
                              )}
                            </div>
                          </div>
                        </AppCard>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.timeline")}</h3>
                {timeline.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noActivityYet")}</p>
                ) : (
                  <div className="space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-primary)]">
                    {timeline.map(ev => (
                      <div key={ev.id} className="relative pl-8 py-2">
                        <div className="absolute left-2 top-3 w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
                        <p className="text-[10px] font-bold text-[var(--text-primary)]">{ev.description}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                          {new Date(ev.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )}

            {detailTab === "diligence" && (
            <div className="space-y-4">
              {!ddData?.workspace ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorAdmin.relationships.noDdWorkspace")}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-4">{t("investorAdmin.relationships.createDdWorkspaceHint")}</p>
                  <AppButton variant="primary" size="sm" icon={Shield} onClick={handleDdCreateWorkspace}>
                    {t("investorAdmin.relationships.createDdWorkspace")}
                  </AppButton>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
                      {t("investorAdmin.relationships.ddRequests")} ({(ddData?.requests || []).length})
                    </h3>
                    <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setShowAddRequest(true)}>
                      {t("investorAdmin.relationships.addRequest")}
                    </AppButton>
                  </div>

                  {/* DD workspace status */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ddData.workspace.status === "active" ? "bg-purple-500/10 text-purple-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                      {ddData.workspace.status}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {t("investorAdmin.relationships.createdOn", { date: new Date(ddData.workspace.created_at).toLocaleDateString() })}
                    </span>
                  </div>

                  {/* Requests grouped by category */}
                  {["corporate","financial","commercial","technical","legal"].map(cat => {
                    const catReqs = (ddData?.requests || []).filter(request => request.category === cat);
                    if (catReqs.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-2">
                        <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{cat}</h4>
                        {catReqs.map(request => (
                          <AppCard key={request.id} padding="md">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-[var(--text-primary)]">{request.title}</p>
                                  {request.priority && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      request.priority === "high" ? "bg-rose-500/10 text-rose-400" :
                                      request.priority === "medium" ? "bg-amber-500/10 text-amber-400" :
                                      "bg-slate-500/10 text-slate-400"
                                    }`}>{request.priority}</span>
                                  )}
                                </div>
                                {request.description && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{request.description}</p>}
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-tertiary)]">
                                  {request.due_date && <span>{new Date(request.due_date).toLocaleDateString()}</span>}
                                  {request.response_text && <span className="text-emerald-400">{t("investorAdmin.relationships.responseLabel", { response: request.response_text })}</span>}
                                </div>
                                {/* Version history */}
                                {request.version_history && (() => {
                                  try {
                                    const hist = typeof request.version_history === "string" ? JSON.parse(request.version_history) : request.version_history;
                                    if (!Array.isArray(hist) || hist.length === 0) return null;
                                    return (
                                      <details className="mt-2">
                                        <summary className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase cursor-pointer">{t("investorAdmin.relationships.versionHistory")} ({hist.length})</summary>
                                        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                          {hist.map((historyEntry, i) => (
                                            <div key={i} className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                                              <span className="w-1 h-1 rounded-full bg-[var(--brand-orange)]" />
                                              {historyEntry.from_status} → {historyEntry.to_status} · {new Date(historyEntry.changed_at).toLocaleDateString()}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    );
                                  } catch (_) { return null; }
                                })()}
                              </div>
                              <div className="flex flex-col items-end gap-2 ml-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  request.status === "completed" || request.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                                  request.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                                  request.status === "closed" ? "bg-slate-500/10 text-slate-400" :
                                  "bg-purple-500/10 text-purple-400"
                                }`}>{request.status}</span>
                                {/* Workflow buttons with role attribution */}
                                {request.status === "pending" && (currentUserCid === selected.relationship_manager_id || !selected.relationship_manager_id) && (
                                  <AppButton variant="secondary" size="sm" onClick={() => handleUpdateDdRequest(request.id, "under_review")}>
                                    {t("investorAdmin.relationships.rmReview")}
                                  </AppButton>
                                )}
                                {request.status === "under_review" && (currentUserCid === selected.relationship_manager_id || !selected.relationship_manager_id) && (
                                  <AppButton variant="secondary" size="sm" onClick={() => handleUpdateDdRequest(request.id, "documents_uploaded")}>
                                    {t("investorAdmin.relationships.founderUploaded")}
                                  </AppButton>
                                )}
                                {request.status === "documents_uploaded" && (currentUserCid === selected.investment_manager_id || !selected.investment_manager_id) && (
                                  <AppButton variant="secondary" size="sm" onClick={() => handleUpdateDdRequest(request.id, "verified")}>
                                    {t("investorAdmin.relationships.imVerify")}
                                  </AppButton>
                                )}
                                {request.status === "verified" && (currentUserCid === selected.investment_manager_id || !selected.investment_manager_id) && (
                                  <AppButton variant="primary" size="sm" icon={CheckCircle2} onClick={() => handleUpdateDdRequest(request.id, "completed")}>
                                    {t("investorAdmin.relationships.complete")}
                                  </AppButton>
                                )}
                              </div>
                            </div>
                            {/* Documents section */}
                            <div className="pt-2 border-t border-[var(--border-primary)]">
                              {(ddDocs[request.id] || []).length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {(ddDocs[request.id] || []).map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--surface-2)]">
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-3 h-3 text-[var(--text-tertiary)]" />
                                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{doc.file_name}</span>
                                        <span className="text-[10px] text-[var(--text-tertiary)]">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)}KB` : ""}</span>
                                      </div>
                                      <button onClick={() => handleDownload(doc.id)}
                                        className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline">{t("investorAdmin.relationships.download")}</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {request.status !== "completed" && request.status !== "closed" && (
                                uploadReqId === request.id ? (
                                  <div className="flex items-center gap-2">
                                    <input type="file" id={`dd-upload-${request.id}`}
                                      onChange={event => { if (event.target.files[0]) handleFileUpload(request.id, event.target.files[0]); }}
                                      className="hidden" />
                                    <label htmlFor={`dd-upload-${request.id}`}
                                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                                      {t("investorAdmin.relationships.chooseFile")}
                                    </label>
                                    <button onClick={() => setUploadReqId(null)}
                                      className="text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">{t("investorAdmin.relationships.cancel")}</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setUploadReqId(request.id); fetchDdDocs(request.id); }}
                                    className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
                                    <Upload className="w-3 h-3" /> {t("investorAdmin.relationships.uploadDocument")}
                                  </button>
                                )
                              )}
                              </div>
                          </AppCard>
                        ))}
                      </div>
                    );
                  })}

                  {(ddData?.requests || []).length === 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noDdRequests")}</p>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        ) : (
          /* WORKSPACE LIST VIEW */
          <>
            {/* Pending introductions */}
            {pendingIntros.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-400" /> {t("investorAdmin.relationships.pendingIntroductions")} ({pendingIntros.length})
                </h3>
                {pendingIntros.map(pendingIntro => {
                  const alreadyHas = workspaces.some(workspace => workspace.venture_id === pendingIntro.venture_id && workspace.investor_id === pendingIntro.investor_id);
                  return (
                    <AppCard key={pendingIntro.id} padding="md">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-[var(--text-primary)]">{pendingIntro.venture_name || t("investorAdmin.relationships.venture")}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {pendingIntro.investor_name || t("investorAdmin.relationships.investor")}{pendingIntro.organization_name ? ` · ${pendingIntro.organization_name}` : ""} · {t("investorAdmin.relationships.meetingRequested")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setExpandedIntros(prev => ({...prev, [pendingIntro.id]: !prev[pendingIntro.id]}))}
                              className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
                              {expandedIntros[pendingIntro.id] ? t("investorAdmin.relationships.hideProfile") : t("investorAdmin.relationships.viewInvestorProfile")}
                            </button>
                            {!alreadyHas ? (
                              <AppButton variant="primary" size="sm" icon={CheckCircle2}
                                onClick={() => handleCreateWorkspace(pendingIntro.id)}>
                                {t("investorAdmin.relationships.approveCreateWorkspace")}
                              </AppButton>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-bold">{t("investorAdmin.relationships.workspaceExists")}</span>
                            )}
                          </div>
                        </div>
                        {expandedIntros[pendingIntro.id] && (
                          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] grid grid-cols-2 md:grid-cols-4 gap-2">
                            {pendingIntro.industries?.length > 0 && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.industries")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(pendingIntro.industries||[]).join(", ")}</p></div>}
                            {pendingIntro.countries?.length > 0 && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.countries")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(pendingIntro.countries||[]).join(", ")}</p></div>}
                            {pendingIntro.startup_stages?.length > 0 && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.stages")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(pendingIntro.startup_stages||[]).join(", ")}</p></div>}
                            {(pendingIntro.ticket_size_min || pendingIntro.ticket_size_max) && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.ticket")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">${pendingIntro.ticket_size_min||"0"}–${pendingIntro.ticket_size_max||"∞"}</p></div>}
                            {pendingIntro.email && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.email")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{pendingIntro.email}</p></div>}
                          </div>
                        )}
                      </div>
                    </AppCard>
                  );
                })}
              </div>
            )}

            {/* Active workspaces */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
                {t("investorAdmin.relationships.activeWorkspaces")} ({workspaces.filter(workspace => workspace.status === "active").length})
              </h3>
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
              ) : workspaces.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noWorkspacesYet")}</p>
              ) : (
                <div className="space-y-2">
                  {workspaces.map(workspace => (
                    <AppCard key={workspace.id} padding="md" hover onClick={() => selectWorkspace(workspace)}>
                      <div className="cursor-pointer flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                          <div>
                            <p className="text-sm font-bold text-[var(--text-primary)]">{workspace.venture_name || t("investorAdmin.relationships.venture")}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {workspace.investor_name}{workspace.organization_name ? ` · ${workspace.organization_name}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {workspace.relationship_manager_name && (
                            <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                              <Users className="w-3 h-3" /> {workspace.relationship_manager_name}
                            </span>
                          )}
                          {workspace.upcoming_meetings > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">
                              {t("investorAdmin.relationships.upcomingMeetings", { count: workspace.upcoming_meetings })}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${workspace.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                            {workspace.status}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        </div>
                      </div>
                    </AppCard>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* CREATE MEETING MODAL */}
        {showCreateMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateMeeting(false)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.scheduleMeeting")}</h3>
                <button onClick={() => setShowCreateMeeting(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.meetingType")}</label>
                  <select value={meetingForm.meeting_type} onChange={event => setMeetingForm({...meetingForm, meeting_type: event.target.value})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
                    {MEETING_TYPES.map(meetingType => <option key={meetingType.value} value={meetingType.value}>{t(meetingType.label)}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.dateLabel")}</label>
                    <input type="date" value={meetingForm.scheduled_date} onChange={event => setMeetingForm({...meetingForm, scheduled_date: event.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.time")}</label>
                    <input type="time" value={meetingForm.scheduled_time} onChange={event => setMeetingForm({...meetingForm, scheduled_time: event.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.durationLabel")}</label>
                  <input type="number" value={meetingForm.duration_minutes} onChange={event => setMeetingForm({...meetingForm, duration_minutes: parseInt(event.target.value) || 60})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.location")}</label>
                  <input value={meetingForm.location} onChange={event => setMeetingForm({...meetingForm, location: event.target.value})}
                    placeholder={t("investorAdmin.relationships.locationPlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.notes")}</label>
                  <textarea value={meetingForm.notes} onChange={event => setMeetingForm({...meetingForm, notes: event.target.value})}
                    rows={2} placeholder={t("investorAdmin.relationships.notesPlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowCreateMeeting(false)}>{t("investorAdmin.relationships.cancel")}</AppButton>
                <AppButton variant="primary" size="sm" icon={Calendar} onClick={handleCreateMeeting}>{t("investorAdmin.relationships.schedule")}</AppButton>
              </div>
            </div>
          </div>
        )}

        {/* COMPLETE MEETING MODAL */}
        {showCompleteMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompleteMeeting(null)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.completeMeeting")}</h3>
                <button onClick={() => setShowCompleteMeeting(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.outcome")}</label>
                  <select value={completeForm.outcome} onChange={event => setCompleteForm({...completeForm, outcome: event.target.value})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
                    <option value="">{t("investorAdmin.relationships.selectOutcome")}</option>
                    <option value="Positive">{t("investorAdmin.relationships.outcomePositive")}</option>
                    <option value="Neutral">{t("investorAdmin.relationships.outcomeNeutral")}</option>
                    <option value="Needs follow-up">{t("investorAdmin.relationships.outcomeFollowUp")}</option>
                    <option value="Not a fit">{t("investorAdmin.relationships.outcomeNotFit")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.meetingNotes")}</label>
                  <textarea value={completeForm.notes} onChange={event => setCompleteForm({...completeForm, notes: event.target.value})}
                    rows={3} placeholder={t("investorAdmin.relationships.meetingNotesPlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.actionItemsPerLine")}</label>
                  <textarea value={completeForm.action_items} onChange={event => setCompleteForm({...completeForm, action_items: event.target.value})}
                    rows={3} placeholder={t("investorAdmin.relationships.actionItemsPlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowCompleteMeeting(null)}>{t("investorAdmin.relationships.cancel")}</AppButton>
                <AppButton variant="primary" size="sm" icon={CheckCircle2} onClick={handleCompleteMeeting}>{t("investorAdmin.relationships.completeMeeting")}</AppButton>
              </div>
            </div>
          </div>
        )}

        {/* ADD DD REQUEST MODAL */}
        {showAddRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddRequest(false)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.addDdRequest")}</h3>
                <button onClick={() => setShowAddRequest(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.titleLabel")}</label>
                  <input value={requestForm.title} onChange={event => setRequestForm({...requestForm, title: event.target.value})}
                    placeholder={t("investorAdmin.relationships.titlePlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.category")}</label>
                    <select value={requestForm.category} onChange={event => setRequestForm({...requestForm, category: event.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
                      {["corporate","financial","commercial","technical","legal"].map(categoryOption => <option key={categoryOption} value={categoryOption}>{categoryOption.charAt(0).toUpperCase()+categoryOption.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.priority")}</label>
                    <select value={requestForm.priority} onChange={event => setRequestForm({...requestForm, priority: event.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
                      <option value="low">{t("investorAdmin.relationships.priorityLow")}</option>
                      <option value="medium">{t("investorAdmin.relationships.priorityMedium")}</option>
                      <option value="high">{t("investorAdmin.relationships.priorityHigh")}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.dueDate")}</label>
                  <input type="date" value={requestForm.due_date} onChange={event => setRequestForm({...requestForm, due_date: event.target.value})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.description")}</label>
                  <textarea value={requestForm.description} onChange={event => setRequestForm({...requestForm, description: event.target.value})}
                    rows={2} placeholder={t("investorAdmin.relationships.descriptionPlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowAddRequest(false)}>{t("investorAdmin.relationships.cancel")}</AppButton>
                <AppButton variant="primary" size="sm" icon={Shield} onClick={handleAddDdRequest}>{t("investorAdmin.relationships.addRequest")}</AppButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
