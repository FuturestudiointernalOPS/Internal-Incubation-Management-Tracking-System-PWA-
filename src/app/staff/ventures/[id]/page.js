"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Rocket, Flag, ListTodo, Calendar, FileText, Users, Inbox } from "lucide-react";
import VenturePageHeader from "@/components/ventures/VenturePageHeader";
import VentureNotesPanel from "@/components/ventures/VentureNotesPanel";
import OperatingPlanPanel from "@/components/ventures/OperatingPlanPanel";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";
import CoachSessionPanel from "@/components/ventures/CoachSessionPanel";

/**
 * Staff → Ventures → [Venture] — staff workspace (Phase 3).
 *
 * The staff member sees ONLY Ventures they are assigned to (server-enforced).
 * The page surfaces their own responsibilities/scopes plus read panes for the
 * areas their responsibility profile allows (server remains authoritative).
 */
export default function StaffVentureWorkspace() {
  const { id } = useParams();
  const router = useRouter();

  const [venture, setVenture] = useState(null);
  const [myRoles, setMyRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  // Coach tint: who is viewing, and title maps used to render each session's
  // operational context (Journey stage · milestone · task) in the Sessions pane.
  const [myCid, setMyCid] = useState(null);
  const [myName, setMyName] = useState("");
  const [stageNameById, setStageNameById] = useState({});
  const [milestoneTitleById, setMilestoneTitleById] = useState({});
  const [taskTitleById, setTaskTitleById] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Attention: submissions awaiting this staff member's review (Coach view).
  const loadReviewQueue = async () => {
    try {
      const res = await fetch(`/api/ventures/${id}/submissions/review-queue`);
      const d = await res.json();
      if (d.success) setReviewQueue(d.items || []);
    } catch (_) {}
    finally { setQueueLoading(false); }
  };

  const decideSubmission = async (item, decision) => {
    const comment =
      decision === "changes_requested"
        ? window.prompt("Comment for the Venture (optional):") || ""
        : "";
    try {
      const res = await fetch(`/api/ventures/${id}/tasks/${item.task_id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", submission_id: item.submission_id, decision, comment: comment || null }),
      });
      const d = await res.json();
      if (d.success) await loadReviewQueue();
      else window.alert(d.error || "Review failed.");
    } catch (_) {
      window.alert("Review failed.");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [vRes, rRes, mRes, msRes, tRes, sRes] = await Promise.all([
          fetch(`/api/ventures/${id}`),
          fetch(`/api/ventures/assigned?venture=${id}`),
          fetch(`/api/ventures/${id}/members`),
          fetch(`/api/ventures/${id}/milestones`),
          fetch(`/api/ventures/${id}/tasks`),
          fetch(`/api/ventures/${id}/sessions`),
        ]);
        const v = await vRes.json();
        const roles = await rRes.json();
        const m = await mRes.json();
        const ms = await msRes.json();
        const tk = await tRes.json();
        const s = await sRes.json();
        if (!v.success) { setNotFound(true); return; }
        setVenture(v.venture);
        setMyRoles((roles.assignments || []).filter((r) => r.venture_id === id));
        setMembers((m.members || m.rows || []));
        setMilestones((ms.milestones || []).slice(0, 8));
        const fullTasks = tk.tasks || [];
        setTasks(fullTasks.slice(0, 8));
        const taskMap = {};
        for (const x of fullTasks) if (x.id != null && x.title) taskMap[String(x.id)] = x.title;
        setTaskTitleById(taskMap);
        setSessions((s.sessions || s.coaching_sessions || []).slice(0, 8));
        loadReviewQueue();
      } catch (e) {
        console.error("Failed to load staff venture workspace:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Coach tint: the viewer's contact id (localStorage fallback first, then the
  // authoritative session endpoint) decides which sessions show "Coached by you".
  useEffect(() => {
    let known = false;
    try {
      const saved = JSON.parse(localStorage.getItem("user") || "null");
      if (saved && saved.cid) {
        setMyCid(String(saved.cid));
        setMyName(saved.name || "");
        known = true;
      }
    } catch (_) {}
    if (known) return;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          setMyCid(String(d.user.cid || d.user.id || ""));
          setMyName(d.user.full_name || d.user.name || "");
        }
      })
      .catch(() => {});
  }, []);

  // Coach tint: the sessions list payload carries only soft context ids, so
  // Journey stage/milestone titles come from the same journey read the
  // JourneyManager uses (names are never invented client-side).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${id}/journey`);
        const d = await res.json();
        if (!d.success || !Array.isArray(d.stages)) return;
        const stageMap = {};
        const milestoneMap = {};
        for (const st of d.stages) {
          if (st.id) stageMap[String(st.id)] = st.name;
          for (const m of st.milestones || []) {
            if (m.id && m.title) milestoneMap[String(m.id)] = m.title;
          }
        }
        setStageNameById(stageMap);
        setMilestoneTitleById(milestoneMap);
      } catch (_) {}
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  if (notFound || !venture) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-16">
        <p className="text-sm font-bold text-[var(--text-primary)]">Venture unavailable</p>
        <p className="text-xs text-slate-500 mt-1">
          You can only access Ventures you are explicitly assigned to.
        </p>
        <button
          onClick={() => router.push("/staff/ventures")}
          className="mt-4 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest"
        >
          Back to My Ventures
        </button>
      </div>
    );
  }

  const displayName = venture.company_name || venture.name || "Venture";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/staff/ventures")}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> My Ventures
      </button>

      <VenturePageHeader
        displayName={displayName}
        brandColor={venture.branding?.color}
        ventureId={venture.venture_id}
        status={venture.status}
        metaItems={[
          venture.business_stage || "idea",
          venture.industry,
          venture.country,
        ]}
      />

      {/* My responsibilities on this Venture */}
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> My role on this Venture
        </h3>
        {myRoles.length === 0 ? (
          <p className="text-xs text-slate-500">No active assignment found.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myRoles.map((r) => (
              <span key={r.id} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                {r.responsibility_name || r.responsibility_code}
                {r.scope_type !== "venture_wide" && ` · ${r.scope_type}${r.scope_ref_id ? `: ${r.scope_ref_id}` : ""}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Attention — submissions awaiting review (Coach / Venture Support) */}
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Inbox className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Needs your attention ({reviewQueue.length})
        </h3>
        {queueLoading ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : reviewQueue.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing awaiting your review.</p>
        ) : (
          <div className="space-y-2">
            {reviewQueue.map((q) => (
              <div key={q.submission_id} className="rounded-lg border border-[var(--border-primary)] p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{q.task_title}</p>
                  <p className="text-[10px] text-slate-500">
                    {q.milestone_title ? `${q.milestone_title} · ` : ""}v{q.version} by {q.submitted_by_name || "Venture"} · {new Date(q.created_at).toLocaleDateString()}
                  </p>
                  {q.notes && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{q.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {q.file_url && (
                    <a href={q.file_url} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
                      Open
                    </a>
                  )}
                  <button onClick={() => decideSubmission(q, "approved")} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
                    Approve
                  </button>
                  <button onClick={() => decideSubmission(q, "changes_requested")} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25">
                    Request changes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Flag className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Milestones ({milestones.length})
          </h3>
          {milestones.length === 0 ? (
            <p className="text-xs text-slate-500">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{m.title}</p>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{m.status || "not_started"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ListTodo className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Tasks ({tasks.length})
          </h3>
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((tk) => (
                <div key={tk.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{tk.title}</p>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{tk.status || "backlog"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Sessions ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500">No sessions scheduled.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <CoachSessionPanel
                  key={s.id}
                  session={s}
                  ventureId={id}
                  myCid={myCid}
                  myName={myName}
                  stageNameById={stageNameById}
                  milestoneTitleById={milestoneTitleById}
                  taskTitleById={taskTitleById}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Founders & members ({members.length})
          </h3>
          {members.length === 0 ? (
            <p className="text-xs text-slate-500">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.slice(0, 6).map((mem) => (
                <div key={mem.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{mem.contact_name || mem.contact_id}</p>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{mem.member_type || "member"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {venture.description && (
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">About</h3>
          <p className="text-sm text-[var(--text-secondary)]">{venture.description}</p>
        </div>
      )}

      <VentureNotesPanel ventureId={id} />

      <OperatingPlanPanel ventureId={id} />

      <JourneyManagerPanel ventureId={id} />

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
        <FileText className="w-3 h-3" /> Read panes shown according to your assignment. Full management tools are configured through Venture Permissions.
      </p>
    </div>
  );
}
