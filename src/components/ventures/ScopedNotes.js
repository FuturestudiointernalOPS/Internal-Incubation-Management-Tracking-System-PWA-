"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, StickyNote, Plus, Trash2, ExternalLink, Paperclip } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
export default function ScopedNotes({ ventureId, scopeType, scopeId }) {
  const { t } = useI18n();
  const [notes, setNotes] = useState([]);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [confirmNote, setConfirmNote] = useState(null);
  const [form, setForm] = useState({ title: "", body: "", url: "", urlName: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/notes?scope_type=${encodeURIComponent(scopeType)}&scope_id=${encodeURIComponent(scopeId)}`);
      const d = await res.json();
      if (d.success) {
        setNotes(d.notes || []);
        setCanPost(!!d.can_post);
      } else {
        setError(d.error || t("venture.manager.notes.loadFailed"));
      }
    } catch (e) {
      setError(t("venture.manager.notes.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [ventureId, scopeType, scopeId, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);
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
      const d = await res.json();
      if (d.success) {
        setForm({ title: "", body: "", url: "", urlName: "" });
        await load();
      } else {
        setError(d.error || t("venture.manager.notes.postFailed"));
      }
    } catch (err) {
      setError(t("venture.manager.notes.postFailed"));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (note) => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: note.id }),
      });
      const d = await res.json();
      if (d.success) {
        setConfirmNote(null);
        await load();
      } else {
        setError(d.error || t("venture.manager.notes.deleteFailed"));
      }
    } catch (err) {
      setError(t("venture.manager.notes.deleteFailed"));
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
        onClick={() => setOpen(!open)}
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
          ) : error ? (
            <p className="text-[10px] text-rose-400">{error}</p>
          ) : notes.length === 0 ? (
            <p className="text-[10px] text-slate-500">{t("venture.manager.notes.empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-tertiary/60 border border-[var(--border-primary)] px-2.5 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[var(--text-primary)]">{n.title}</p>
                    <button onClick={() => setConfirmNote(n)} className="p-0.5 text-slate-500 hover:text-rose-400" title={t("venture.manager.notes.delete")}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[var(--text-secondary)] whitespace-pre-line mt-0.5">{n.body}</p>
                  {parseAttachments(n).length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {parseAttachments(n).map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-sky-400 hover:underline">
                          <Paperclip className="w-2.5 h-2.5" /> {a.name || a.url}
                          {a.url.startsWith("http") && <ExternalLink className="w-2 h-2" />}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mt-1">
                    {n.author_name || ""}{n.author_name && " · "}{n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {canPost && (
            <form onSubmit={submit} className="space-y-1.5">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("venture.manager.notes.titlePlaceholder")}
                required
                className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <textarea
                rows={2}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder={t("venture.manager.notes.bodyPlaceholder")}
                required
                className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <div className="flex gap-1.5">
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder={t("venture.manager.notes.urlPlaceholder")}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[10px] text-[var(--text-primary)]"
                />
                <input
                  value={form.urlName}
                  onChange={(e) => setForm({ ...form, urlName: e.target.value })}
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
