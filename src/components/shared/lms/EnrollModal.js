"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Plus, UserPlus } from "lucide-react";
import LearnerAvatar from "./enroll/LearnerAvatar";
import LearnerDetail from "./enroll/LearnerDetail";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.
// Lower-case, accent-free text so "aicha" finds "Aïchath".
const foldText = (value) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const EMPTY_ENROLLMENTS = { list: [], failure: null };

const pickEnrollments = (data) =>
  data?.success
    ? { list: data.enrollments || [], failure: null }
    : { list: [], failure: data?.error || "lms.enroll.loadFailed" };

/**
 * Admin enrollment enabler — list a course's learners and enroll by email/cid.
 * Server-side authorization: lms.edit on the API. A full enrollment
 * management experience belongs to a later phase.
 */
export default function EnrollModal({ isOpen, onClose, courseId }) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  // Autocomplete: people matching what is typed who are not yet enrolled.
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputWrapRef = useRef(null);
  // The list is drawn on <body>, outside the dialog's scroll box, so it can
  // extend past the dialog instead of being clipped or adding a scrollbar to it.
  const [anchor, setAnchor] = useState(null);

  // One request when the dialog opens brings back everyone still addable; typing
  // then filters in the browser, so suggestions follow the keystrokes with no
  // round trip to the remote database.
  const [people, setPeople] = useState([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    fetch(`/api/lms/courses/${courseId}/enrollable`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body) => setPeople(body?.success ? body.people || [] : []))
      .catch(() => {
        // aborted or offline: the box still works by typing the full address
      })
      .finally(() => {
        if (!controller.signal.aborted) setPeopleLoaded(true);
      });
    return () => {
      controller.abort();
      setPeopleLoaded(false);
    };
  }, [isOpen, courseId]);

  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];
    const needle = foldText(identifier.trim());
    if (!needle) return people.slice(0, 200);
    const ranked = [];
    for (const person of people) {
      const name = foldText(person.name);
      const email = foldText(person.email);
      const cid = foldText(person.cid);
      let rank = -1;
      if (name.startsWith(needle) || email.startsWith(needle)) rank = 0;
      else if (name.split(/\s+/).some((word) => word.startsWith(needle))) rank = 1;
      else if (name.includes(needle) || email.includes(needle) || cid.includes(needle)) rank = 2;
      if (rank >= 0) ranked.push({ person, rank });
    }
    return ranked
      .sort((x, y) => x.rank - y.rank || String(x.person.name).localeCompare(String(y.person.name)))
      .slice(0, 200)
      .map((entry) => entry.person);
  }, [people, identifier, showSuggestions]);
  const searching = isOpen && !peopleLoaded;

  const listOpen = showSuggestions;
  useEffect(() => {
    if (!listOpen) return undefined;
    const place = () => {
      const rect = inputWrapRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [listOpen, suggestions.length]);

  const pick = (person) => {
    setIdentifier(person.email || person.cid);
    setShowSuggestions(false);
  };

  const onKeyDown = (event) => {
    const open = showSuggestions && suggestions.length > 0;
    if (open && event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((i) => (i + 1) % suggestions.length);
    } else if (open && event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (open && event.key === "Escape") {
      event.stopPropagation();
      setShowSuggestions(false);
    } else if (event.key === "Enter") {
      if (open && highlight >= 0) pick(suggestions[highlight]);
      else enroll();
    }
  };

  // The roster is read through the shared hook: addressed on the course, and
  // asked for only while the modal is open. Enrolling re-reads through
  // `refresh`, which bypasses the cache.
  const {
    data,
    loading,
    error: readError,
    refresh: refreshEnrollments,
  } = useApi(isOpen ? `/api/lms/courses/${courseId}/enrollments` : null, {
    defaultValue: EMPTY_ENROLLMENTS,
    transform: pickEnrollments,
    deps: [courseId],
  });
  const enrollments = data.list;

  // A refused payload keeps the server's own key, which is what the toast showed;
  // a request that never answered says so. The loader raised one error toast per
  // failed read, and that is this effect's only job - it writes no state.
  const failure = data.failure || readError || null;
  useEffect(() => {
    if (failure) notify("error", failure);
  }, [failure]);

  const enroll = async () => {
    if (!identifier.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/lms/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          userEmail: identifier.includes("@") ? identifier.trim() : undefined,
          userCid: identifier.includes("@") ? undefined : identifier.trim(),
          source: "admin",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.enroll.userNotFound");
      notify("success", "lms.enroll.enrolled");
      setPeople((list) => list.filter((person) => person.email !== identifier.trim() && person.cid !== identifier.trim()));
      setIdentifier("");
      refreshEnrollments();
    } catch (error) {
      notify("error", error.message || "lms.enroll.userNotFound");
    } finally {
      setSaving(false);
    }
  };

  const selected = selectedId ? enrollments.find((enrollment) => enrollment.id === selectedId) : null;
  if (selected) {
    return (
      <AppModal isOpen={isOpen} onClose={onClose} title={t("lms.enroll.title")} size="xl">
        <LearnerDetail courseId={courseId} enrollment={selected} onBack={() => setSelectedId(null)} />
      </AppModal>
    );
  }

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={t("lms.enroll.title")} size="xl">
      <div className="space-y-5 min-h-[20rem]">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1" ref={inputWrapRef}>
            <AppInput
              label={t("lms.enroll.emailOrCid")}
              icon={UserPlus}
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onClick={() => setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
              placeholder={t("lms.enroll.emailOrCidPlaceholder")}
              autoComplete="off"
              onKeyDown={onKeyDown}
            />
            {listOpen && anchor && typeof document !== "undefined" && createPortal(
              <ul
                role="listbox"
                className="fixed z-[700] rounded-lg border shadow-2xl overflow-y-auto overscroll-contain"
                style={{
                  left: anchor.left,
                  top: anchor.top,
                  width: anchor.width,
                  maxHeight: `min(24rem, calc(100vh - ${anchor.top}px - 16px))`,
                  background: "var(--surface-1)",
                  borderColor: "var(--border-primary)",
                }}
              >
                {suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    {searching ? t("common.loading") : t("lms.enroll.noMatch")}
                  </li>
                ) : (
                  suggestions.map((person, index) => (
                    <li
                      key={person.cid}
                      role="option"
                      aria-selected={index === highlight}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pick(person);
                      }}
                      onMouseEnter={() => setHighlight(index)}
                      className="px-4 py-3 cursor-pointer"
                      style={{ background: index === highlight ? "var(--surface-2)" : "transparent" }}
                    >
                      <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {person.name || person.cid}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
                        {person.email || person.cid}
                      </p>
                    </li>
                  ))
                )}
              </ul>,
              document.body,
            )}
          </div>
          <AppButton className="sm:self-end" variant="primary" icon={Plus} loading={saving} onClick={enroll}>
            {t("lms.enroll.enroll")}
          </AppButton>
        </div>

        <div className="border-t pt-4" style={{ borderColor: "var(--border-primary)" }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : enrollments.length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-center py-6" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.enroll.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enrollment) => {
                const progress = enrollment.progress || { percent: 0, completedLessons: 0, totalLessons: 0 };
                const results = enrollment.assessments || [];
                const passedCount = results.filter((result) => result.state === "passed").length;
                const failedCount = results.filter((result) => result.state === "failed").length;
                return (
                  <button
                    type="button"
                    key={enrollment.id}
                    onClick={() => setSelectedId(enrollment.id)}
                    title={t("lms.enroll.detail.viewProfile")}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-xl border transition-colors hover:border-[var(--brand-orange)]"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
                  >
                    <LearnerAvatar learner={enrollment.learner} fallback={enrollment.user_cid} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate" style={{ color: "var(--text-primary)" }}>
                        {enrollment.learner?.name || enrollment.user_cid}
                      </p>
                      <p className="text-[10px] font-bold truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {enrollment.learner?.email || enrollment.user_cid}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--text-tertiary)" }}>
                        {t(`lms.enroll.statuses.${enrollment.status}`)} · {t(`lms.enroll.sources.${enrollment.source}`)} · {formatDate(enrollment.enrolled_at)}
                      </p>
                    </div>
                    <div className="hidden sm:block w-52 shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                          {t("lms.enroll.lessonsDone", { done: progress.completedLessons, total: progress.totalLessons })}
                        </span>
                        <span className="text-[10px] font-black" style={{ color: "var(--text-primary)" }}>{progress.percent}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                        <div className="h-full rounded-full" style={{ width: `${progress.percent}%`, background: "var(--brand-orange)" }} />
                      </div>
                      {results.length > 0 && (
                        <p className="text-[9px] font-black uppercase tracking-wider mt-1.5 flex flex-wrap gap-x-2" style={{ color: "var(--text-tertiary)" }}>
                          <span style={{ color: passedCount > 0 ? "var(--chart-success)" : undefined }}>
                            {t("lms.enroll.assessmentsShort", { passed: passedCount, total: results.length })}
                          </span>
                          {failedCount > 0 && (
                            <span style={{ color: "var(--chart-danger)" }}>
                              ✕ {failedCount} {t("lms.enroll.assessmentStates.failed").toLowerCase()}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppModal>
  );
}
