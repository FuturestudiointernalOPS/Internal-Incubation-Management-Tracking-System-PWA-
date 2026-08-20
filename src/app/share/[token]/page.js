"use client";

import React, { useState, useEffect, use } from "react";
import { Loader2, Lock, FileText, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * SHARED FORM RESPONSE — read-only, email-verified view.
 *
 * The token only selects the share. Access is granted only when the viewer is
 * authenticated with the same email the response was shared to.
 */

function renderValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export default function SharedResponsePage({ params }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams?.token;
  const { t } = useI18n();

  const [state, setState] = useState("loading"); // loading | error | ready
  const [reason, setReason] = useState("");
  const [response, setResponse] = useState(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setReason("notFound");
      return;
    }

    fetch(`/api/form-response-shares/resolve?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.authRequired) {
          // Must authenticate. Return here after login.
          window.location.assign(`/login?return_to=${encodeURIComponent(`/share/${token}`)}`);
          return;
        }
        if (data.success) {
          setResponse(data.response);
          setState("ready");
        } else {
          setState("error");
          setReason(data.reason || "notFound");
        }
      })
      .catch(() => {
        setState("error");
        setReason("notFound");
      });
  }, [token]);

  const reasonKey = {
    revoked: "sharedResponse.revoked",
    expired: "sharedResponse.expired",
    email_mismatch: "sharedResponse.emailMismatch",
    notFound: "sharedResponse.notFound",
    unavailable: "sharedResponse.accessDeniedMessage",
  }[reason] || "sharedResponse.accessDeniedMessage";

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[var(--brand-orange)] animate-spin mx-auto" />
          <p className="text-[11px] font-black uppercase text-[var(--text-secondary)]">
            {t("sharedResponse.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[var(--text-secondary)] mx-auto" />
          <h1 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">
            {t("sharedResponse.accessDenied")}
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {t(reasonKey)}
          </p>
          <a
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase"
          >
            {t("sharedResponse.signIn")}
          </a>
        </div>
      </div>
    );
  }

  const entries = response?.data && typeof response.data === "object"
    ? Object.entries(response.data)
    : [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[var(--brand-orange)]" />
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("sharedResponse.title")}
            </h1>
            <p className="text-[10px] font-bold text-[var(--text-secondary)]">
              {t("sharedResponse.readOnly")}
            </p>
          </div>
        </header>

        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3 text-[10px]">
            <div>
              <p className="text-[var(--text-secondary)] font-black uppercase">
                {t("sharedResponse.submittedBy")}
              </p>
              <p className="text-[var(--text-primary)] font-bold">
                {response?.submitter_name || "—"}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] font-black uppercase">
                {t("sharedResponse.status")}
              </p>
              <p className="text-[var(--text-primary)] font-bold">
                {response?.status || "—"}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] font-black uppercase">
                {t("sharedResponse.submittedAt")}
              </p>
              <p className="text-[var(--text-primary)] font-bold">
                {response?.submitted_at
                  ? new Date(response.submitted_at).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--border-primary)] pt-4 space-y-3">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase text-[var(--text-secondary)]">
              <FileText className="w-3.5 h-3.5" />
              {t("sharedResponse.fields")}
            </p>
            {entries.length === 0 ? (
              <p className="text-[11px] italic text-[var(--text-secondary)]">
                {t("sharedResponse.empty")}
              </p>
            ) : (
              <dl className="space-y-2">
                {entries.map(([key, value]) => (
                  <div key={key} className="grid sm:grid-cols-[180px_1fr] gap-2 text-[10px]">
                    <dt className="text-[var(--text-secondary)] font-bold break-words">
                      {key}
                    </dt>
                    <dd className="text-[var(--text-primary)] font-bold break-words whitespace-pre-wrap">
                      {renderValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
