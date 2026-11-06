"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import AppButton from "@/components/ui/AppButton";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

const EMPTY = [];
const pickMessages = (payload) => payload?.success && Array.isArray(payload.messages)
  ? payload.messages
  : EMPTY;

export default function WorkspaceConversation({ workspaceId }) {
  const { t, lang } = useI18n();
  const endpoint = workspaceId
    ? `/api/investor/workspace-messages?workspace_id=${encodeURIComponent(workspaceId)}`
    : null;
  const { data: messages, loading, error: loadError, status, refresh } = useApi(endpoint, {
    defaultValue: EMPTY,
    transform: pickMessages,
    fetchOptions: { cache: "no-store" },
  });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const send = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/investor/workspace-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, body: text }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "errors.somethingWrong");
      setBody("");
      await refresh();
    } catch {
      setError(t("investorMisc.workspaceMessages.actionFailed"));
    } finally {
      setSending(false);
    }
  };

  if (!workspaceId) {
    return <p className="stf-small">{t("investorMisc.workspaceMessages.unavailable")}</p>;
  }

  return (
    <section className="stf space-y-4">
      <header className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorMisc.workspaceMessages.title")}</h1>
          <p className="stf-sub">{t("investorMisc.workspaceMessages.subtitle")}</p>
        </div>
      </header>

      {error && <p className="stf-small" role="alert">{error}</p>}
      {(loadError || (status != null && status >= 400)) && (
        <p className="stf-small" role="alert">{t("investorMisc.workspaceMessages.loadFailed")}</p>
      )}

      <div className="stf-card space-y-3" aria-live="polite">
        {loading && messages.length === 0 && <p className="stf-small">{t("common.loading")}</p>}
        {!loading && !loadError && !(status != null && status >= 400) && messages.length === 0 && (
          <p className="stf-small">{t("investorMisc.workspaceMessages.empty")}</p>
        )}
        {messages.map((message) => (
          <article
            className={`max-w-[85%] rounded-xl px-4 py-3 ${
              message.from_me ? "ml-auto bg-surface-2" : "mr-auto bg-surface-1"
            }`}
            key={message.id}
          >
            <div className="stf-small font-bold">
              {message.from_me
                ? t("investorMisc.workspaceMessages.you")
                : message.sender_name || t("investorMisc.workspaceMessages.otherParty")}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-primary)]">
              {message.body}
            </p>
            <time className="stf-small">
              {message.created_at
                ? new Date(message.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")
                : ""}
            </time>
          </article>
        ))}
      </div>

      <form className="stf-card space-y-3" onSubmit={send}>
        <label className="stf-small block" htmlFor="workspace-message">
          {t("investorMisc.workspaceMessages.compose")}
        </label>
        <textarea
          id="workspace-message"
          className="w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={4}
        />
        <div className="flex justify-end">
          <AppButton type="submit" variant="primary" size="sm" icon={Send}           disabled={sending || !body.trim() || Boolean(loadError) || (status != null && status >= 400)}>
            {t("investorMisc.workspaceMessages.send")}
          </AppButton>
        </div>
      </form>
    </section>
  );
}
