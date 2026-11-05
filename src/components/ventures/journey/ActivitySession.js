"use client";

import React, { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";
import MilestoneSessionBooking from "@/components/ventures/journey/MilestoneSessionBooking";
import SessionInvitees from "@/components/ventures/journey/SessionInvitees";

// An activity in one of these states is finished: nothing more is booked on it.
const FINISHED = new Set(["done", "completed", "cancelled"]);

/**
 * The "Session" button of an activity block, next to "Report": a window that
 * sums up the sessions of THIS activity (date, time, duration, coach, guests,
 * memo) and books a new one. Once the activity is finished the history stays
 * readable but no session can be booked any more.
 *
 * The panel keeps the booking state and the writes; this only renders them.
 */
export default function ActivitySession({
  activity,
  autoGrow,
  bookFor,
  bookForKey,
  bookForm,
  bookSaving,
  bookSession,
  canBook,
  coachOptions,
  deliverableList,
  milestone,
  onOpenBooking,
  sessionStatusKey,
  sessions,
  setBookFor,
  setBookForm,
  stage,
  ventureId,
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const finished = FINISHED.has(String(activity?.status || "").toLowerCase());

  const deliverableIds = new Set((deliverableList || []).map((item) => String(item.id)));
  const mine = (sessions || []).filter((session) => {
    if (session.status === "cancelled") return false;
    if (activity?.id != null) return String(session.task_id) === String(activity.id);
    return session.deliverable_id != null && deliverableIds.has(String(session.deliverable_id));
  });

  const when = (session) => {
    const start = new Date(session.start_time);
    const end = session.end_time ? new Date(session.end_time) : null;
    const day = start.toLocaleDateString(lang || undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const clock = (value) => value.toLocaleTimeString(lang || undefined, { hour: "2-digit", minute: "2-digit" });
    return { day, time: end ? `${clock(start)} – ${clock(end)}` : clock(start) };
  };

  const label = `${activity?.source_ref ? `${activity.source_ref} · ` : ""}${activity?.title || milestone.title || ""}`.trim();

  return (
    <>
      <button type="button" className="stf-btn sm" onClick={() => setOpen(true)}>
        <CalendarClock size={13} /> {t("venture.manager.activitySession.button")}
        {mine.length > 0 && <span className="stf-tag ml-1">{mine.length}</span>}
      </button>

      <AppModal isOpen={open} onClose={() => setOpen(false)} title={t("venture.manager.activitySession.title")} size="lg">
        <div className="stf stf-form">
          <div className="jy-act jy-plain" style={{ padding: "12px 14px" }}>
            <p className="jy-lbl">{t("venture.manager.report.activity")}</p>
            <p style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</p>
            <p className="stf-small" style={{ margin: 0 }}>{t("venture.manager.report.milestone")}: {milestone.title}</p>
          </div>

          {mine.length === 0 ? (
            <div className="stf-card stf-empty">{t("venture.manager.activitySession.empty")}</div>
          ) : (
            <ul style={{ display: "grid", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
              {mine.map((session) => {
                const slot = when(session);
                return (
                  <li key={session.id} className="jy-note">
                    <div className="jy-note-head">
                      <b>{session.title}</b>
                      <span className="stf-tag">{t(sessionStatusKey(session.status))}</span>
                    </div>
                    <dl className="jy-note-facts">
                      <div><dt>{t("venture.manager.activitySession.date")}</dt><dd>{slot.day}</dd></div>
                      <div><dt>{t("venture.manager.activitySession.time")}</dt><dd>{slot.time}</dd></div>
                      <div><dt>{t("venture.manager.activitySession.coach")}</dt><dd>{session.coach_name || "—"}</dd></div>
                    </dl>
                    {session.description && <p className="jy-note-body">{session.description}</p>}
                    {(session.materials || []).length > 0 && (
                      <div style={{ display: "grid", gap: 4 }}>
                        {session.materials.map((material, index) => (
                          material.url
                            ? <a key={index} href={material.url} target="_blank" rel="noreferrer" className="jy-note-att">{material.name}</a>
                            : <span key={index} className="jy-note-att">{material.name}</span>
                        ))}
                      </div>
                    )}
                    <SessionInvitees ventureId={ventureId} session={session} />
                  </li>
                );
              })}
            </ul>
          )}

          {finished ? (
            <p className="stf-small">{t("venture.manager.activitySession.finished")}</p>
          ) : canBook ? (
            <MilestoneSessionBooking
              autoGrow={autoGrow}
              bookFor={bookFor}
              bookForKey={bookForKey}
              bookForm={bookForm}
              bookSaving={bookSaving}
              bookSession={bookSession}
              coachOptions={coachOptions}
              deliverableList={deliverableList}
              milestone={milestone}
              onOpen={onOpenBooking}
              setBookFor={setBookFor}
              setBookForm={setBookForm}
              stage={stage}
            />
          ) : null}
        </div>
      </AppModal>
    </>
  );
}
