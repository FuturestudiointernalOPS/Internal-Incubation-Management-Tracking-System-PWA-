"use client";

import React, { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2, X, Loader2, Save } from "lucide-react";

/**
 * VentureNotesPanel — internal (staff-only) Venture notes.
 * Used in the staff Venture workspace and the Super Admin console.
 * Visibility/create/delete are enforced server-side against the Venture
 * permission matrix; this component only reflects what the server allows.
 */
export default function VentureNotesPanel({ ventureId }) {
  const [notes, setNotes] = useState([]);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", scope_ref_type: "", scope_ref_id: "" });
  const [saving, setSaving] = useState(false);
  const [openNote, setOpenNote] = useState(null);
  const [toast, setToast] = useState(null);

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

  useEffect(() => {
    if (ventureId) load();
  }, [ventureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          scope_ref_type: form.scope_ref_type || null,
          scope_ref_id: form.scope_ref_type ? form.scope_ref_id || null : null,
        }),
      });
      const d = await res.json();
      if (d.success) {
        notify("Internal note saved.");
        setShowComposer(false);
        setForm({ title: "", body: "", scope_ref_type: "", scope_ref_id: "" });
        await load();
      } else {
        notify(d.error || "Save failed.", "error");
      }
    } catch (err) {
      notify("Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (noteId) => {
    if (!window.confirm("Delete this internal note?")) return;
    const res = await fetch(`/api/ventures/${ventureId}/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId }),
    });
    const d = await res.json();
    if (d.success) {
      notify("Note deleted.");
      setOpenNote(null);
      await load();
    } else {
      notify(d.error || "Delete failed.", "error");
    }
  };

  const scopeLabel = (n) => {
    if (!n.scope_ref_type && !n.scope_ref_id) return null;
    return `${n.scope_ref_type || "scope"}${n.scope_ref_id ? ` · ${n.scope_ref_id}` : ""}`;
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
          <StickyNote className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Internal Notes ({notes.length})
        </h3>
        {canPost && (
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
          >
            {showComposer ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showComposer ? "Cancel" : "New Note"}
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mb-3 -mt-1">Staff-only guidance and memos — never visible to the Venture.</p>

      {showComposer && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={4}
            placeholder="Guidance, assessment, memo…"
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.scope_ref_type}
              onChange={(e) => setForm({ ...form, scope_ref_type: e.target.value })}
              className="px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            >
              <option value="">Scope: Venture-wide</option>
              <option value="milestone">Milestone</option>
              <option value="section">Section</option>
              <option value="workstream">Workstream</option>
              <option value="custom">Custom</option>
            </select>
            <input
              value={form.scope_ref_id}
              onChange={(e) => setForm({ ...form, scope_ref_id: e.target.value })}
              placeholder={form.scope_ref_type ? "Scope reference (ID)" : "Leave blank"}
              disabled={!form.scope_ref_type}
              className="px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)] disabled:opacity-40"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Note
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-slate-500">No internal notes yet.</p>
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
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{scopeLabel(n)}</span>
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
                  onClick={() => removeNote(openNote.id)}
                  className="text-xs px-2 py-1 rounded flex items-center gap-1 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10"
                  title="Delete note"
                >
                  <Trash2 className="w-3 h-3" /> Delete
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
    </div>
  );
}
