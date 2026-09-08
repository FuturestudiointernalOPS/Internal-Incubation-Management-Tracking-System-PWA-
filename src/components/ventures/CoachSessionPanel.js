"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * Staff Venture workspace — coach-tinted session row (Vinance 3, item 1).
 *
 * Renders one session from GET /api/ventures/[id]/sessions with the pieces a
 * coach cares about:
 *   • "Coached by you" badge — the current viewer is the session's coach
 *     (coach_contact_id === myCid, falling back to a coach-name match when
 *     the row carries no resolved platform contact id).
 *   • Operational context line — the Journey stage · milestone · task this
 *     session was created for. The sessions list payload only carries the
 *     soft ids (journey_stage_id / milestone_ref / task_id), so titles are
 *     resolved from title maps the page already fetched (journey read +
 *     tasks list). Unresolvable ids degrade gracefully: milestone soft refs
 *     that are plain text are shown as-is, UUID ids and unknown task ids are
 *     shown raw ("Task: <id>") so the reference is never silently dropped.
 *   • "Session report" expandable — fetches the session detail via POST
 *     get_session on open, lists the existing session notes (getSession
 *     returns them as `notes`), and appends a coach report note via POST
 *     add_note with note_type "coach_feedback", then refreshes the detail.
 *
 * Pure display + append: nothing here edits the session itself.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCoachedByViewer(s, myCid, myName) {
  const cid = s.coach_contact_id;
  if (cid !== null && cid !== undefined && String(cid).trim() !== "") {
    return !!(myCid && String(cid) === String(myCid));
  }
  // Rows without a resolved platform contact (legacy catalog coach): match by
  // the coach display name the payload carries.
  const coach = String(s.coach_name || s.advisor_name || "").trim().toLowerCase();
  return !!(myName && coach && coach === String(myName).trim().toLowerCase());
}

export default function CoachSessionPanel({
  session: s,
  ventureId,
  myCid,
  myName,
  stageNameById = {},
  milestoneTitleById = {},
  taskTitleById = {},
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const mine = isCoachedByViewer(s, myCid, myName);

  const loadDetail = async (force = false) => {
    if (!force && (detail || loading)) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_session", session_id: s.id }),
      });
      const d = await res.json();
      if (d.success && d.session) setDetail(d.session);
      else setLoadError(true);
    } catch (_) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) loadDetail();
  };

  const addNote = async () => {
    const content = noteText.trim();
    if (!content || !detail || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_note",
          session_id: detail.id,
          note_type: "coach_feedback",
          content,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setNoteText("");
        await loadDetail(true);
      } else {
        setSaveError(true);
      }
    } catch (_) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // Operational context this session was created with. The list payload only
  // guarantees the soft refs; we never invent names that are not available.
  const ctxParts = [];
  if (s.journey_stage_id != null && s.journey_stage_id !== "") {
    const stage = stageNameById[String(s.journey_stage_id)];
    if (stage) ctxParts.push(stage);
  }
  if (s.milestone_ref != null && s.milestone_ref !== "") {
    const ref = String(s.milestone_ref);
    if (milestoneTitleById[ref]) ctxParts.push(milestoneTitleById[ref]);
    else if (!UUID_RE.test(ref)) ctxParts.push(s.milestone_ref);
  }
  if (s.task_id != null && s.task_id !== "") {
    const taskKey = String(s.task_id);
    ctxParts.push(
      taskTitleById[taskKey]
        ? taskTitleById[taskKey]
        : `${t("venture.coach.contextTask")}: ${s.task_id}`,
    );
  }
  const contextLine = ctxParts.length ? ctxParts.join(" · ") : null;

  const notes = detail?.notes || [];

  return (
    <div className="p-2.5 rounded-lg border border-[var(--border-primary)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {s.advisor_name || s.title || "Session"}
          </p>
          {mine && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[8px] font-black uppercase tracking-widest">
              {t("venture.coach.mySessionsBadge")}
            </span>
          )}
        </div>
        {s.session_date && (
          <p className="text-[10px] text-slate-500">
            {new Date(s.session_date).toLocaleDateString()}
            {s.start_time ? ` at ${s.start_time}` : ""}
          </p>
        )}
        {contextLine && (
          <p className="text-[9px] text-slate-500 mt-1 truncate" title={contextLine}>
            {contextLine}
          </p>
        )}
      </div>

      <details
        open={open}
        className="mt-1.5"
      >
        <summary
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
          className="cursor-pointer list-none select-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-colors"
        >
          {t("venture.coach.reportAction")}
        </summary>

        <div className="mt-2 pt-2 border-t border-[var(--border-primary)] space-y-2">
          {loading ? (
            <p className="text-[10px] text-slate-500">{t("common.loading")}</p>
          ) : loadError ? (
            <p className="text-[10px] text-rose-400">
              {t("venture.coach.reportLoadError")}
            </p>
          ) : detail ? (
            <>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                {t("venture.coach.reportNotes")} ({notes.length})
              </p>
              {notes.length === 0 ? (
                <p className="text-[10px] text-slate-500">
                  {t("venture.coach.reportEmpty")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {notes.map((n) => (
                    <div key={n.id} className="p-2 rounded-lg bg-tertiary">
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                        {n.content}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {n.author_name ? `${n.author_name} · ` : ""}
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {saveError && (
                <p className="text-[10px] text-rose-400">
                  {t("venture.coach.reportSaveError")}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t("venture.coach.reportPlaceholder")}
                  className="flex-1 min-w-0 bg-primary border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[10px] text-[var(--text-primary)] placeholder:text-slate-500 outline-none focus:border-[var(--brand-orange)]/50"
                />
                <button
                  onClick={addNote}
                  disabled={!noteText.trim() || saving}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[8px] font-black uppercase tracking-widest disabled:opacity-30 hover:brightness-110 transition-all"
                >
                  {t("venture.coach.reportSave")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </details>
    </div>
  );
}
