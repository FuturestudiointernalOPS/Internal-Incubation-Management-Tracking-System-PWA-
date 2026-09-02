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
  Send,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import NextLink from "next/link";
import { useI18n } from "@/lib/i18n";
import { getServerErrorKey } from "@/lib/constants";
import SubmissionVersionHistory from "./SubmissionVersionHistory";
import CourseThumb from "@/components/lms/CourseThumb";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

// ─── Status Badge ──────────────────────────────────────────────────
function translateStatus(raw, t) {
  const statusKey = `status.${raw}`;
  let label = t(statusKey);
  if (label === statusKey) {
    const participantKey = `participant.${raw}`;
    label = t(participantKey);
    if (label === participantKey) label = raw.replace(/_/g, " ");
  }
  return label;
}

function StatusBadge({ status }) {
  const { t } = useI18n();
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
      {translateStatus(status || "draft", t)}
    </span>
  );
}

// ─── Week Card (simplified) ────────────────────────────────────────
function WeekCard({ week, isExpanded, onToggle, programId, onSubmit, t }) {
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
                {t("participant.week")} {week.number}
              </span>
              {week.isCurrent && (
                <span className="text-[10px] font-semibold text-[var(--brand-orange)]">
                  ({t("participant.current")})
                </span>
              )}
              {week.locked && (
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  ({t("participant.locked")})
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {week.sessions.length > 0
                ? week.sessions.map((s) => s.title).join(", ")
                : `${totalCount} ${t("participant.deliverables").toLowerCase()}`
            }
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
                {t("participant.sessions")}
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
                            <a
                              key={mi}
                              href={m.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[8px] font-bold text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
                            >
                              <FileText className="w-2.5 h-2.5" />
                              {m.name || m.title || t("participant.resource")}
                            </a>
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
                {t("participant.deliverables")}
              </h4>
              {week.deliverables.map((del) => (
                <div
                  key={del.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-2)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col">
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
                      {!del.submission && del.dueDate && (
                        <p className="text-[10px] text-amber-500/80 font-medium mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t("participant.due")} {new Date(del.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {del.submission && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {t("participant.submitted")}{" "}
                        {del.submission.submittedAt
                          ? new Date(
                              del.submission.submittedAt,
                            ).toLocaleDateString()
                          : ""}
                        {del.submission.score > 0 &&
                          ` · ${t("participant.score")}: ${del.submission.score}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {del.submission?.fileUrl &&
                      (() => {
                        const isExternal =
                          del.submission.fileUrl.startsWith("http");
                        return (
                          <a
                            href={del.submission.fileUrl}
                            target={isExternal ? "_blank" : "_self"}
                            rel={isExternal ? "noopener noreferrer" : ""}
                            className="text-xs text-[var(--brand-orange)] hover:underline"
                          >
                            {t("participant.view")}
                          </a>
                        );
                      })()}
                    {!del.submission && !week.locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmit?.(del.id, week.number, del);
                        }}
                        className="px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-xs font-medium hover:brightness-110"
                      >
                        {t("participant.submit")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Learning (LMS — Phase 6). Progress is read from the LMS; the
              Program never stores a second progress counter. */}
          {week.learning && week.learning.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                {t("participant.learning")}
              </h4>
              {week.learning.map((item) => {
                const href =
                  item.progress?.continueLesson && item.course?.id
                    ? `/participant/learning/${item.course.id}/lessons/${item.progress.continueLesson.lessonId}`
                    : item.course?.id
                      ? `/participant/learning/${item.course.id}`
                      : null;
                const pct = item.progress?.percent || 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--surface-2)]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {item.course?.thumbnail_url && (
                        <CourseThumb
                          src={item.course.thumbnail_url}
                          alt={item.course.title || ""}
                          className="w-9 h-9 rounded-lg"
                          iconClassName="w-4 h-4"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {item.title}
                        </p>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            item.is_required
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-white/5 text-[var(--text-tertiary)]"
                          }`}
                        >
                          {item.is_required
                            ? t("participant.required")
                            : t("participant.optional")}
                        </span>
                      </div>
                      {item.progress?.status === "unavailable" ? (
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                          {t("participant.learningUnavailable")}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: "var(--brand-orange)",
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-[var(--text-tertiary)] shrink-0">
                            {pct}% · {item.progress.completedLessons} / {item.progress.totalLessons}{" "}
                            {t("participant.lessons").toLowerCase()}
                          </span>
                        </div>
                      )}
                      </div>
                    </div>
                    {href && (
                      <NextLink
                        href={href}
                        className="shrink-0 text-xs font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1"
                      >
                        {item.progress?.status === "completed"
                          ? t("participant.reviewCourse")
                          : item.progress?.status === "in_progress"
                            ? t("participant.continueLearning")
                            : t("participant.startLearning")}
                        <ChevronRight className="w-3 h-3" />
                      </NextLink>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmitForm({ programId, deliverableId, deliverable, onDone, readOnly }) {
  const { t } = useI18n();
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
      let fileUrl = null;
      let supportingUrl = url.trim() || null;

      // If a file was selected, upload it
      if (file) {
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
        document_id: deliverableId, // Track 2 compatibility (v2_document_requirements uses integer IDs)
        file_url: fileUrl,
        supporting_url: supportingUrl,
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
        const key = getServerErrorKey(data.error);
        setSubmitError(key ? t(key) : data.error || t("errors.somethingWrong"));
      }
    } catch (_) {
      setSubmitError(t("errors.networkError"));
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {readOnly && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">
            {t("participantMisc.programListing.viewOnly")}
          </p>
          <p className="text-[8px] text-[var(--text-secondary)] mt-1">
            {t("errors.programCompletedViewOnly")}
          </p>
        </div>
      )}
      {/* Deliverable Info */}
      {deliverable && (
        <div className="bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border-primary)] space-y-1">
          <p className="text-[9px] font-bold text-[var(--text-primary)]">
            {deliverable.title}
          </p>
          {deliverable.description && (
            <p className="text-[8px] text-[var(--text-secondary)]">
              {deliverable.description}
            </p>
          )}
          {deliverable.dueDate && (
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className={`text-[8px] font-bold ${new Date(deliverable.dueDate) < new Date() ? 'text-rose-400' : 'text-amber-400'}`}>
                {t("participant.due")}: {new Date(deliverable.dueDate).toLocaleDateString()}
                {new Date(deliverable.dueDate) < new Date() ? ` (${t("participant.overdue")})` : ''}
              </span>
            </div>
          )}
          {deliverable.allowedFormat && (
            <p className="text-[7px] text-[var(--text-tertiary)] mt-1">
              {t("participant.format")}: {deliverable.allowedFormat}
            </p>
          )}
        </div>
      )}

      {(!deliverable?.allowedFormat || ['pdf', 'image', 'document', 'file'].includes(deliverable.allowedFormat.toLowerCase())) && (
        <div className="space-y-1">
          <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
            {t("participant.uploadFile")}
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={readOnly}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-[var(--brand-orange)] file:text-black file:cursor-pointer disabled:opacity-40 text-[var(--text-primary)]"
          />
        </div>
      )}
      
      {!deliverable?.allowedFormat && (
        <div className="text-center text-[8px] text-slate-500 uppercase tracking-widest my-2">
          — or —
        </div>
      )}
      
      {(!deliverable?.allowedFormat || ['link', 'video'].includes(deliverable.allowedFormat.toLowerCase())) && (
        <div className="space-y-1">
          <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
            {deliverable?.allowedFormat?.toLowerCase() === 'video' ? t("participant.videoUrl") : t("participant.urlLink")}
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={readOnly}
            placeholder="https://..."
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--brand-orange)] disabled:opacity-40 text-[var(--text-primary)]"
          />
        </div>
      )}
      {submitError && (
        <p className="text-[9px] font-bold text-rose-500 text-center">
          {submitError}
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting || readOnly || (!file && !url.trim())}
        className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> {t("participant.submitting")}</>
        ) : (
          <>
            <Upload className="w-4 h-4" /> {t("participant.submit")}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Resource Card ──────────────────────────────────────────────────
function ResourceCard({ resource }) {
  const { t } = useI18n();
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
  const isExternalUrl = hasValidUrl && resource.url.startsWith("http");

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
          {t("participant.noFile")}
        </span>
      </div>
    );
  }

  return (
    <a
      href={resource.url}
      target={isExternalUrl ? "_blank" : "_self"}
      rel={isExternalUrl ? "noopener noreferrer" : ""}
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
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [activeTab, setActiveTab] = useState("curriculum");
  const [user, setUser] = useState({});
  const [submitModal, setSubmitModal] = useState(null); // { deliverableId, weekNumber, deliverable }

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const fetchDetail = useCallback(async (bypassCache = false) => {
    const url = `/api/participant/programs/${programId}`;
    const apply = (result) => {
      if (result.success) {
        if (result.curriculum && result.curriculum.weeks) {
          result.curriculum.weeks = result.curriculum.weeks.map(w => ({
            ...w,
            deliverables: (w.deliverables || []).filter(d => !d.title?.toLowerCase().includes("attendance"))
          }));
        }
        setData(result);
        // Auto-expand current week
        if (result.curriculum?.currentWeek) {
          setExpandedWeeks({ [result.curriculum.currentWeek]: true });
        }
      } else {
        const key = getServerErrorKey(result.error);
        setError(key ? t(key) : result.error || t("participant.failedToLoad"));
      }
    };
    let painted = false;
    try {
      setLoading(true);
      setError(null);
      // Cache-first paint: returning to a program detail page renders
      // instantly from a fresh snapshot; submit flows pass bypassCache=true.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) cacheSet(url, result);
      apply(result);
    } catch (e) {
      if (!painted) setError(t("errors.networkError"));
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
            {t("participant.failedToLoad")}
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-2">
            {error}
          </p>
        </div>
        <button
          onClick={fetchDetail}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t("participant.retry")}
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
          {t("participant.programNotFound")}
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

  // Completed / archived programs are view-only for participants.
  const isViewOnlyProgram =
    !!program?.status && String(program.status).toLowerCase() !== "active";

  // The displayed status reflects the deliverables' actual state: once every
  // unlocked deliverable has an approved submission, show "Completed" rather
  // than the raw program status.
  const displayStatus =
    metrics.totalDeliverables > 0 &&
    metrics.completedDeliverables >= metrics.totalDeliverables
      ? "completed"
      : program.status || "active";

  // Resources grouped by week for display
  const resourcesByWeek = resources?.byWeek || {};
  const generalResources = resources?.general || [];

  const tabs = [
    { id: "curriculum", label: t("participant.curriculum"), icon: Layers },
    { id: "assignments", label: t("participant.assignments"), icon: FileText },
    { id: "progress", label: t("participant.progress"), icon: BarChart3 },
    { id: "resources", label: t("participant.resources"), icon: BookOpen },
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
            <StatusBadge status={displayStatus} />
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
            {t("participant.complete")}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            {t("participant.week")} {curriculum.currentWeek}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            {program.durationWeeks ? t("participant.ofWeeks", { total: program.durationWeeks }) : t("participant.current")}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            {metrics.totalDeliverables}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            {t("participant.deliverables")}
          </p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[18px] font-black text-[var(--text-primary)]">
            {metrics.completedDeliverables}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
            {t("participant.completed")}
          </p>
        </div>
      </div>

      {/* ═══ Facilitators ═══ */}
      {program.facilitators?.length > 0 && (
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            {t("participant.facilitators")}
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
                {t("participant.noCurriculumYet")}
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
                t={t}
                onSubmit={(delId, weekNumber, delData) =>
                  setSubmitModal({
                    deliverableId: delId,
                    weekNumber: weekNumber,
                    deliverable: delData,
                  })
                }
              />
            ))
          )}
        </div>
      )}

      {/* ═══ Tab: Assignments ═══ */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          {curriculum.weeks.filter(w => !w.locked).map((week) => (
            <div key={week.number} className="space-y-2">
              <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                Week {week.number}
              </h3>
              {week.deliverables.length === 0 ? (
                <p className="text-[9px] text-[var(--text-tertiary)] italic">{t("participant.noAssignmentsThisWeek")}</p>
              ) : (
                week.deliverables.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        d.submission?.status === "approved" ? "bg-emerald-500/10" :
                        d.submission ? "bg-amber-500/10" : "bg-white/5"
                      }`}>
                        <FileText className={`w-4 h-4 ${
                          d.submission?.status === "approved" ? "text-emerald-400" :
                          d.submission ? "text-amber-400" : "text-[var(--text-tertiary)]"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                          {d.title}
                        </p>
                        <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                          {d.allowedFormat} {d.dueDate ? `· ${t("participant.due")}: ${new Date(d.dueDate).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.submission ? (
                        <StatusBadge status={d.submission.status} />
                      ) : (
                        <span className="text-[8px] text-[var(--text-tertiary)] font-bold uppercase">{t("participant.pending")}</span>
                      )}
                      {d.submission?.score != null && (
                        <span className="text-[10px] font-black text-[var(--brand-orange)]">
                          {d.submission.score}/100
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
          {curriculum.weeks.filter(w => !w.locked).length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                {t("participant.noAssignmentsYet")}
              </p>
            </div>
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
                      {Number(weekNum) > 0 ? `${t("participant.week")} ${weekNum}` : t("participant.general")}
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
                {t("participant.generalResources")}
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
                {t("participant.noResourcesYet")}
              </p>
              <p className="text-[9px] text-[var(--text-tertiary)] mt-1">
                {t("participant.resourcesHint")}
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
                {t("participant.programCompletion")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
                  style={{ width: `${Math.min(metrics.percentComplete, 100)}%` }}
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
                {t("participant.attendance")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(metrics.attendanceRate, 100)}%` }}
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
                {t("participant.kpiAchievement")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${Math.min(metrics.kpiCompletion, 100)}%` }}
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
                {t("participant.deliverablesDone")}
              </p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-400 transition-all"
                  style={{
                    width: `${metrics.totalDeliverables > 0 ? Math.min((metrics.completedDeliverables / metrics.totalDeliverables) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submissions — Version History */}
          <div>
            <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              {t("participant.submissionHistory")}
            </h3>
            <SubmissionVersionHistory
              participantId={user?.cid || user?.id}
              programId={programId}
            />
          </div>

          {/* Follow-ups */}
          {followups.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                {t("participant.followUps")}
              </h3>
              <div className="space-y-2">
                {followups.slice(0, 5).map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                  >
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {t("participant.week")} {f.week_number}
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
              {t("participant.programInfo")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t("participant.status")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {translateStatus(program.status || "active", t)}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t("participant.duration")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.durationWeeks || "?"} {t("participant.weeks")}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t("participant.startDate")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.startDate
                    ? new Date(program.startDate).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t("participant.endDate")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {program.endDate
                    ? new Date(program.endDate).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t("participant.currentWeek")}
                </p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
                  {t("participant.week")} {curriculum.currentWeek}
                </p>
              </div>
              {program.pmName && (
                <div>
                  <p className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    {t("participant.programManager")}
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
                {t("participant.keyPerformanceIndicators")}
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
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md space-y-5 p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                {t("participant.submitDeliverable")}
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
                fetchDetail(true);
              }}
              readOnly={isViewOnlyProgram}
              deliverable={submitModal.deliverable}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
