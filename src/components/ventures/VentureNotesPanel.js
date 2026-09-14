"use client";

import React, { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2, X, Loader2, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";

/**
 * VentureNotesPanel — internal (staff-only) Venture notes.
 * Used in the staff Venture workspace and the Super Admin console.
 *
 * Vinance 3 rule: internal notes belong to a milestone and never exist outside
 * one, so this surface always files the note against a chosen milestone (the
 * Journey panel writes milestone-scoped notes too). Visibility/create/delete
 * are enforced server-side; this component only reflects what the server allows.
 */
export default function VentureNotesPanel({ ventureId }) {
  const { t } = useI18n();
  const [notes, setNotes] = useState([]);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", milestone_id: "" });
  const [saving, setSaving] = useState(false);
  const [openNote, setOpenNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  // Milestone choices — the only place an internal note may live.
  const [milestones, setMilestones] = useState([]);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/notes`);
      const d = await res.json();
      if (d.success) {
        setNotes(d.notes || []);
        setCanPost(!!d.can_post);
      }
    } catch (e) {
      console.error("Failed to load internal notes:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMilestones = async () => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey`);
      const d = await res.json();
      if (d.success) {
        const flat = [];
        for (const stage of d.stages || []) {
          for (const ms of stage.milestones || []) {
            flat.push({ id: String(ms.id), title: ms.title || "", stage: stage.name || "" });
          }
        }
        setMilestones(flat);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (ventureId) {
      load();
      loadMilestones();
    }
  }, [ventureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.milestone_id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          scope_ref_type: "milestone",
          scope_ref_id: form.milestone_id,
        }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.notesPanel.saved"));
        setShowComposer(false);
        setForm({ title: "", body: "", milestone_id: "" });
        await load();
      } else {
        notify(d.error || t("venture.notesPanel.saveFailed"), "error");
      }
    } catch (err) {
      notify(t("venture.notesPanel.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async () => {
    const noteId = confirmDelete?.id;
    if (!noteId) return;
    const res = await fetch(`/api/ventures/${ventureId}/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId }),
    });
    const d = await res.json();
    if (d.success) {
      notify(t("venture.notesPanel.deleted"));
      setOpenNote(null);
      setConfirmDelete(null);
      await load();
    } else {
      notify(d.error || t("venture.notesPanel.deleteFailed"), "error");
    }
  };

  const milestoneTitle = (id) => milestones.find((m) => String(m.id) === String(id))?.title || String(id || "");

  const scopeLabel = (n) => {
    if (!n.scope_ref_type && !n.scope_ref_id) return null;
    if (n.scope_ref_type === "milestone" && n.scope_ref_id) return milestoneTitle(n.scope_ref_id);
    return `${n.scope_ref_type || "scope"} · ${n.scope_ref_id || ""}`;
  };

  return (
    <div className="card">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-xl text-sm text-white shadow-lg ${toast.type === "error" ? "bg-rose-500" : "bg-emerald-500"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <StickyNote className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("venture.notesPanel.title", { n: notes.length })}
        </h3>
        {canPost && (
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
          >
            {showComposer ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showComposer ? t("common.cancel") : t("venture.notesPanel.newNote")}
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mb-3 -mt-1">{t("venture.notesPanel.hint")}</p>

      {showComposer && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("venture.notesPanel.titlePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={4}
            placeholder={t("venture.notesPanel.bodyPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t("venture.notesPanel.milestoneLabel")}</label>
            {milestones.length === 0 ? (
              <p className="text-[11px] text-amber-400">{t("venture.notesPanel.noMilestones")}</p>
            ) : (
              <select
                value={form.milestone_id}
                onChange={(e) => setForm({ ...form, milestone_id: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
              >
                <option value="">{t("venture.notesPanel.milestonePlaceholder")}</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>{m.stage ? `${m.stage} — ${m.title}` : m.title}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || milestones.length === 0} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.notesPanel.save")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-slate-500">{t("venture.notesPanel.empty")}</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => setOpenNote(n)}
              className="w-full text-left p-3 rounded-lg border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/40 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{n.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {scopeLabel(n) && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 truncate max-w-[160px]">{scopeLabel(n)}</span>
                  )}
                  <span className="text-[9px] text-slate-400">
                    {n.author_name || n.author_cid || "Staff"} · {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 whitespace-pre-line">{n.body}</p>
            </button>
          ))}
        </div>
      )}

      {/* Reader modal */}
      {openNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setOpenNote(null)}>
          <div className="rounded-2xl w-full max-w-lg border shadow-xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: "var(--surface-1)", borderColor: "var(--border-primary)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border-primary)" }}>
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[var(--brand-orange)]" />
                <h2 className="text-sm font-black text-[var(--text-primary)]">{openNote.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(openNote)}
                  className="text-xs px-2 py-1 rounded flex items-center gap-1 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10"
                  title={t("venture.notesPanel.delete")}
                >
                  <Trash2 className="w-3 h-3" /> {t("venture.notesPanel.delete")}
                </button>
                <button onClick={() => setOpenNote(null)} style={{ color: "var(--text-secondary)" }}><X size={18} /></button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-[10px] text-slate-400 mb-3">
                {openNote.author_name || openNote.author_cid || "Staff"}
                {openNote.created_at ? ` · ${new Date(openNote.created_at).toLocaleString()}` : ""}
                {scopeLabel(openNote) ? ` · ${scopeLabel(openNote)}` : ""}
              </p>
              <p className="text-sm whitespace-pre-line text-[var(--text-primary)]" style={{ lineHeight: 1.6 }}>{openNote.body}</p>
            </div>
          </div>
        </div>
      )}

      {/* In-app confirmation — no browser dialogs. */}
      <AppModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={t("venture.notesPanel.delete")}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{t("venture.notesPanel.deleteConfirm")}</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={removeNote}
              className="text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-rose-500 text-white"
            >
              {t("venture.notesPanel.delete")}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
