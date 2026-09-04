"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Rocket, Flag, ListTodo, Calendar, FileText, Users } from "lucide-react";
import VenturePageHeader from "@/components/ventures/VenturePageHeader";
import VentureNotesPanel from "@/components/ventures/VentureNotesPanel";

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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        setTasks((tk.tasks || []).slice(0, 8));
        setSessions((s.sessions || s.coaching_sessions || []).slice(0, 8));
      } catch (e) {
        console.error("Failed to load staff venture workspace:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
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
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-primary)]">{s.advisor_name || s.title || "Session"}</p>
                    {s.session_date && <p className="text-[10px] text-slate-500">{new Date(s.session_date).toLocaleDateString()}{s.start_time ? ` at ${s.start_time}` : ""}</p>}
                  </div>
                </div>
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

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
        <FileText className="w-3 h-3" /> Read panes shown according to your assignment. Full management tools are configured through Venture Permissions.
      </p>
    </div>
  );
}
