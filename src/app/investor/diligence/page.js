"use client";
export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import GlobalToast from "@/components/ui/GlobalToast";
import DiligenceHeader from "@/components/investor/diligence/DiligenceHeader";
import NoWorkspaceState from "@/components/investor/diligence/NoWorkspaceState";
import DiligenceProgress from "@/components/investor/diligence/DiligenceProgress";
import DiligenceTabs from "@/components/investor/diligence/DiligenceTabs";
import OverviewTab from "@/components/investor/diligence/OverviewTab";
import RequestsTab from "@/components/investor/diligence/RequestsTab";
import FoundersTab from "@/components/investor/diligence/FoundersTab";
import RisksTab from "@/components/investor/diligence/RisksTab";
import NotesTab from "@/components/investor/diligence/NotesTab";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickDiligence = (response) => (response?.success ? response : null);
const pickEvaluation = (response) => (response?.success ? response : null);

function DueDiligenceContent() {
  const goBack = useSafeBack("/investor");
  const searchParams = useSearchParams();
  const pipelineId = searchParams.get("pipeline_id");

  // Two reads, the pipeline identifier staying a plain dependency of each. Their
  // loaders' work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect. Every mutation flow calls
  // refreshAll(), which bypasses the cache exactly like bypassCache did. Before
  // the workspace exists the identifier can be absent, and then nothing is read.
  const {
    data: diligence,
    loading: diligenceLoading,
    refresh: refreshDiligence,
  } = useApi(
    pipelineId ? `/api/investor/diligence?pipeline_id=${pipelineId}` : null,
    { transform: pickDiligence, deps: [pipelineId] },
  );
  const {
    data: evaluation,
    loading: evaluationLoading,
    refresh: refreshEvaluation,
  } = useApi(
    pipelineId ? `/api/investor/evaluation?pipeline_id=${pipelineId}` : null,
    { transform: pickEvaluation, deps: [pipelineId] },
  );
  const loading = diligenceLoading || evaluationLoading;
  const workspace = diligence?.workspace ?? null;
  const requests = diligence?.requests || [];
  const notes = diligence?.notes || [];
  const pipeline = diligence?.pipeline ?? null;
  const founders = evaluation?.founder_evaluations || [];
  const risks = evaluation?.risk_assessments || [];
  const refreshAll = () => {
    refreshDiligence();
    refreshEvaluation();
  };
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // New request form
  const [newRequest, setNewRequest] = useState({ title: "", description: "", category: "financial", priority: "medium", due_date: "" });
  const [showRequestForm, setShowRequestForm] = useState(false);

  // New note form
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("private");

  // Founder & Risk
  const [showFounderForm, setShowFounderForm] = useState(false);
  const [founderForm, setFounderForm] = useState({ founder_name:"", role:"", experience_score:0, leadership_score:0, domain_expertise_score:0, overall_rating:0, notes:"" });
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [riskForm, setRiskForm] = useState({ risk_category:"market", risk_description:"", severity:"medium", mitigation:"", status:"open" });

  const createWorkspace = async () => {
    try {
      const response = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "create_workspace" }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: "Due Diligence workspace created" });
        refreshAll();
      }
    } catch (_) {}
  };

  const addRequest = async () => {
    if (!newRequest.title.trim()) return;
    try {
      const response = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "add_request", ...newRequest }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: "Request submitted" });
        setNewRequest({ title: "", description: "", category: "financial", priority: "medium", due_date: "" });
        setShowRequestForm(false);
        refreshAll();
      }
    } catch (_) {}
  };

  const updateRequest = async (requestId, status) => {
    try {
      await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "update_request", request_id: requestId, status }),
      });
      refreshAll();
    } catch (_) {}
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const response = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "add_note", content: newNote, note_type: noteType }),
      });
      if (response.ok) { setNewNote(""); refreshAll(); }
    } catch (_) {}
  };

  const completeDiligence = async () => {
    try {
      await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "complete" }),
      });
      setToast({ type: "success", message: "Diligence completed" });
      refreshAll();
    } catch (_) {}
  };

  const [followupQuestion, setFollowupQuestion] = useState("");
  const [followupRequestId, setFollowupRequestId] = useState(null);
  const [uploadRequestId, setUploadRequestId] = useState(null);
  const [diligenceDocs, setDiligenceDocs] = useState({});

  const handleFileUpload = async (requestId, file) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(",")[1];
      try {
        const response = await fetch("/api/investor/diligence/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, file_name: file.name, file_type: file.type, file_data: base64 }),
        });
        const data = await response.json();
        if (data.success) {
          setToast({ type: "success", message: `"${file.name}" uploaded` });
          setUploadRequestId(null);
          fetchDiligenceDocs(requestId);
          refreshAll();
        }
      } catch (_) {}
    };
    reader.readAsDataURL(file);
  };

  const fetchDiligenceDocs = async (requestId) => {
    try {
      const response = await fetch(`/api/investor/diligence/documents?request_id=${requestId}`);
      const data = await response.json();
      if (data.success) setDiligenceDocs(previousDocs => ({ ...previousDocs, [requestId]: data.documents }));
    } catch (_) {}
  };

  const handleDownload = async (documentId) => {
    try {
      const response = await fetch(`/api/investor/diligence/documents?id=${documentId}&download=true`);
      const data = await response.json();
      if (data.success && data.document?.file_data) {
        const link = document.createElement("a");
        link.href = `data:${data.document.file_type};base64,${data.document.file_data}`;
        link.download = data.document.file_name;
        link.click();
      }
    } catch (_) {}
  };

  const addFollowup = async () => {
    if (!followupQuestion.trim() || !followupRequestId) return;
    try {
      const response = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "add_followup", request_id: followupRequestId, question: followupQuestion }),
      });
      if (response.ok) {
        setToast({ type: "success", message: "Follow-up question submitted" });
        setFollowupQuestion("");
        setFollowupRequestId(null);
        refreshAll();
      }
    } catch (_) {}
  };

  const saveFounder = async () => {
    if (!founderForm.founder_name) return;
    try {
      await fetch("/api/investor/evaluation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, type: "founder", ...founderForm }),
      });
      setToast({ type: "success", message: "Founder evaluation saved" });
      setShowFounderForm(false);
      setFounderForm({ founder_name:"", role:"", experience_score:0, leadership_score:0, domain_expertise_score:0, overall_rating:0, notes:"" });
      refreshAll();
    } catch (_) {}
  };

  const saveRisk = async () => {
    if (!riskForm.risk_description) return;
    try {
      await fetch("/api/investor/evaluation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, type: "risk", ...riskForm }),
      });
      setToast({ type: "success", message: "Risk assessment saved" });
      setShowRiskForm(false);
      setRiskForm({ risk_category:"market", risk_description:"", severity:"medium", mitigation:"", status:"open" });
      refreshAll();
    } catch (_) {}
  };

  const completedReqs = requests.filter(request => request.status === "responded" || request.status === "closed").length;
  const progress = requests.length > 0 ? Math.round((completedReqs / requests.length) * 100) : 0;

  if (loading) {
    return <><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>;
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* Header */}
        <DiligenceHeader onBack={goBack} pipeline={pipeline} workspace={workspace} onComplete={completeDiligence} />

        {/* No Workspace */}
        {!workspace ? (
          <NoWorkspaceState onStart={createWorkspace} />
        ) : (
          <>
            {/* Progress */}
            {requests.length > 0 && (
              <DiligenceProgress progress={progress} completedReqs={completedReqs} totalRequests={requests.length} />
            )}

            {/* Tabs */}
            <DiligenceTabs activeTab={activeTab} onTabChange={setActiveTab} requestCount={requests.length} noteCount={notes.length} />

            {/* Overview */}
            {activeTab === "overview" && <OverviewTab pipeline={pipeline} workspace={workspace} />}

            {/* Requests */}
            {activeTab === "requests" && (
              <RequestsTab
                requests={requests}
                showRequestForm={showRequestForm}
                setShowRequestForm={setShowRequestForm}
                newRequest={newRequest}
                setNewRequest={setNewRequest}
                addRequest={addRequest}
                updateRequest={updateRequest}
                followupRequestId={followupRequestId}
                setFollowupRequestId={setFollowupRequestId}
                followupQuestion={followupQuestion}
                setFollowupQuestion={setFollowupQuestion}
                addFollowup={addFollowup}
                uploadRequestId={uploadRequestId}
                setUploadRequestId={setUploadRequestId}
                handleFileUpload={handleFileUpload}
                fetchDiligenceDocs={fetchDiligenceDocs}
                diligenceDocs={diligenceDocs}
                handleDownload={handleDownload}
              />
            )}

            {/* Founder Evaluation */}
            {activeTab === "founders" && (
              <FoundersTab
                founders={founders}
                showFounderForm={showFounderForm}
                setShowFounderForm={setShowFounderForm}
                founderForm={founderForm}
                setFounderForm={setFounderForm}
                saveFounder={saveFounder}
              />
            )}

            {/* Risk Assessment */}
            {activeTab === "risks" && (
              <RisksTab
                risks={risks}
                showRiskForm={showRiskForm}
                setShowRiskForm={setShowRiskForm}
                riskForm={riskForm}
                setRiskForm={setRiskForm}
                saveRisk={saveRisk}
              />
            )}

            {/* Notes */}
            {activeTab === "notes" && (
              <NotesTab
                notes={notes}
                newNote={newNote}
                setNewNote={setNewNote}
                noteType={noteType}
                setNoteType={setNoteType}
                addNote={addNote}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function DueDiligencePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="w-8 h-8 text-[var(--brand-orange)] animate-spin" /></div>}>
      <DueDiligenceContent />
    </Suspense>
  );
}
