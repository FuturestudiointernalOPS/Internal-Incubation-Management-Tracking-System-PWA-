"use client";

import { useState } from "react";
import { Loader2, Share2, Trash2, X } from "lucide-react";
import { dataRoomCategory } from "@/lib/dataRoom";
import { Overlay, Field } from "./DataRoomUploadModal";
import { documentTitle, formatDate } from "./dataRoomUi";

/**
 * Investor access for ONE document (or its whole category).
 *
 * The dialog makes the default posture visible: nothing is shared until it is
 * listed here, and revoking a grant takes effect on the next read. Only an
 * investor PROFILE can be granted — the API refuses an arbitrary email.
 */
export default function DataRoomAccessModal({
  documentEntry,
  grants = [],
  ventureId,
  t,
  onClose,
  onDone,
}) {
  const category = dataRoomCategory(documentEntry?.category);
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState("document");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const message = (value) => (String(value || "").startsWith("dataRoom.") ? t(value) : value);
  const live = grants.filter(
    (grantEntry) =>
      !grantEntry.revoked_at &&
      (String(grantEntry.document_id || "") === String(documentEntry?.id || "") ||
        (!grantEntry.document_id && grantEntry.category && grantEntry.category === documentEntry?.category)),
  );

  const grant = async (event) => {
    event.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setBusy("grant");
    try {
      const response = await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant",
          email: email.trim(),
          document_id: scope === "document" ? documentEntry.id : null,
          category: scope === "category" ? documentEntry.category : null,
          expires_in_days: expiresInDays || null,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(message(data.error));
      setEmail("");
      setExpiresInDays("");
      onDone?.();
    } catch (caughtError) {
      setError(caughtError?.message || t("dataRoom.errors.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (grantId) => {
    setError(null);
    setBusy(`revoke-${grantId}`);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_grant", grant_id: grantId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(message(data.error));
      onDone?.();
    } catch (caughtError) {
      setError(caughtError?.message || t("dataRoom.errors.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Overlay onClose={onClose} label={t("dataRoom.accessModal.title")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
            <Share2 size={15} className="text-[var(--brand-orange)]" /> {t("dataRoom.accessModal.title")}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">
            <X size={16} />
          </button>
        </div>

        <p className="text-[10px] text-[var(--text-secondary)]">{t("dataRoom.accessModal.description")}</p>
        <p className="text-[10px] text-[var(--text-primary)] font-bold break-words">{documentTitle(documentEntry)}</p>

        <form onSubmit={grant} className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-surface-2 p-3">
          <Field label={t("dataRoom.fields.email")}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("dataRoom.fields.scope")}>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
              >
                <option value="document">{t("dataRoom.fields.thisDocument")}</option>
                <option value="category">
                  {t("dataRoom.fields.wholeCategory")}{category ? ` — ${t(category.labelKey)}` : ""}
                </option>
              </select>
            </Field>
            <Field label={t("dataRoom.fields.expiresInDays")}>
              <input
                type="number"
                min="1"
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none"
              />
            </Field>
          </div>
          {error ? <p className="text-[10px] text-rose-400 break-words">{error}</p> : null}
          <button
            type="submit"
            disabled={busy === "grant" || !email.trim()}
            className="w-full py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {busy === "grant" ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
            {t("dataRoom.accessModal.grant")}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("dataRoom.accessModal.grantedTo")}
          </p>
          {live.length === 0 ? (
            <p className="text-[10px] text-[var(--text-secondary)]">{t("dataRoom.accessModal.noGrants")}</p>
          ) : (
            live.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-primary)] bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                    {entry.grantee_name || entry.grantee_email || entry.grantee_cid}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] truncate">
                    {entry.document_id
                      ? entry.document_title || t("dataRoom.fields.thisDocument")
                      : entry.category
                        ? `${t("dataRoom.fields.wholeCategory")}${dataRoomCategory(entry.category) ? ` — ${t(dataRoomCategory(entry.category).labelKey)}` : ""}`
                        : ""}
                    {" · "}
                    {entry.expires_at
                      ? t("dataRoom.accessModal.expiresAt", { date: formatDate(entry.expires_at) })
                      : t("dataRoom.accessModal.noExpiry")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(entry.id)}
                  disabled={busy === `revoke-${entry.id}`}
                  title={t("dataRoom.accessModal.revoke")}
                  className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 shrink-0"
                >
                  {busy === `revoke-${entry.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Overlay>
  );
}
