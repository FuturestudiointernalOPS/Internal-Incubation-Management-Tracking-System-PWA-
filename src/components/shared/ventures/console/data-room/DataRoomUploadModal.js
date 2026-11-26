"use client";

import { useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { DATA_ROOM_CATEGORIES } from "@/lib/dataRoom";
import { documentTitle } from "./dataRoomUi";

/**
 * Upload a new document, replace a document with a newer version, or correct
 * its metadata.
 *
 * A file upload is a TWO-step call (`/upload` puts the bytes in the private
 * bucket, the action records the path). If the second step fails the first is
 * rolled back by the server where it can be; here the modal simply keeps the
 * form so the person can retry.
 */
export default function DataRoomUploadModal({
  mode = "create",
  documentEntry,
  ventureId,
  maxFileMb = 10,
  defaultCategory,
  inline = false,
  t,
  onClose,
  onDone,
}) {
  const editing = mode === "edit";
  const replacing = mode === "replace";

  const [title, setTitle] = useState(documentEntry ? documentTitle(documentEntry) : "");
  const [description, setDescription] = useState(documentEntry?.description || "");
  const [category, setCategory] = useState(documentEntry?.category || defaultCategory || DATA_ROOM_CATEGORIES[0].code);
  const [expiry, setExpiry] = useState(
    documentEntry?.expires_at ? String(documentEntry.expires_at).slice(0, 10) : "",
  );
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Local day, not UTC: a date is "past" by the clock of the person typing it.
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const originalExpiry = documentEntry?.expires_at ? String(documentEntry.expires_at).slice(0, 10) : "";

  const message = (value) => (String(value || "").startsWith("dataRoom.") ? t(value) : value);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t("dataRoom.errors.titleRequired"));
      return;
    }
    // An expiry already on file may be past (the document did expire); a NEW one may not be.
    if (expiry && expiry < today && expiry !== originalExpiry) {
      setError(t("dataRoom.errors.pastExpiry"));
      return;
    }
    if (!editing && !file && !externalUrl.trim()) {
      setError(t("dataRoom.errors.fileRequired"));
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        const response = await fetch(`/api/ventures/${ventureId}/data-room`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            document_id: documentEntry.id,
            title,
            description,
            category,
            expires_at: expiry || null,
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(message(data.error));
        onDone?.();
        onClose?.();
        return;
      }

      let filePath = null;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("category", category);
        const uploadResponse = await fetch(`/api/ventures/${ventureId}/data-room/upload`, {
          method: "POST",
          body: form,
        });
        const uploadData = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(message(uploadData.error) || t("dataRoom.errors.uploadFailed"));
        }
        filePath = uploadData.path;
      }

      const payload = {
        action: replacing ? "replace" : "create",
        document_id: replacing ? documentEntry.id : undefined,
        title,
        description,
        category,
        expires_at: expiry || null,
        change_notes: notes || null,
        file_path: filePath,
        file_name: file?.name || null,
        file_size: file?.size || null,
        file_type: file?.type || null,
        file_url: filePath ? null : externalUrl.trim() || null,
      };

      const response = await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) throw new Error(message(data.error));
      onDone?.();
      onClose?.();
    } catch (caughtError) {
      setError(caughtError?.message || t("dataRoom.errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const heading = editing
    ? t("dataRoom.editDetails")
    : replacing
      ? t("dataRoom.replaceVersion")
      : t("dataRoom.uploadDocument");

  const form = (
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={15} className="text-[var(--brand-orange)]" /> {heading}
          </h2>
          {inline ? null : (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">
              <X size={16} />
            </button>
          )}
        </div>

        {replacing ? (
          <p className="text-[10px] text-[var(--text-secondary)]">
            {documentTitle(documentEntry)} · v{documentEntry.current_version || 1}
          </p>
        ) : null}

        <Field label={t("dataRoom.fields.title")}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
          />
        </Field>

        {!replacing ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("dataRoom.fields.category")}>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
              >
                {DATA_ROOM_CATEGORIES.map((entry) => (
                  <option key={entry.code} value={entry.code}>{t(entry.labelKey)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("dataRoom.fields.expiry")}>
              <input
                type="date"
                min={today}
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
              />
            </Field>
          </div>
        ) : (
          <Field label={t("dataRoom.fields.expiry")}>
            <input
              type="date"
              min={today}
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
            />
          </Field>
        )}

        <Field label={t("dataRoom.fields.description")}>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={4000}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none resize-none"
          />
        </Field>

        {!editing ? (
          <>
            <Field label={t("dataRoom.fields.file")}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full text-[10px] text-[var(--text-secondary)] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[var(--brand-orange)] file:text-black file:text-[10px] file:font-bold file:uppercase file:tracking-wide"
              />
              <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                {t("dataRoom.uploadHint", { size: maxFileMb })}
              </p>
            </Field>

            {!replacing ? (
              <Field label={t("dataRoom.fields.externalLink")}>
                <input
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  placeholder="https://…"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
                />
              </Field>
            ) : null}

            <Field label={t("dataRoom.fields.changeNotes")}>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={4000}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
              />
            </Field>
          </>
        ) : null}

        {error ? <p className="text-[10px] text-rose-400 break-words">{error}</p> : null}

        <div className="flex gap-2 pt-1">
          {inline ? null : (
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("dataRoom.cancel")}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {t("dataRoom.save")}
          </button>
        </div>
      </form>
  );

  return inline ? (
    <InlineShell>{form}</InlineShell>
  ) : (
    <Overlay onClose={onClose} label={heading}>{form}</Overlay>
  );
}

/** The same form, laid in the page instead of over it. */
function InlineShell({ children }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-4">
      {children}
    </div>
  );
}

export function Overlay({ children, onClose, label }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={label}
    >
      <div
        className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
