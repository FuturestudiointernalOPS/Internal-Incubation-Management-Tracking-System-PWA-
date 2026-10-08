"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";
import { SETTABLE_STATUSES, parseKey, timeLabel } from "./calendarModel";

/** The "new task / meeting" form. */
export function EventFormModal({ form, setForm, patchForm, submitForm, statusLabel }) {
  const { t } = useI18n();
  return (
    <AppModal isOpen={!!form} onClose={() => setForm(null)} title={form ? t(form.type === "meeting" ? "staffMisc.front.calendar.newMeeting" : "staffMisc.front.calendar.newTask") : ""} size="sm">
      {form && (
        <form className="stf stf-form" onSubmit={submitForm} noValidate>
          <div className="stf-tabs" role="group" aria-label={t("staffMisc.front.calendar.type")}>
            {["task", "meeting"].map((value) => (
              <button key={value} type="button" className={form.type === value ? "on" : ""} aria-pressed={form.type === value} onClick={() => patchForm({ type: value })}>
                {t(`staffMisc.front.calendar.kind.${value}`)}
              </button>
            ))}
          </div>
          <p className="stf-sub" style={{ margin: 0 }}>
            {t(form.type === "meeting" ? "staffMisc.front.calendar.meetingHint" : "staffMisc.front.calendar.taskHint")}
          </p>
          <div className="stf-field">
            <label className="stf-k" htmlFor="stf-f-title">{t("staffMisc.front.calendar.fieldTitle")}</label>
            <input id="stf-f-title" className="stf-input" maxLength={120} autoComplete="off" value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder={t(form.type === "meeting" ? "staffMisc.front.calendar.placeholderMeeting" : "staffMisc.front.calendar.placeholderTask")} />
          </div>
          <div className="stf-field">
            <label className="stf-k" htmlFor="stf-f-date">{t("staffMisc.front.calendar.fieldDate")}</label>
            <input id="stf-f-date" type="date" className="stf-input" value={form.date} onChange={(event) => patchForm({ date: event.target.value })} />
          </div>
          {form.type === "meeting" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="stf-field">
                  <label className="stf-k" htmlFor="stf-f-start">{t("staffMisc.front.calendar.fieldStart")}</label>
                  <input id="stf-f-start" type="time" step="900" className="stf-input" value={form.start} onChange={(event) => patchForm({ start: event.target.value })} />
                </div>
                <div className="stf-field">
                  <label className="stf-k" htmlFor="stf-f-end">{t("staffMisc.front.calendar.fieldEnd")}</label>
                  <input id="stf-f-end" type="time" step="900" className="stf-input" value={form.end} onChange={(event) => patchForm({ end: event.target.value })} />
                </div>
              </div>
              <div className="stf-field">
                <label className="stf-k" htmlFor="stf-f-place">{t("staffMisc.front.calendar.fieldPlace")}</label>
                <input id="stf-f-place" className="stf-input" maxLength={120} autoComplete="off" value={form.place} onChange={(event) => patchForm({ place: event.target.value })} placeholder={t("staffMisc.front.calendar.placeholderPlace")} />
              </div>
            </>
          ) : (
            <div className="stf-field">
              <label className="stf-k" htmlFor="stf-f-status">{t("staffMisc.front.calendar.fieldStatus")}</label>
              <select id="stf-f-status" className="stf-select" value={form.status} onChange={(event) => patchForm({ status: event.target.value })}>
                {SETTABLE_STATUSES.map((value) => (
                  <option key={value} value={value}>{statusLabel(value)}</option>
                ))}
              </select>
            </div>
          )}
          {form.error && <p className="stf-err" role="alert">{form.error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="stf-btn" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="stf-btn pr" disabled={form.busy}>
              {form.busy ? t("common.loading") : t(form.type === "meeting" ? "staffMisc.front.calendar.addMeeting" : "staffMisc.front.calendar.addTask")}
            </button>
          </div>
        </form>
      )}
    </AppModal>
  );
}

/** The details of a meeting or milestone. */
export function EventDetailModal({ detail, setDetail, locale }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <AppModal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? detail.title : ""} size="sm">
      {detail && (
        <div className="stf stf-form">
          <div className="stf-row" style={{ border: 0, padding: 0 }}>
            <span className="stf-tag o">{t(`staffMisc.front.calendar.kind.${detail.kind}`)}</span>
            {detail.status && <span className="stf-tag">{detail.status}</span>}
          </div>
          <p className="stf-sub" style={{ margin: 0 }}>
            {parseKey(detail.key).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {!detail.allDay && ` · ${timeLabel(detail.start)} – ${timeLabel(detail.end)}`}
          </p>
          {detail.place && <p className="stf-sub" style={{ margin: 0 }}>{detail.place}</p>}
          {detail.raw?.description && <p className="stf-sub" style={{ margin: 0 }}>{detail.raw.description}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {detail.source === "program" && (
              <button type="button" className="stf-btn" onClick={() => router.push(`/pm/programs/${detail.relatedId}`)}>
                {t("staffMisc.front.calendar.openProgram")}
              </button>
            )}
            <button type="button" className="stf-btn pr" onClick={() => setDetail(null)}>{t("common.close")}</button>
          </div>
        </div>
      )}
    </AppModal>
  );
}
