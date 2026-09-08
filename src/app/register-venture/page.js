"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";

function RegisterVentureContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    industry: "",
    founder_name: "",
    founder_email: "",
    founder_password: "",
    founder_password_confirm: "",
  });

  useEffect(() => {
    if (!token) {
      // The legacy public Venture registration flow is retired (Phase 1).
      // The official Venture intake form is reached through its run URL.
      setValidating(false);
      setError(t("rootMisc.registerVenture.retiredMessage"));
      return;
    }
    fetch(`/api/venture-invites/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (d.success) {
          setTokenValid(true);
        } else {
          setError(t((d.error || t("rootMisc.registerVenture.invalidInvitationLink")) || "") || (d.error || t("rootMisc.registerVenture.invalidInvitationLink")));
        }
      })
      .catch(() => setError(t("rootMisc.registerVenture.unableToValidateLink")))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.founder_password.length < 6) {
      setError(t("rootMisc.registerVenture.passwordTooShort"));
      return;
    }
    if (form.founder_password !== form.founder_password_confirm) {
      setError(t("rootMisc.registerVenture.passwordsMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/venture-invites/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form, founder_password_confirm: undefined }),
      });
      const d = await res.json();
      if (d.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("rootMisc.registerVenture.createdSuccess"),
              duration: 5000,
            },
          })
        );
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setError(t((d.error || t("rootMisc.registerVenture.createFailed")) || "") || (d.error || t("rootMisc.registerVenture.createFailed")));
        setSubmitting(false);
      }
    } catch (err) {
      setError(t("rootMisc.registerVenture.networkError"));
      setSubmitting(false);
    }
  }

  const inputStyle = {
    backgroundColor: "rgb(15 23 42 / 0.6)",
    borderColor: "rgb(255 255 255 / 0.15)",
    color: "var(--text-primary)",
  };

  return (
    <>
      <GlobalToast />
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#020617", color: "var(--text-primary)" }}>
      <div className="w-full max-w-lg rounded-2xl p-8 border shadow-xl" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)" }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t("rootMisc.registerVenture.createTitle")}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {t("rootMisc.registerVenture.invitedDescription")}
          </p>
        </div>

        {validating ? (
          <p className="text-center text-sm py-8" style={{ color: "var(--text-secondary)" }}>{t("rootMisc.registerVenture.validating")}</p>
        ) : error && !tokenValid ? (
          <div className="text-center py-8">
            <p className="text-sm mb-4" style={{ color: "#ef4444" }}>{error}</p>
            <a href="/login" className="text-sm underline" style={{ color: "var(--brand-orange)" }}>{t("rootMisc.registerVenture.goToLogin")}</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!token && (
              <div className="text-xs px-4 py-3 rounded-lg border" style={{ borderColor: "rgb(255 255 255 / 0.15)", color: "var(--text-secondary)" }}>
                {t("rootMisc.registerVenture.publicFormNoteStart")}{" "}
                <b>?token=YOUR_TOKEN</b>{" "}
                {t("rootMisc.registerVenture.publicFormNoteEnd")}
              </div>
            )}
            {error && token && !tokenValid && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
            <div>
              <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.ventureName")}</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("rootMisc.registerVenture.ventureNamePlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.description")}</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.industry")}</label>
              <input required value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("rootMisc.registerVenture.industryPlaceholder")} />
            </div>
            <div className="border-t pt-4" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
              <p className="text-sm font-medium mb-3">{t("rootMisc.registerVenture.founderInformation")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.fullName")}</label>
                  <input required value={form.founder_name} onChange={(e) => setForm({ ...form, founder_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.email")}</label>
                  <input required type="email" value={form.founder_email} onChange={(e) => setForm({ ...form, founder_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.password")}</label>
                  <input required type="password" minLength={6} value={form.founder_password} onChange={(e) => setForm({ ...form, founder_password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("rootMisc.registerVenture.passwordMinHint")} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("rootMisc.registerVenture.confirmPassword")}</label>
                  <input required type="password" minLength={6} value={form.founder_password_confirm} onChange={(e) => setForm({ ...form, founder_password_confirm: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
              </div>
            </div>
            {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-orange)" }}>
              {submitting ? t("rootMisc.registerVenture.creating") : t("rootMisc.registerVenture.createVentureButton")}
            </button>
          </form>
        )}
      </div>
      </div>
    </>
  );
}

export default function RegisterVenturePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#020617", color: "white" }}>{t("rootMisc.registerVenture.loading")}</div>}>
      <RegisterVentureContent />
    </Suspense>
  );
}
