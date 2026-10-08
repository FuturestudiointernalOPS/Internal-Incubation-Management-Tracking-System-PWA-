"use client";

import {
  CheckCircle2,
  Lock,
  ChevronRight,
  FileText,
  Clock,
  ChevronDown,
  GraduationCap,
} from "lucide-react";
import NextLink from "next/link";
import CourseThumb from "@/components/lms/CourseThumb";
import RichTextContent from "@/components/ui/RichTextContent";
import StatusBadge from "./StatusBadge";

/** One curriculum week: a collapsible card with its sessions, deliverables,
 *  learning and material. `t` is passed in by the page. */
export default function WeekCard({ week, isExpanded, onToggle, onSubmit, t }) {
  const completedCount = week.deliverables.filter(
    (deliverable) => deliverable.submission?.status === "approved",
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
                ? week.sessions.map((session) => session.title).join(", ")
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
                  id={`session-${session.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-2)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {session.title}
                    </p>
                    {session.description && (
                      <RichTextContent
                        value={session.description}
                        className="text-xs mt-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      />
                    )}
                    {/* Weekly Materials from PM */}
                    {(() => {
                      let materials = [];
                      try {
                        const raw = session.extra_materials;
                        materials =
                          typeof raw === "string"
                            ? JSON.parse(raw || "[]")
                            : raw || [];
                      } catch (_) {}
                      if (materials.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {materials.map((material, materialIndex) => (
                            <a
                              key={materialIndex}
                              href={material.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
                            >
                              <FileText className="w-2.5 h-2.5" />
                              {material.name || material.title || t("participant.resource")}
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
              {week.deliverables.map((deliverable) => (
                <div
                  key={deliverable.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--surface-2)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {deliverable.title}
                        </p>
                        {deliverable.submission && (
                          <StatusBadge status={deliverable.submission.status} />
                        )}
                        {!deliverable.submission && !week.locked && deliverable.allowedFormat && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            ({deliverable.allowedFormat})
                          </span>
                        )}
                      </div>
                      {!deliverable.submission && deliverable.dueDate && (
                        <p className="text-[10px] text-amber-500/80 font-medium mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t("participant.due")} {new Date(deliverable.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {deliverable.submission && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {t("participant.submitted")}{" "}
                        {deliverable.submission.submittedAt
                          ? new Date(
                              deliverable.submission.submittedAt,
                            ).toLocaleDateString()
                          : ""}
                        {deliverable.submission.score > 0 &&
                          ` · ${t("participant.score")}: ${deliverable.submission.score}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {deliverable.submission?.fileUrl &&
                      (() => {
                        const isExternal =
                          deliverable.submission.fileUrl.startsWith("http");
                        return (
                          <a
                            href={deliverable.submission.fileUrl}
                            target={isExternal ? "_blank" : "_self"}
                            rel={isExternal ? "noopener noreferrer" : ""}
                            className="text-xs text-[var(--brand-orange)] hover:underline"
                          >
                            {t("participant.view")}
                          </a>
                        );
                      })()}
                    {!deliverable.submission && !week.locked && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onSubmit?.(deliverable.id, week.number, deliverable);
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
                const percent = item.progress?.percent || 0;
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
                                width: `${percent}%`,
                                background: "var(--brand-orange)",
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-[var(--text-tertiary)] shrink-0">
                            {percent}% · {item.progress.completedLessons} / {item.progress.totalLessons}{" "}
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
