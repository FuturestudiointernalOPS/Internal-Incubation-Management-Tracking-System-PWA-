"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ActivatePage() {
  const { t } = useI18n();
  const [token, setToken] = useState(null);
  const [mode, setMode] = useState("setup"); // setup or reset
  const [tokenState, setTokenState] = useState("loading"); // loading | valid | expired | invalid
  const [userInfo, setUserInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const m = params.get("mode");

    if (!t) {
      setTokenState("invalid");
      return;
    }

    setToken(t);
    if (m === "reset") setMode("reset");

    fetch(`/api/auth/activate?token=${t}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUserInfo(data);
          setTokenState("valid");
        } else if (data.expired) {
          setTokenState("expired");
        } else {
          setTokenState("invalid");
        }
      })
      .catch(() => setTokenState("invalid"));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("rootMisc.activate.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("rootMisc.activate.passwordsMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setResult("success");
      } else {
        setError(t((data.error || t("rootMisc.activate.activationFailed")) || "") || (data.error || t("rootMisc.activate.activationFailed")));
      }
    } catch (e) {
      setError(t("rootMisc.activate.networkError"));
    }
    setSubmitting(false);
  };

  if (tokenState === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--brand-orange)] animate-spin" />
      </div>
    );
  }

  if (result === "success") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-2">
            {mode === "reset" ? t("rootMisc.activate.passwordResetTitle") : t("rootMisc.activate.accountActivatedTitle")}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6">
            {mode === "reset"
              ? t("rootMisc.activate.passwordResetSuccess")
              : t("rootMisc.activate.accountActivatedSuccess")}
          </p>
          <a
            href="/login"
            className="inline-block w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide text-center hover:brightness-110 transition-all"
          >
            {t("rootMisc.activate.goToLogin")}
          </a>
        </motion.div>
      </div>
    );
  }

  if (tokenState === "expired") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-2">{t("rootMisc.activate.linkExpired")}</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6">
            {t("rootMisc.activate.linkExpiredMessage")}
          </p>
          <a
            href="/login"
            className="inline-block w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide text-center hover:brightness-110 transition-all"
          >
            {t("rootMisc.activate.backToLogin")}
          </a>
        </div>
      </div>
    );
  }

  if (tokenState === "invalid") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-2">{t("rootMisc.activate.invalidLink")}</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6">
            {t("rootMisc.activate.invalidLinkMessage")}
          </p>
          <a
            href="/login"
            className="inline-block w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide text-center hover:brightness-110 transition-all"
          >
            {t("rootMisc.activate.backToLogin")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            <span className="text-[var(--brand-orange)]">Impact</span>OS
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-2">{t("rootMisc.activate.futureStudioPlatform")}</p>
        </div>

        <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[var(--brand-orange)]" />
            </div>
            <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
              {mode === "reset" ? t("rootMisc.activate.resetYourPassword") : t("rootMisc.activate.setYourPassword")}
            </h2>
            {userInfo && (
              <div className="space-y-1">
                <p className="text-[12px] text-[var(--text-secondary)] mt-2">
                  {t("rootMisc.activate.hi")}{" "}
                  <strong className="text-[var(--text-primary)]">{userInfo.name}</strong>
                  {userInfo.role ? ` · ${userInfo.role}` : ""}
                </p>
                <div className="mt-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                    {t("rootMisc.activate.email")}
                  </label>
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">
                    {userInfo.email}
                  </p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                {mode === "reset" ? t("rootMisc.activate.newPassword") : t("rootMisc.activate.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("rootMisc.activate.passwordMinHint")}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 pr-12 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
                {t("rootMisc.activate.confirmPassword")}
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("rootMisc.activate.repeatPasswordPlaceholder")}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[10px] font-bold text-rose-400">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !password || !confirmPassword}
              className="w-full py-3.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "reset" ? (
                t("rootMisc.activate.resetPasswordButton")
              ) : (
                t("rootMisc.activate.activateAccountButton")
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
