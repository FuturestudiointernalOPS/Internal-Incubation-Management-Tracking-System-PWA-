"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Shield, Eye, EyeOff, CheckCircle, AlertCircle,
  ArrowRight, Loader2
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SetupPasswordPage({ params }) {
  const { t } = useI18n();
  const resolvedParams = React.use(params);
  const token = resolvedParams.token;

  const router = useRouter();
  const [state, setState] = useState("loading"); // loading | valid | expired | success
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`/api/auth/setup-password/validate?token=${token}`);
        const data = await res.json();

        if (data.valid) {
          setState("valid");
          setUserName(data.user.name);
          setUserEmail(data.user.email);
        } else {
          setState("expired");
        }
      } catch (err) {
        setState("expired");
        setError(t("rootMisc.setupPassword.errorValidateFailed"));
      }
    };
    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 4) {
      setError(t("rootMisc.setupPassword.errorPasswordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("rootMisc.setupPassword.errorPasswordsMismatch"));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (data.success) {
        setState("success");
        setTimeout(() => {
          router.push("/login");
        }, 2500);
      } else {
        setError(t((data.error || t("rootMisc.setupPassword.errorSetFailed")) || "") || (data.error || t("rootMisc.setupPassword.errorSetFailed")));
        setSubmitting(false);
      }
    } catch (err) {
      setError(t("rootMisc.setupPassword.errorNetwork"));
      setSubmitting(false);
    }
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[var(--brand-orange)] animate-spin" />
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
            {t("rootMisc.setupPassword.verifying")}
          </p>
        </div>
      </div>
    );
  }

  // Expired/invalid state
  if (state === "expired") {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-[var(--text-primary)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] card p-10 text-center space-y-6 border-rose-500/20"
        >
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight">
            {t("rootMisc.setupPassword.expiredTitle")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("rootMisc.setupPassword.expiredMessage")}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {t("rootMisc.setupPassword.expiredContactAdmin")}
          </p>
          <button
            onClick={() => router.push("/login")}
            className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs mt-4"
          >
            {t("rootMisc.setupPassword.returnToLogin")}
          </button>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (state === "success") {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-[var(--text-primary)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[420px] card p-10 text-center space-y-6 border-emerald-500/20"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight">
            {t("rootMisc.setupPassword.successTitle")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("rootMisc.setupPassword.successMessage")}
          </p>
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mx-auto" />
        </motion.div>
      </div>
    );
  }

  // Valid - show form
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-[var(--text-primary)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] space-y-8"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <img
            src="/brand/logo_full.png"
            alt="Future Studio"
            className="h-16 object-contain"
          />
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center border border-[var(--brand-orange)]/20">
            <Shield className="w-7 h-7 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">
              {t("rootMisc.setupPassword.setYourPassword")}
            </h1>
            {userName && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {t("rootMisc.setupPassword.welcome")}{" "}
                <span className="font-bold text-[var(--text-primary)]">{userName}</span>
              </p>
            )}
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 uppercase tracking-wider">
              {userEmail}
            </p>
          </div>
        </div>

        <div className="card shadow-2xl border-[var(--border-primary)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span className="text-[11px] font-bold text-rose-500 uppercase">
                  {error}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
                {t("rootMisc.setupPassword.createPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("rootMisc.setupPassword.passwordPlaceholder")}
                  minLength={4}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-3 px-4 text-sm font-medium outline-none focus:border-[var(--brand-orange)] transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
                {t("rootMisc.setupPassword.confirmPasswordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("rootMisc.setupPassword.confirmPasswordPlaceholder")}
                  minLength={4}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-3 px-4 text-sm font-medium outline-none focus:border-[var(--brand-orange)] transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("rootMisc.setupPassword.settingPassword")}
                </>
              ) : (
                <>
                  {t("rootMisc.setupPassword.submitButton")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40">
          {t("rootMisc.setupPassword.secureLinkNote")}
        </p>
      </motion.div>
    </div>
  );
}
