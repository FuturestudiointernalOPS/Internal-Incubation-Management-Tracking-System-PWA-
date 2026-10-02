"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import RelationshipsToast from "@/components/admin/investor-relationships/RelationshipsToast";
import RelationshipsHeader from "@/components/admin/investor-relationships/RelationshipsHeader";
import WorkspaceSummaryCard from "@/components/admin/investor-relationships/WorkspaceSummaryCard";
import DetailTabs from "@/components/admin/investor-relationships/DetailTabs";
import MeetingsPanel from "@/components/admin/investor-relationships/MeetingsPanel";
import DiligencePanel from "@/components/admin/investor-relationships/DiligencePanel";
import WorkspaceListView from "@/components/admin/investor-relationships/WorkspaceListView";
import CreateMeetingModal from "@/components/admin/investor-relationships/CreateMeetingModal";
import CompleteMeetingModal from "@/components/admin/investor-relationships/CompleteMeetingModal";
import AddDdRequestModal from "@/components/admin/investor-relationships/AddDdRequestModal";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const RELATIONSHIPS_URL = "/api/investor/relationships";
const STAFF_URL = "/api/contacts?role=super_admin,staff,program_manager";

const pickWorkspaces = (payload) => (payload?.success ? payload.workspaces || [] : []);
const pickStaff = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickIntros = (payload) => (payload?.success ? payload.pipeline || [] : []);

const PIPELINE_INTROS_URL = "/api/investor/pipeline?stage=meeting_requested";

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
        <RelationshipsToast toast={toast} onDismiss={() => setToast(null)} />

        {/* HEADER */}
        <RelationshipsHeader />

        {selected ? (
          /* WORKSPACE DETAIL VIEW */
          <div className="space-y-4">
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider hover:underline">
              <ChevronLeft className="w-3.5 h-3.5" /> {t("investorAdmin.relationships.backToList")}
            </button>

            <WorkspaceSummaryCard
              selected={selected}
              staffList={staffList}
              assignField={assignField}
              assignSearch={assignSearch}
              onAssignStart={(field) => { setAssignField(field); setAssignSearch(""); }}
              onAssignCancel={() => setAssignField(null)}
              onAssignSearchChange={setAssignSearch}
              onAssign={handleAssign}
            />

            <DetailTabs
              detailTab={detailTab}
              onDetailTabChange={setDetailTab}
              meetingsCount={meetings.length}
              ddCount={ddData?.requests?.length || 0}
            />

            {detailTab === "meetings" && (
              <MeetingsPanel
                meetings={meetings}
                timeline={timeline}
                onCreateMeeting={() => setShowCreateMeeting(true)}
                onCompleteMeeting={(meeting) => { setShowCompleteMeeting(meeting); setCompleteForm({ outcome: "", notes: "", action_items: "" }); }}
              />
            )}

            {detailTab === "diligence" && (
              <DiligencePanel
                ddData={ddData}
                selected={selected}
                currentUserCid={currentUserCid}
                ddDocs={ddDocs}
                uploadReqId={uploadReqId}
                onDdCreateWorkspace={handleDdCreateWorkspace}
                onAddRequest={() => setShowAddRequest(true)}
                onUpdateDdRequest={handleUpdateDdRequest}
                onUploadStart={(requestId) => { setUploadReqId(requestId); fetchDdDocs(requestId); }}
                onUploadCancel={() => setUploadReqId(null)}
                onFileUpload={handleFileUpload}
                onDownload={handleDownload}
              />
            )}
          </div>
        ) : (
          /* WORKSPACE LIST VIEW */
          <WorkspaceListView
            pendingIntros={pendingIntros}
            workspaces={workspaces}
            loading={loading}
            expandedIntros={expandedIntros}
            onToggleIntro={(id) => setExpandedIntros(prev => ({...prev, [id]: !prev[id]}))}
            onApproveIntro={handleCreateWorkspace}
            onSelectWorkspace={selectWorkspace}
          />
        )}

        {/* CREATE MEETING MODAL */}
        {showCreateMeeting && (
          <CreateMeetingModal
            meetingForm={meetingForm}
            setMeetingForm={setMeetingForm}
            onClose={() => setShowCreateMeeting(false)}
            onSubmit={handleCreateMeeting}
          />
        )}

        {/* COMPLETE MEETING MODAL */}
        {showCompleteMeeting && (
          <CompleteMeetingModal
            completeForm={completeForm}
            setCompleteForm={setCompleteForm}
            onClose={() => setShowCompleteMeeting(null)}
            onSubmit={handleCompleteMeeting}
          />
        )}

        {/* ADD DD REQUEST MODAL */}
        {showAddRequest && (
          <AddDdRequestModal
            requestForm={requestForm}
            setRequestForm={setRequestForm}
            onClose={() => setShowAddRequest(false)}
            onSubmit={handleAddDdRequest}
          />
        )}
      </div>
    </>
  );
}
