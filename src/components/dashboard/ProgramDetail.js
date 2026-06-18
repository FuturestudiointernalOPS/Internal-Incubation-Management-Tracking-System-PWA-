"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Calendar,
  BookOpen,
  Target,
  CheckCircle2,
  Lock,
  ChevronRight,
  FileText,
  Clock,
  ExternalLink,
  Zap,
  AlertCircle,
  Users,
  Layers,
  Loader2,
  ChevronDown,
  RefreshCw,
  Video,
  Download,
  File,
  Link,
  Bookmark,
  BarChart3,
  User,
  Mail,
  X,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const c =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${c}`}
    >
      {status || "draft"}
    </span>
  );
}

// ─── Week Card (simplified) ────────────────────────────────────────
function WeekCard({ week, isExpanded, onToggle, programId, onSubmit }) {
  const completedCount = week.deliverables.filter(
    (d) => d.submission?.status === "approved",
  ).length;
  const totalCount = week.deliverables.length;

  return (
    <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      {/* Header — clickable row */}
      <button
        onClick={() => onToggle(week.number)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-2)] transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
              week.isCurrent
                ? "bg-[var(--brand-orange)] text-black"
                : week.completed
                  ? "bg-emerald-500/20 text-emerald-400"
                  : week.locked
                    ? "bg-white/5 text-[var(--text-tertiary)]"
                    : "bg-white/10 text-[var(--text-primary)]"
            }`}
          >
            {week.locked ? (
              <Lock className="w-4 h-4" />
            ) : week.completed ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              week.number
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                Week {week.number}
              </span>
              {week.isCurrent && (
                <span className="text-[10px] font-semibold text-[var(--brand-orange)]">
                  (Current)
                </span>
              )}
              {week.locked && (
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  (Locked)
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {week.sessions.length > 0
                ? week.sessions.map((s) => s.title).join(", ")
                : `${totalCount} deliverable${totalCount > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {completedCount}/{totalCount}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-primary)] px-5 py-4 space-y-4">
          {/* Sessions */}
          {week.sessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
                Sessions
              </h4>
              {week.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-2)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {session.title}
                    </p>
                    {session.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {session.description}
                      </p>
                    )}
                    {/* Weekly Materials from PM */}
                    {(() => {
                      let mats = [];
                      try {
                        const raw = session.extra_materials;
                        mats =
                          typeof raw === "string"
                            ? JSON.parse(raw || "[]")
                            : raw || [];
                      } catch (_) {}
                      if (mats.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {mats.map((m, mi) => (
                            <span
                              key={mi}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[8px] font-bold text-blue-400"
                            >
                              <FileText className="w-2.5 h-2.5" />
                              {m.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {session.type && (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {session.type}
                      </span>
                    )}
                    {(session.start_at || session.start_time) && (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {session.start_at
                          ? new Date(session.start_at).toLocaleDateString(
                              "en",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : ""}
                        {session.start_time
                          ? ` ${new Date(`2000-01-01T${session.start_time}`).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`
                          : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Deliverables */}
          {week.deliverables.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
                Deliverables
              </h4>
              {week.deliverables.map((del) => (
                <div
                  key={del.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-2)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {del.title}
                      </p>
                      {del.submission && (
                        <StatusBadge status={del.submission.status} />
                      )}
                      {!del.submission && !week.locked && del.allowedFormat && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                          ({del.allowedFormat})
                        </span>
                      )}
                    </div>
                    {del.submission && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        Submitted{" "}
                        {del.submission.submittedAt
                          ? new Date(
                              del.submission.submittedAt,
                            ).toLocaleDateString()
                          : ""}
                        {del.submission.score > 0 &&
                          ` · Score: ${del.submission.score}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {del.submission?.fileUrl && (
                      <a
                        href={del.submission.fileUrl}
                        target="_blank"
                        className="text-xs text-[var(--brand-orange)] hover:underline"
                      >
                        View
                      </a>
                    )}
                    {!del.submission && !week.locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmit?.(del.id, week.number);
                        }}
                        className="px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-xs font-medium hover:brightness-110"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmitForm({ programId, deliverableId, onDone }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [url, setUrl] = useState("");
  const [user, setUser] = useState({});

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const handleSubmit = async () => {
    if (!file && !url.trim()) return;
    setSubmitting(true);
    try {
      let fileUrl = url.trim() || null;

      // If a file was selected, upload it first
      if (file && !fileUrl) {
        try {
          const { uploadFile } = await import("@/lib/storage");
          const result = await uploadFile(
            "submissions",
            `${programId}/${Date.now()}-${file.name}`,
            file,
          );
          if (result.success) fileUrl = result.url;
        } catch (_) {}
      }

      const body = {
        participant_id: user.cid || user.id,
        program_id: programId,
        deliverable_id: deliverableId,
        file_url: fileUrl,
        status: "pending",
      };
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onDone?.();
      } else {
        setSubmitError(data.error || "Failed to submit. Please try again.");
      }
    } catch (_) {
      setSubmitError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
          Upload File
        </label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none"
        />
      </div>
      <div className="text-center text-[8px] text-slate-500 uppercase tracking-widest">
        — or —
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
          Link URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--brand-orange)]"
        />
      </div>
      {submitError && (
        <p className="text-[9px] font-bold text-rose-500 text-center">
          {submitError}
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting || (!file && !url.trim())}
        className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          "Submitting..."
        ) : (
          <>
            <Upload className="w-4 h-4" /> Submit
          </>
        )}
      </button>
    </div>
  );
}

// ─── Resource Card ──────────────────────────────────────────────────
function ResourceCard({ resource }) {
  const typeIcons = {
    video: Video,
    document: FileText,
    pdf: File,
    link: Link,
    template: File,
    guide: BookOpen,
  };
  const Icon = typeIcons[resource.fileType?.toLowerCase()] || BookOpen;
  const hasValidUrl =
    resource.url && resource.url !== "[]" && resource.url !== "";

  if (!hasValidUrl) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] opacity-60 cursor-default">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
            {resource.title}
          </p>
          {resource.description && (
            <p className="text-[9px] text-[var(--text-secondary)] truncate">
              {resource.description}
            </p>
          )}
        </div>
        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest shrink-0">
          No file
        </span>
      </div>
    );
  }

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/20 transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
          {resource.title}
        </p>
        {resource.description && (
          <p className="text-[9px] text-[var(--text-secondary)] truncate">
            {resource.description}
          </p>
        )}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--brand-orange)] transition-all shrink-0" />
    </a>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-24 bg-white/10 rounded" />
      <div className="bg-[var(--bg-tertiary)] rounded-xl p-6 border border-[var(--border-primary)]">
        <div className="h-5 w-40 bg-white/10 rounded mb-3" />
        <div className="h-4 w-64 bg-white/5 rounded mb-2" />
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-white/5 rounded" />
          <div className="h-5 w-24 bg-white/5 rounded" />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-20 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
        />
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ProgramDetail({ programId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [activeTab, setActiveTab] = useState("curriculum");
  const [submitModal, setSubmitModal] = useState(null); // { deliverableId, weekNumber }

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/participant/programs/${programId}`);
      const result = await res.json();
      if (result.success) {
        setData(result);
        // Auto-expand current week
        if (result.curriculum?.currentWeek) {
          setExpandedWeeks({ [result.curriculum.currentWeek]: true });
        }
      } else {
        setError(result.error || "Failed to load program");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const toggleWeek = (weekNumber) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNumber]: !prev[weekNumber],
    }));
  };

  // ── Error State ──────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <AlertCircle className="w-12 h-12 text-rose-400" />
        <div className="text-center">
          <h3 className="text-lg font-black text-[var(--text-primary)]">
            Failed to Load
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-2">
            {error}
          </p>
        </div>
        <button
          onClick={fetchDetail}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (loading) return <DetailSkeleton />;
  if (!data?.program) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <BookOpen className="w-12 h-12 text-[var(--text-tertiary)] mb-3" />
        <p className="text-[12px] font-bold text-[var(--text-secondary)]">
          Program not found
        </p>
      </div>
    );
  }

  const {
    program,
    curriculum,
    resources,
    submissions,
    attendance,
    kpis,
    followups,
  } = data;
  const { metrics } = program;

  // Resources grouped by week for display
  const resourcesByWeek = resources?.byWeek || {};
  const generalResources = resources?.general || [];

  const tabs = [
    { id: "curriculum", label: "Curriculum", icon: Layers },
    { id: "resources", label: "Resources", icon: BookOpen },
    { id: "progress", label: "Progress", icon: BarChart3 },
    { id: "details", label: "Details", icon: FileText },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* ═══ Back + Header ═══ */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-all mt-1"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={program.status} />
            {program.programMode && (
              <span className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                {program.programMode}
              </span>
            )}
          </div>
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            {program.name}
          </h1>
          {program.description && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-2xl">
              {program.description}
            </p>
          )}
        </div>
      </div>

      {/* ═══ Program Quick Stats ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            {metrics.percentComplete}%
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            Complete
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            Week {curriculum.currentWeek}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            {program.durationWeeks ? `of ${program.durationWeeks}` : "Current"}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            {metrics.totalDeliverables}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            Deliverables
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            {metrics.completedDeliverables}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            Completed
          </p>
        </div>
      </div>

      {/* ═══ Facilitators ═══ */}
      {program.facilitators?.length > 0 && (
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Facilitators
          </p>
          <div className="flex flex-wrap gap-2">
            {program.pmName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20">
                <User className="w-3 h-3 text-[var(--brand-orange)]" />
                <span className="text-[9px] font-bold text-[var(--brand-orange)]">
                  {program.pmName} (PM)
                </span>
              </div>
            )}
            {program.facilitators.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20"
              >
                <User className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-bold text-blue-400">
                  {f.name} {f.role ? `(${f.role})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Tabs ═══ */}
      <div className="flex items-center gap-1 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[var(--brand-orange)] text-black"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab: Curriculum ═══ */}
      {activeTab === "curriculum" && (
        <div className="space-y-3">
          {curriculum.weeks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                No curriculum available yet
              </p>
            </div>
          ) : (
            curriculum.weeks.map((week) => (
              <WeekCard
                key={week.number}
                week={week}
                isExpanded={!!expandedWeeks[week.number]}
                onToggle={toggleWeek}
                programId={programId}
                onSubmit={(delId) =>
                  setSubmitModal({
                    deliverableId: delId,
                    weekNumber: week.number,
                  })
                }
              />
            ))
          )}
        </div>
      )}

      {/* ═══ Tab: Resources ═══ */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          {/* Resources by week */}
          {Object.entries(resourcesByWeek).length > 0
            ? Object.entries(resourcesByWeek)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([weekNum, items]) => (
                  <div key={weekNum}>
                    <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                      {Number(weekNum) > 0 ? `Week ${weekNum}` : "General"}
                    </h3>
                    <div className="space-y-2">
                      {items.map((r) => (
                        <ResourceCard key={r.id} resource={r} />
                      ))}
                    </div>
                  </div>
                ))
            : null}

          {/* General resources */}
          {generalResources.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                General Resources
              </h3>
              <div className="space-y-2">
                {generalResources.map((r) => (
                  <ResourceCard key={r.id} resource={r} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!resources || resources.total === 0) && (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                No resources available yet
              </p>
              <p className="text-[9px] text-[var(--text-tertiary)] mt-1">
                Resources will appear here when added by your program manager.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab: Progress ═══ */}
      {activeTab === "progress" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
              </div>
              <p className="text-xl font-black text-[var(--text-primary)]">
                {metrics.percentComplete}%
              </p>
              <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
                Program Completion
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3">
                <div
                  className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
                  style={{ width: `${metrics.percentComplete}%` }}
                />
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-xl font-black text-[var(--text-primary)]">
                {metrics.attendanceRate}%
              </p>
              <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
                Attendance
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${metrics.attendanceRate}%` }}
                />
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className="text-xl font-black text-[var(--text-primary)]">
                {metrics.kpiCompletion}%
              </p>
              <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
                KPI Achievement
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${metrics.kpiCompletion}%` }}
                />
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <p className="text-xl font-black text-[var(--text-primary)]">
                {metrics.completedDeliverables}/{metrics.totalDeliverables}
              </p>
              <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
                Deliverables Done
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3">
                <div
                  className="h-full rounded-full bg-purple-400 transition-all"
                  style={{
                    width: `${(metrics.completedDeliverables / metrics.totalDeliverables) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submissions */}
          <div>
            <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Submission History
            </h3>
            {submissions.length === 0 ? (
              <div className="text-center py-8 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                <FileText className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                  No submissions yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.slice(0, 10).map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={sub.status} />
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">
                          Deliverable #{sub.document_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {sub.score > 0 && (
                          <span className="text-[9px] font-bold text-emerald-400">
                            {sub.score} pts
                          </span>
                        )}
                        <span className="text-[8px] text-[var(--text-tertiary)]">
                          {sub.created_at
                            ? new Date(sub.created_at).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </div>
                    {sub.feedback && (
                      <div className="mt-2 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                        <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                          PM Feedback
                        </p>
                        <p className="text-[10px] text-[var(--text-primary)] leading-relaxed">
                          {sub.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups */}
          {followups.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Follow-ups
              </h3>
              <div className="space-y-2">
                {followups.slice(0, 5).map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                  >
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      Week {f.week_number}
                    </p>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                      {f.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab: Details ═══ */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Program Info */}
          <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
            <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-4">
              Program Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Status
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.status || "Active"}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Duration
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.durationWeeks || "?"} weeks
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Start Date
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.startDate
                    ? new Date(program.startDate).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  End Date
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.endDate
                    ? new Date(program.endDate).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Current Week
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  Week {curriculum.currentWeek}
                </p>
              </div>
              {program.pmName && (
                <div>
                  <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Program Manager
                  </p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                    {program.pmName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* KPIs */}
          {kpis.length > 0 && (
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
              <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                Key Performance Indicators
              </h3>
              <div className="space-y-3">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {kpi.title}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {kpi.current_value || 0} / {kpi.target_value || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Submit Modal ═══ */}
      {submitModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSubmitModal(null)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md space-y-5 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                Submit Deliverable
              </h3>
              <button onClick={() => setSubmitModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <SubmitForm
              programId={programId}
              deliverableId={submitModal.deliverableId}
              onDone={() => {
                setSubmitModal(null);
                fetchDetail();
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
