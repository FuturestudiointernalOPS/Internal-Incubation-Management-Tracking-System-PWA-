"use client";

import React, { useState } from "react";
import { Loader2, StickyNote } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";

/**
 * The "Note" button of an activity block or a session row.
 *
 * A note is an internal note (staff-only; the notes API enforces it) filed on
 * the MILESTONE — the server refuses any other scope — with the thing it is
 * about (activity or session) carried in its title. Every note written here
 * therefore shows up in the Venture's Notes tab next to all the others.
 *
 * Writes: POST /api/ventures/[id]/notes
 */
export default function QuickNote({ ventureId, milestoneId, subject, className = "stf-btn sm" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [body, setBody] = useState("");

  if (!ventureId || !milestoneId) return null;

  const close = () => {
    setOpen(false);
    setError(null);
    setSaved(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${t("venture.quickNote.prefix")} · ${subject || ""}`.trim(),
          body,
          scope_ref_type: "milestone",
          scope_ref_id: String(milestoneId),
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        setBody("");
        setSaved(true);
      } else setError(payload.error || t("venture.manager.notes.postFailed"));
    } catch {
      setError(t("venture.manager.notes.postFailed"));
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <StickyNote size={13} /> {t("venture.quickNote.button")}
      </button>
      <AppModal isOpen={open} onClose={close} title={t("venture.quickNote.title")} size="md">
        <form onSubmit={submit} className="stf stf-form">
          {subject && <p className="stf-small" style={{ margin: 0 }}>{subject}</p>}
          <textarea
            className="stf-textarea"
            rows={5}
            value={body}
            onChange={(event) => { setBody(event.target.value); setSaved(false); }}
            placeholder={t("venture.manager.notes.bodyPlaceholder")}
            required
          />
          {error && <p className="stf-err" role="alert">{error}</p>}
          {saved && <p className="stf-small" role="status">{t("venture.quickNote.saved")}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="stf-btn" onClick={close}>{t("common.close")}</button>
            <button type="submit" className="stf-btn pr" disabled={posting || !body.trim()}>
              {posting && <Loader2 size={14} className="animate-spin" />} {t("common.save")}
            </button>
          </div>
        </form>
      </AppModal>
    </>
  );
}
