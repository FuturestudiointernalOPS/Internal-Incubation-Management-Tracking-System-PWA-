"use client";

import React, { useState } from "react";
import { Loader2, StickyNote, Plus, Trash2, ExternalLink, Paperclip } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppModal from "@/components/ui/AppModal";

/**
 * ScopedNotes — contextual internal notes for one operating object
 * (Vinance 3 — Phase 2).
 *
 * Staff-only (the notes API enforces it): lists/creates/deletes notes scoped
 * to exactly one object (journey stage, milestone, task, …) via
 * GET/POST/DELETE /api/ventures/[id]/notes?scope_type=&scope_id=.
 * Supports text + link/file attachments.
 */

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

// A refusal (no permission, missing object) arrives as a payload with
// `success: false` rather than as a failed request, so it is shaped to null:
// the panel can then tell a refusal apart from a genuinely empty list instead
// of showing "no notes yet" for both.
const pickScopedNotes = (payload) =>
  payload?.success ? { notes: payload.notes || [], canPost: Boolean(payload.can_post) } : null;

export default function ScopedNotes({ ventureId, scopeType, scopeId }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [confirmNote, setConfirmNote] = useState(null);
  const [form, setForm] = useState({ title: "", body: "", url: "", urlName: "" });
  // The create and delete actions report their own failures; they are not part
  // of the read, so they are kept apart from it.
  const [actionError, setActionError] = useState(null);

  // The notes are asked for only once the panel is opened, so the address is
  // absent while it is closed. That is also what tells the hook there is
  // nothing to read yet, rather than a failed read of an empty list.
  const { data, loading, refresh: refreshNotes } = useApi(
    open && ventureId
      ? `/api/ventures/${ventureId}/notes?scope_type=${encodeURIComponent(scopeType)}&scope_id=${encodeURIComponent(scopeId)}`
      : null,
    { defaultValue: null, transform: pickScopedNotes, deps: [open, ventureId, scopeType, scopeId] },
  );

  const notes = data?.notes || [];
  const canPost = Boolean(data?.canPost);
  // Nothing to show and nothing in flight means the read failed, whether the
  // request never answered or the server refused it — the shaper turned a
  // refusal into null. Both report the same label.
  const error =
    open && !data && !loading ? t("venture.manager.notes.loadFailed") : null;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);
    setActionError(null);
    try {
      const attachments =
        form.url.trim() || form.urlName.trim()
          ? [{ name: form.urlName.trim() || form.url.trim(), url: form.url.trim() }]
          : [];
      const res = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          scope_ref_type: scopeType,
          scope_ref_id: scopeId,
          attachments,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        setForm({ title: "", body: "", url: "", urlName: "" });
        await refreshNotes();
      } else {
        setActionError(payload.error || t("venture.manager.notes.postFailed"));
      }
    } catch {
      setActionError(t("venture.manager.notes.postFailed"));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (note) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: note.id }),
      });
      const payload = await res.json();
      if (payload.success) {
        setConfirmNote(null);
        await refreshNotes();
      } else {
        setActionError(payload.error || t("venture.manager.notes.deleteFailed"));
      }
    } catch {
      setActionError(t("venture.manager.notes.deleteFailed"));
    }
  };

  const parseAttachments = (note) => {
    if (Array.isArray(note.attachments)) return note.attachments;
    if (note.attachments && typeof note.attachments === "string") {
      try {
        return JSON.parse(note.attachments);
      } catch (_) {
        return [];
      }
    }
    return [];
  };

  return (
    <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
      <button
        type="button"
        onClick={() => { setOpen(!open); setActionError(null); }}
        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[var(--brand-orange)] transition-colors"
      >
        <StickyNote className="w-3 h-3" />
        {t("venture.manager.notes.title")} ({notes.length})
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-[10px] text-slate-500 py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> {t("common.loading")}
            </div>
          ) : error || actionError ? (
            <p className="text-[10px] text-rose-400">{error || actionError}</p>
          ) : notes.length === 0 ? (
            <p className="text-[10px] text-slate-500">{t("venture.manager.notes.empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg bg-tertiary/60 border border-[var(--border-primary)] px-2.5 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[var(--text-primary)]">{note.title}</p>
                    <button onClick={() => setConfirmNote(note)} className="p-0.5 text-slate-500 hover:text-rose-400" title={t("venture.manager.notes.delete")}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[var(--text-secondary)] whitespace-pre-line mt-0.5">{note.body}</p>
                  {parseAttachments(note).length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {parseAttachments(note).map((attachment, index) => (
                        <a key={index} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-sky-400 hover:underline">
                          <Paperclip className="w-2.5 h-2.5" /> {attachment.name || attachment.url}
                          {attachment.url.startsWith("http") && <ExternalLink className="w-2 h-2" />}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mt-1">
                    {note.author_name || ""}{note.author_name && " · "}{note.created_at ? new Date(note.created_at).toLocaleString() : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {canPost && (
            <form onSubmit={submit} className="space-y-1.5">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t("venture.manager.notes.titlePlaceholder")}
                required
                className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <textarea
                rows={2}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                placeholder={t("venture.manager.notes.bodyPlaceholder")}
                required
                className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <div className="flex gap-1.5">
                <input
                  value={form.url}
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                  placeholder={t("venture.manager.notes.urlPlaceholder")}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[10px] text-[var(--text-primary)]"
                />
                <input
                  value={form.urlName}
                  onChange={(event) => setForm({ ...form, urlName: event.target.value })}
                  placeholder={t("venture.manager.notes.urlNamePlaceholder")}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[10px] text-[var(--text-primary)]"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={posting} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black disabled:opacity-50">
                  {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {t("venture.manager.notes.add")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* In-app delete confirmation — no browser dialogs. */}
      <AppModal
        isOpen={Boolean(confirmNote)}
        onClose={() => setConfirmNote(null)}
        title={t("venture.manager.notes.delete")}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{t("venture.manager.notes.deleteConfirm")}</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmNote(null)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => remove(confirmNote)}
              className="text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-rose-500 text-white"
            >
              {t("venture.manager.notes.delete")}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
