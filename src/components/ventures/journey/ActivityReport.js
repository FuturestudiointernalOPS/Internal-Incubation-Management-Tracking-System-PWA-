"use client";

import React, { useState } from "react";
import { ClipboardList, ExternalLink, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppModal from "@/components/ui/AppModal";

// Module scope: the data hook keys its read on this function.
const pickNotes = (payload) => (payload?.success ? { notes: payload.notes || [], canPost: Boolean(payload.can_post) } : null);

const attachmentsOf = (note) => {
  if (Array.isArray(note.attachments)) return note.attachments;
  if (typeof note.attachments === "string" && note.attachments) {
    try {
      return JSON.parse(note.attachments);
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * The "Report" button of an activity block, and the reports behind it.
 *
 * A report is an internal note (staff-only; the notes API enforces it). Notes
 * are filed on a MILESTONE — the server refuses any other scope — so every
 * report of an activity lives on its milestone, and carries the activity in its
 * title (prefix `FT-01 · …`). The window shows this activity's reports first and
 * can widen to every report of the milestone.
 *
 * Reads:   GET    /api/ventures/[id]/notes?scope_type=milestone&scope_id=…
 * Writes:  POST   /api/ventures/[id]/notes        DELETE /api/ventures/[id]/notes
 */
export default function ActivityReport({ ventureId, milestone, activity }) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const prefix = activity ? `${activity.source_ref ? `${activity.source_ref} · ` : ""}${activity.title || ""}`.trim() : "";
  const blank = { title: prefix, body: "", url: "", urlName: "" };
  const [form, setForm] = useState(blank);

  const { data, loading, refresh } = useApi(
    open && ventureId ? `/api/ventures/${ventureId}/notes?scope_type=milestone&scope_id=${encodeURIComponent(milestone.id)}` : null,
    { defaultValue: null, transform: pickNotes, deps: [open, ventureId, milestone.id] },
  );
  const all = data?.notes || [];
  const mine = prefix ? all.filter((note) => String(note.title || "").startsWith(prefix)) : all;
  const shown = showAll || !prefix ? all : mine;
  const failed = open && !data && !loading;

  const day = (value) => new Date(value).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const clock = (value) => new Date(value).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const attachments = form.url.trim() || form.urlName.trim() ? [{ name: form.urlName.trim() || form.url.trim(), url: form.url.trim() }] : [];
      const response = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, body: form.body, scope_ref_type: "milestone", scope_ref_id: milestone.id, attachments }),
      });
      const payload = await response.json();
      if (payload.success) {
        setForm(blank);
        await refresh();
      } else setError(payload.error || t("venture.manager.notes.postFailed"));
    } catch {
      setError(t("venture.manager.notes.postFailed"));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (note) => {
    if (!(await confirm({ message: t("venture.manager.notes.deleteConfirm"), tone: "danger" }))) return;
    setError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: note.id }),
      });
      const payload = await response.json();
      if (payload.success) await refresh();
      else setError(payload.error || t("venture.manager.notes.deleteFailed"));
    } catch {
      setError(t("venture.manager.notes.deleteFailed"));
    }
  };

  const facts = (note) => {
    const rows = [
      [t("venture.manager.report.createdOn"), note.created_at ? day(note.created_at) : "—"],
      [t("venture.manager.report.createdAt"), note.created_at ? clock(note.created_at) : "—"],
      [t("venture.manager.report.author"), note.author_name || note.author_cid || "—"],
      [t("venture.manager.report.milestone"), milestone.title || "—"],
    ];
    if (activity) rows.push([t("venture.manager.report.activity"), `${activity.source_ref ? `${activity.source_ref} · ` : ""}${activity.title || ""}`]);
    const changed = note.updated_at && note.created_at && new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1000;
    if (changed) rows.push([t("venture.manager.report.updatedOn"), `${day(note.updated_at)} · ${clock(note.updated_at)}`]);
    if (note.author_cid && note.author_name) rows.push([t("venture.manager.report.authorId"), note.author_cid]);
    rows.push([t("venture.manager.report.reference"), `#${note.id}`]);
    return rows;
  };

  return (
    <>
      <button type="button" className="stf-btn sm" onClick={() => setOpen(true)}>
        <ClipboardList size={13} /> {t("venture.manager.report.button")}
      </button>

      <AppModal isOpen={open} onClose={() => setOpen(false)} title={t("venture.manager.report.title")} size="lg">
        <div className="stf stf-form">
          <div className="jy-act jy-plain" style={{ padding: "12px 14px" }}>
            <p className="jy-lbl">{t("venture.manager.report.activity")}</p>
            <p style={{ fontSize: 13.5, fontWeight: 700 }}>{prefix || milestone.title}</p>
            <p className="stf-small" style={{ margin: 0 }}>{t("venture.manager.report.milestone")}: {milestone.title}</p>
          </div>

          {prefix && (
            <div className="stf-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={!showAll} className={!showAll ? "on" : ""} onClick={() => setShowAll(false)}>
                {t("venture.manager.report.thisActivity", { count: mine.length })}
              </button>
              <button type="button" role="tab" aria-selected={showAll} className={showAll ? "on" : ""} onClick={() => setShowAll(true)}>
                {t("venture.manager.report.wholeMilestone", { count: all.length })}
              </button>
            </div>
          )}

          {loading ? (
            <p className="stf-small"><Loader2 size={14} className="animate-spin" style={{ display: "inline", marginRight: 6 }} />{t("common.loading")}</p>
          ) : failed ? (
            <p className="stf-err" role="alert">{t("venture.manager.notes.loadFailed")}</p>
          ) : shown.length === 0 ? (
            <div className="stf-card stf-empty">{t("venture.manager.report.empty")}</div>
          ) : (
            <ul style={{ display: "grid", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
              {shown.map((note) => (
                <li key={note.id} className="jy-note">
                  <div className="jy-note-head">
                    <b>{note.title}</b>
                    <button type="button" className="stf-btn sm rj" onClick={() => remove(note)} aria-label={t("venture.manager.notes.delete")} title={t("venture.manager.notes.delete")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="jy-note-body">{note.body}</p>
                  {attachmentsOf(note).length > 0 && (
                    <div style={{ display: "grid", gap: 4 }}>
                      {attachmentsOf(note).map((attachment, index) => (
                        <a key={index} href={attachment.url} target="_blank" rel="noreferrer" className="jy-note-att">
                          <Paperclip size={13} /> {attachment.name || attachment.url}
                          {String(attachment.url || "").startsWith("http") && <ExternalLink size={12} />}
                        </a>
                      ))}
                    </div>
                  )}
                  <dl className="jy-note-facts">
                    {facts(note).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="stf-err" role="alert">{error}</p>}

          {data?.canPost && (
            <form onSubmit={submit} className="jy-act jy-plain" style={{ gap: 10 }}>
              <p className="jy-lbl">{t("venture.manager.report.new")}</p>
              <input className="stf-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={t("venture.manager.notes.titlePlaceholder")} required />
              <textarea className="stf-textarea" rows={3} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={t("venture.manager.notes.bodyPlaceholder")} required />
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <input className="stf-input" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder={t("venture.manager.notes.urlPlaceholder")} />
                <input className="stf-input" value={form.urlName} onChange={(event) => setForm({ ...form, urlName: event.target.value })} placeholder={t("venture.manager.notes.urlNamePlaceholder")} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="stf-btn pr" disabled={posting}>
                  {posting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t("venture.manager.report.add")}
                </button>
              </div>
            </form>
          )}
        </div>
      </AppModal>
    </>
  );
}
