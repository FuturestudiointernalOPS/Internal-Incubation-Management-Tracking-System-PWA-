"use client";

import { useState, useEffect } from "react";
import {
  Users, Building2, Calendar, Loader2, Plus, CheckCircle2,
  Clock, ArrowRight, History, MessageSquare, UserPlus, X, Edit3,
  FileText, Target, ChevronLeft, Video, MapPin, Phone, Shield, AlertCircle, Upload,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

const MEETING_TYPES = [
  { value: "introductory", label: "Introductory" },
  { value: "follow_up", label: "Follow-up" },
  { value: "product_demo", label: "Product Demo" },
  { value: "financial_review", label: "Financial Review" },
  { value: "dd_session", label: "Due Diligence Session" },
  { value: "committee", label: "Investment Committee" },
  { value: "closing", label: "Closing" },
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
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [staffList, setStaffList] = useState([]);
  const [assignField, setAssignField] = useState(null);
  const [assignSearch, setAssignSearch] = useState("");

  // Meeting form
  const [meetingForm, setMeetingForm] = useState({
    meeting_type: "introductory", scheduled_date: "", scheduled_time: "",
    duration_minutes: 60, location: "", notes: "",
  });
  const [currentUserCid, setCurrentUserCid] = useState(null);

  // Complete form
  const [completeForm, setCompleteForm] = useState({
    outcome: "", notes: "", action_items: "",
  });

  useEffect(() => { fetchWorkspaces(); fetchStaff(); fetchCurrentUser(); }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.authenticated && data.user) setCurrentUserCid(data.user.cid || data.user.id);
    } catch (_) {
      // Fallback to localStorage
      try {
        const saved = JSON.parse(localStorage.getItem("user") || "{}");
        setCurrentUserCid(saved.cid || saved.id);
      } catch (_) {}
    }
  };

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investor/relationships");
      const data = await res.json();
      if (data.success) setWorkspaces(data.workspaces || []);
    } catch (_) {}
    setLoading(false);
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/contacts?role=super_admin,staff,program_manager");
      const data = await res.json();
      if (data.success) setStaffList(data.contacts || []);
    } catch (_) {}
  };

  const handleAssign = async (field, cid, name) => {
    try {
      const res = await fetch("/api/investor/relationships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, [field + "_id"]: cid || name }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: `${field === "relationship_manager" ? "RM" : "IM"} assigned` });
        setAssignField(null);
        setAssignSearch("");
        selectWorkspace(selected);
      }
    } catch (_) {}
  };

  const selectWorkspace = async (ws) => {
    try {
      const res = await fetch(`/api/investor/relationships?id=${ws.id}`);
      const data = await res.json();
      if (data.success) {
        if (data.workspace) setSelected(data.workspace);
        else setSelected(ws);
        setMeetings(data.meetings || []);
        setTimeline(data.timeline || []);
      }
      if ((data.workspace || ws).pipeline_id) {
        const ddRes = await fetch(`/api/investor/diligence?pipeline_id=${(data.workspace || ws).pipeline_id}`);
        const dd = await ddRes.json();
        if (dd.success) setDdData(dd);
      }
    } catch (_) {}
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.scheduled_date) {
      setToast({ type: "error", message: "Date is required" });
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
        setToast({ type: "success", message: "Meeting scheduled" });
        setShowCreateMeeting(false);
        setMeetingForm({ meeting_type: "introductory", scheduled_date: "", scheduled_time: "", duration_minutes: 60, location: "", notes: "" });
        selectWorkspace(selected);
      } else {
        setToast({ type: "error", message: data.error });
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
        setToast({ type: "success", message: "Meeting completed" });
        setShowCompleteMeeting(null);
        setCompleteForm({ outcome: "", notes: "", action_items: "" });
        selectWorkspace(selected);
      } else {
        setToast({ type: "error", message: data.error });
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
        setToast({ type: "success", message: "Relationship workspace created" });
        fetchWorkspaces();
      } else {
        setToast({ type: "error", message: data.error });
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
      if (data.success) { setToast({ type: "success", message: "DD workspace created" }); selectWorkspace(selected); }
      else { setToast({ type: "error", message: data.error }); }
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
        setToast({ type: "success", message: "DD request added" });
        setShowAddRequest(false);
        setRequestForm({ title: "", category: "financial", priority: "medium", due_date: "", description: "" });
        selectWorkspace(selected);
      } else { setToast({ type: "error", message: data.error }); }
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
      if (data.success) { setToast({ type: "success", message: `Request: ${newStatus}` }); selectWorkspace(selected); }
      else { setToast({ type: "error", message: data.error }); }
    } catch (_) {}
  };

  const [uploadReqId, setUploadReqId] = useState(null);
  const [ddDocs, setDdDocs] = useState({});

  const handleFileUpload = async (requestId, file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      try {
        const res = await fetch("/api/investor/diligence/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, file_name: file.name, file_type: file.type, file_data: base64 }),
        });
        const data = await res.json();
        if (data.success) {
          setToast({ type: "success", message: `"${file.name}" uploaded` });
          setUploadReqId(null);
          selectWorkspace(selected);
          // Fetch docs for this request
          fetchDdDocs(requestId);
        } else { setToast({ type: "error", message: data.error }); }
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

  // Check for pending introductions (meeting_requested without workspace)
  const [pendingIntros, setPendingIntros] = useState([]);
  useEffect(() => {
    fetch("/api/investor/pipeline?stage=meeting_requested")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPendingIntros(d.pipeline || []);
        }
      });
  }, [workspaces]);

  return (
    <DashboardLayout role="super_admin">
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
              Investment Relationships
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Manage meetings, timelines, and relationship workspaces
            </p>
          </div>
        </div>

        {selected ? (
          /* WORKSPACE DETAIL VIEW */
          <div className="space-y-4">
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider hover:underline">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to list
            </button>

            {/* Workspace header */}
            <AppCard padding="lg">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)]">{selected.venture_name || "Venture"}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{selected.investor_name || "Investor"} · {selected.organization_name || "Individual"}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${selected.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                  {selected.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {[
                  ["Relationship Manager", selected.relationship_manager_name || "Unassigned", "rm"],
                  ["Investment Manager", selected.investment_manager_name || "Unassigned", "im"],
                  ["Pipeline Stage", selected.pipeline_stage || "—", null],
                  ["Next Action", selected.next_action || "—", null],
                ].map(([l, v, field], i) => (
                  <div key={i} className="p-3 rounded-xl bg-[var(--surface-2)]">
                    <p className="text-[7px] font-black text-[var(--text-tertiary)] uppercase tracking-widest">{l}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{v}</p>
                      {field && v === "Unassigned" && (
                        <div className="relative">
                          <button onClick={() => { setAssignField(field === "rm" ? "relationship_manager" : "investment_manager"); setAssignSearch(""); }}
                            className="text-[8px] font-black text-[var(--brand-orange)] hover:underline">+ Assign</button>
                          {assignField === (field === "rm" ? "relationship_manager" : "investment_manager") && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-50">
                              <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                                placeholder="Search staff..." autoFocus
                                className="w-full px-3 py-2 bg-transparent border-b border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                              <div className="max-h-36 overflow-y-auto">
                                {staffList.filter(s => !assignSearch || s.name?.toLowerCase().includes(assignSearch.toLowerCase()) || s.email?.toLowerCase().includes(assignSearch.toLowerCase())).slice(0, 10).map(s => (
                                  <button key={s.cid} onClick={() => handleAssign(field === "rm" ? "relationship_manager" : "investment_manager", s.cid, s.name)}
                                    className="w-full text-left px-3 py-2 hover:bg-[var(--surface-3)] text-[10px] font-bold text-[var(--text-primary)]">
                                    {s.name}<br/><span className="text-[8px] text-[var(--text-tertiary)]">{s.email} · {s.role}</span>
                                  </button>
                                ))}
                                {staffList.filter(s => !assignSearch || s.name?.toLowerCase().includes(assignSearch.toLowerCase())).length === 0 && (
                                  <p className="px-3 py-4 text-[10px] text-[var(--text-tertiary)] text-center">No staff found</p>
                                )}
                              </div>
                              <button onClick={() => setAssignField(null)}
                                className="w-full px-3 py-2 border-t border-[var(--border-primary)] text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
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
                { id: "meetings", label: "Meetings", icon: Calendar, count: meetings.length },
                { id: "diligence", label: "Due Diligence", icon: Shield, count: ddData?.requests?.length || 0 },
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
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Meetings ({meetings.length})</h3>
                  <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setShowCreateMeeting(true)}>
                    Schedule Meeting
                  </AppButton>
                </div>
                {meetings.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">No meetings scheduled yet</p>
                ) : (
                  <div className="space-y-2">
                    {meetings.map(m => {
                      const MIcon = MEETING_ICONS[m.meeting_type] || Calendar;
                      return (
                        <AppCard key={m.id} padding="md">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-xl ${m.status === "completed" ? "bg-emerald-500/10" : m.status === "cancelled" ? "bg-rose-500/10" : "bg-[var(--brand-orange)]/10"}`}>
                                <MIcon className={`w-4 h-4 ${m.status === "completed" ? "text-emerald-400" : m.status === "cancelled" ? "text-rose-400" : "text-[var(--brand-orange)]"}`} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-[var(--text-primary)]">
                                  {MEETING_TYPES.find(t => t.value === m.meeting_type)?.label || m.meeting_type}
                                </p>
                                <p className="text-[10px] text-[var(--text-secondary)]">
                                  {m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : "TBD"}
                                  {m.scheduled_time ? ` at ${m.scheduled_time}` : ""}
                                  {m.duration_minutes ? ` · ${m.duration_minutes}min` : ""}
                                </p>
                                {m.location && (
                                  <p className="text-[9px] text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-2.5 h-2.5" /> {m.location}
                                  </p>
                                )}
                                {m.notes && <p className="text-[10px] text-[var(--text-secondary)] mt-1 italic">{m.notes}</p>}
                                {m.outcome && (
                                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Outcome</p>
                                    <p className="text-[10px] text-[var(--text-primary)] mt-0.5">{m.outcome}</p>
                                  </div>
                                )}
                                {m.action_items && (() => {
                                  try {
                                    const items = typeof m.action_items === "string" ? JSON.parse(m.action_items) : m.action_items;
                                    if (!Array.isArray(items) || items.length === 0) return null;
                                    return (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Action Items</p>
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
                              <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                                m.status === "scheduled" ? "bg-amber-500/10 text-amber-400" :
                                m.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                "bg-rose-500/10 text-rose-400"
                              }`}>{m.status}</span>
                              {m.status === "scheduled" && (
                                <AppButton variant="secondary" size="sm" icon={CheckCircle2}
                                  onClick={() => { setShowCompleteMeeting(m); setCompleteForm({ outcome: "", notes: "", action_items: "" }); }}>
                                  Complete
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
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Timeline</h3>
                {timeline.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">No activity yet</p>
                ) : (
                  <div className="space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-primary)]">
                    {timeline.map(t => (
                      <div key={t.id} className="relative pl-8 py-2">
                        <div className="absolute left-2 top-3 w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
                        <p className="text-[10px] font-bold text-[var(--text-primary)]">{t.description}</p>
                        <p className="text-[8px] text-[var(--text-tertiary)] mt-0.5">
                          {new Date(t.created_at).toLocaleString()}
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
                  <p className="text-sm font-bold text-[var(--text-secondary)]">No Due Diligence workspace</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-4">Create a DD workspace to start the due diligence process</p>
                  <AppButton variant="primary" size="sm" icon={Shield} onClick={handleDdCreateWorkspace}>
                    Create DD Workspace
                  </AppButton>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
                      DD Requests ({(ddData?.requests || []).length})
                    </h3>
                    <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setShowAddRequest(true)}>
                      Add Request
                    </AppButton>
                  </div>

                  {/* DD workspace status */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${ddData.workspace.status === "active" ? "bg-purple-500/10 text-purple-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                      {ddData.workspace.status}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      Created {new Date(ddData.workspace.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Requests grouped by category */}
                  {["corporate","financial","commercial","technical","legal"].map(cat => {
                    const catReqs = (ddData?.requests || []).filter(r => r.category === cat);
                    if (catReqs.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-2">
                        <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{cat}</h4>
                        {catReqs.map(r => (
                          <AppCard key={r.id} padding="md">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-[var(--text-primary)]">{r.title}</p>
                                  {r.priority && (
                                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                                      r.priority === "high" ? "bg-rose-500/10 text-rose-400" :
                                      r.priority === "medium" ? "bg-amber-500/10 text-amber-400" :
                                      "bg-slate-500/10 text-slate-400"
                                    }`}>{r.priority}</span>
                                  )}
                                </div>
                                {r.description && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{r.description}</p>}
                                <div className="flex items-center gap-3 mt-1 text-[9px] text-[var(--text-tertiary)]">
                                  {r.due_date && <span>{new Date(r.due_date).toLocaleDateString()}</span>}
                                  {r.response_text && <span className="text-emerald-400">Response: {r.response_text}</span>}
                                </div>
                                {/* Version history */}
                                {r.version_history && (() => {
                                  try {
                                    const hist = typeof r.version_history === "string" ? JSON.parse(r.version_history) : r.version_history;
                                    if (!Array.isArray(hist) || hist.length === 0) return null;
                                    return (
                                      <details className="mt-2">
                                        <summary className="text-[8px] font-black text-[var(--text-tertiary)] uppercase cursor-pointer">Version History ({hist.length})</summary>
                                        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                          {hist.map((h, i) => (
                                            <div key={i} className="text-[8px] text-[var(--text-tertiary)] flex items-center gap-1">
                                              <span className="w-1 h-1 rounded-full bg-[var(--brand-orange)]" />
                                              {h.from_status} → {h.to_status} · {new Date(h.changed_at).toLocaleDateString()}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    );
                                  } catch (_) { return null; }
                                })()}
                              </div>
                              <div className="flex flex-col items-end gap-2 ml-3">
                                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                                  r.status === "completed" || r.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                                  r.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                                  r.status === "closed" ? "bg-slate-500/10 text-slate-400" :
                                  "bg-purple-500/10 text-purple-400"
                                }`}>{r.status}</span>
                                {/* Workflow buttons with role attribution */}
                                {r.status === "pending" && (currentUserCid === selected.relationship_manager_id || !selected.relationship_manager_id) && (
                                  <AppButton variant="secondary" size="sm" onClick={() => handleUpdateDdRequest(r.id, "under_review")}>
                                    RM Review
                                  </AppButton>
                                )}
                                {r.status === "under_review" && (currentUserCid === selected.relationship_manager_id || !selected.relationship_manager_id) && (
                                  <AppButton variant="secondary" size="sm" onClick={() => handleUpdateDdRequest(r.id, "documents_uploaded")}>
                                    Founder Uploaded
                                  </AppButton>
                                )}
                                {r.status === "documents_uploaded" && (currentUserCid === selected.investment_manager_id || !selected.investment_manager_id) && (
                                  <AppButton variant="secondary" size="sm" onClick={() => handleUpdateDdRequest(r.id, "verified")}>
                                    IM Verify
                                  </AppButton>
                                )}
                                {r.status === "verified" && (currentUserCid === selected.investment_manager_id || !selected.investment_manager_id) && (
                                  <AppButton variant="primary" size="sm" icon={CheckCircle2} onClick={() => handleUpdateDdRequest(r.id, "completed")}>
                                    Complete
                                  </AppButton>
                                )}
                              </div>
                            </div>
                            {/* Documents section */}
                            <div className="pt-2 border-t border-[var(--border-primary)]">
                              {(ddDocs[r.id] || []).length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {(ddDocs[r.id] || []).map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--surface-2)]">
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-3 h-3 text-[var(--text-tertiary)]" />
                                        <span className="text-[9px] font-bold text-[var(--text-primary)]">{doc.file_name}</span>
                                        <span className="text-[8px] text-[var(--text-tertiary)]">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)}KB` : ""}</span>
                                      </div>
                                      <button onClick={() => handleDownload(doc.id)}
                                        className="text-[8px] font-black text-[var(--brand-orange)] uppercase hover:underline">Download</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {r.status !== "completed" && r.status !== "closed" && (
                                uploadReqId === r.id ? (
                                  <div className="flex items-center gap-2">
                                    <input type="file" id={`dd-upload-${r.id}`}
                                      onChange={e => { if (e.target.files[0]) handleFileUpload(r.id, e.target.files[0]); }}
                                      className="hidden" />
                                    <label htmlFor={`dd-upload-${r.id}`}
                                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[9px] font-bold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                                      Choose file...
                                    </label>
                                    <button onClick={() => setUploadReqId(null)}
                                      className="text-[9px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Cancel</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setUploadReqId(r.id); fetchDdDocs(r.id); }}
                                    className="flex items-center gap-1 text-[9px] font-bold text-[var(--brand-orange)] hover:underline">
                                    <Upload className="w-3 h-3" /> Upload Document
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
                    <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">No DD requests yet. Add one to start the due diligence process.</p>
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
                  <UserPlus className="w-4 h-4 text-amber-400" /> Pending Introductions ({pendingIntros.length})
                </h3>
                {pendingIntros.map(p => {
                  const alreadyHas = workspaces.some(w => w.venture_id === p.venture_id && w.investor_id === p.investor_id);
                  return (
                    <AppCard key={p.id} padding="md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name || "Venture"}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            {p.investor_name || "Investor"}{p.organization_name ? ` · ${p.organization_name}` : ""} · Meeting requested
                          </p>
                        </div>
                        {!alreadyHas ? (
                          <AppButton variant="primary" size="sm" icon={CheckCircle2}
                            onClick={() => handleCreateWorkspace(p.id)}>
                            Approve & Create Workspace
                          </AppButton>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-bold">Workspace exists</span>
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
                Active Workspaces ({workspaces.filter(w => w.status === "active").length})
              </h3>
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
              ) : workspaces.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">No relationship workspaces yet</p>
              ) : (
                <div className="space-y-2">
                  {workspaces.map(w => (
                    <AppCard key={w.id} padding="md" hover onClick={() => selectWorkspace(w)}>
                      <div className="cursor-pointer flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                          <div>
                            <p className="text-sm font-bold text-[var(--text-primary)]">{w.venture_name || "Venture"}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {w.investor_name}{w.organization_name ? ` · ${w.organization_name}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {w.relationship_manager_name && (
                            <span className="text-[9px] text-[var(--text-tertiary)] flex items-center gap-1">
                              <Users className="w-3 h-3" /> {w.relationship_manager_name}
                            </span>
                          )}
                          {w.upcoming_meetings > 0 && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-amber-500/10 text-amber-400">
                              {w.upcoming_meetings} upcoming
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${w.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                            {w.status}
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
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Schedule Meeting</h3>
                <button onClick={() => setShowCreateMeeting(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Meeting Type</label>
                  <select value={meetingForm.meeting_type} onChange={e => setMeetingForm({...meetingForm, meeting_type: e.target.value})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60">
                    {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Date *</label>
                    <input type="date" value={meetingForm.scheduled_date} onChange={e => setMeetingForm({...meetingForm, scheduled_date: e.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Time</label>
                    <input type="time" value={meetingForm.scheduled_time} onChange={e => setMeetingForm({...meetingForm, scheduled_time: e.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Duration (min)</label>
                  <input type="number" value={meetingForm.duration_minutes} onChange={e => setMeetingForm({...meetingForm, duration_minutes: parseInt(e.target.value) || 60})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Location</label>
                  <input value={meetingForm.location} onChange={e => setMeetingForm({...meetingForm, location: e.target.value})}
                    placeholder="Google Meet link, office, phone..."
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Notes</label>
                  <textarea value={meetingForm.notes} onChange={e => setMeetingForm({...meetingForm, notes: e.target.value})}
                    rows={2} placeholder="Agenda, preparation notes..."
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-[var(--brand-orange)]/60" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowCreateMeeting(false)}>Cancel</AppButton>
                <AppButton variant="primary" size="sm" icon={Calendar} onClick={handleCreateMeeting}>Schedule</AppButton>
              </div>
            </div>
          </div>
        )}

        {/* COMPLETE MEETING MODAL */}
        {showCompleteMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompleteMeeting(null)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Complete Meeting</h3>
                <button onClick={() => setShowCompleteMeeting(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Outcome</label>
                  <select value={completeForm.outcome} onChange={e => setCompleteForm({...completeForm, outcome: e.target.value})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60">
                    <option value="">Select outcome...</option>
                    <option value="Positive">Positive</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Needs follow-up">Needs follow-up</option>
                    <option value="Not a fit">Not a fit</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Meeting Notes</label>
                  <textarea value={completeForm.notes} onChange={e => setCompleteForm({...completeForm, notes: e.target.value})}
                    rows={3} placeholder="Key discussion points, investor feedback..."
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Action Items (one per line)</label>
                  <textarea value={completeForm.action_items} onChange={e => setCompleteForm({...completeForm, action_items: e.target.value})}
                    rows={3} placeholder="Founder to upload revised financial model...&#10;Investor to review customer traction...&#10;Schedule follow-up in two weeks..."
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-[var(--brand-orange)]/60" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowCompleteMeeting(null)}>Cancel</AppButton>
                <AppButton variant="primary" size="sm" icon={CheckCircle2} onClick={handleCompleteMeeting}>Complete Meeting</AppButton>
              </div>
            </div>
          </div>
        )}

        {/* ADD DD REQUEST MODAL */}
        {showAddRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddRequest(false)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Add DD Request</h3>
                <button onClick={() => setShowAddRequest(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Title *</label>
                  <input value={requestForm.title} onChange={e => setRequestForm({...requestForm, title: e.target.value})}
                    placeholder="e.g. Financial Statements 2024"
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Category</label>
                    <select value={requestForm.category} onChange={e => setRequestForm({...requestForm, category: e.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60">
                      {["corporate","financial","commercial","technical","legal"].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Priority</label>
                    <select value={requestForm.priority} onChange={e => setRequestForm({...requestForm, priority: e.target.value})}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Due Date</label>
                  <input type="date" value={requestForm.due_date} onChange={e => setRequestForm({...requestForm, due_date: e.target.value})}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Description</label>
                  <textarea value={requestForm.description} onChange={e => setRequestForm({...requestForm, description: e.target.value})}
                    rows={2} placeholder="Additional details..."
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-[var(--brand-orange)]/60" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowAddRequest(false)}>Cancel</AppButton>
                <AppButton variant="primary" size="sm" icon={Shield} onClick={handleAddDdRequest}>Add Request</AppButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
