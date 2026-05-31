"use client";

import React, { useState } from "react";
import {
  Shield,
  Lock,
  ArrowRight,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n, SUPPORTED_LANGUAGES } from "@/lib/i18n";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const { t, lang, switchLang } = useI18n();
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("impactos_lang", data.user.language);
        // Show success state then redirect like terminal does
        setTimeout(() => {
          if (data.user.role === "super_admin") {
            router.push("/admin");
          } else if (data.user.role === "program_manager") {
            router.push("/pm");
          } else if (data.user.role === "staff") {
            router.push("/staff");
          } else if (data.user.role === "teacher") {
            router.push("/teacher");
          } else {
            router.push("/participant");
          }
        }, 800);
      } else {
        setErrorMsg(data.error || t("auth.login.error"));
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(t("auth.login.networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-[var(--text-primary)]">
      <div className="w-full max-w-[400px] space-y-8 animate-in">
        <div className="flex flex-col items-center text-center space-y-4">
          <img
            src="/brand/logo_full.png"
            alt="Future Studio"
            className="h-20 object-contain animate-in fade-in zoom-in duration-700 mb-2"
          />
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em] mt-1">
            {t("auth.login.title")}
          </p>
        </div>

        <div className="card shadow-2xl border-[var(--border-primary)]">
          <form onSubmit={handleLogin} className="space-y-6">
            {errorMsg && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="text-[11px] font-bold text-rose-500 uppercase">
                  {errorMsg}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
                {t("auth.login.email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@impactos.com"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-3 px-4 text-sm font-medium outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>

            <div className="space-y-2 relative">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
                {t("auth.login.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-3 px-4 text-sm font-medium outline-none focus:border-[var(--brand-orange)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className={`btn w-full py-4 uppercase tracking-widest text-xs ${success ? "bg-emerald-500 text-white" : "btn-primary"}`}
            >
              {success
                ? t("auth.login.success")
                : loading
                  ? t("auth.login.authenticating")
                  : t("auth.login.login")}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Globe className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLang(l.code)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${
                lang === l.code
                  ? "bg-[var(--brand-orange)]/20 text-[var(--brand-orange)] border border-[var(--brand-orange)]/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
              }`}
            >
              {l.nativeLabel}
            </button>
          ))}
        </div>

        <div className="text-center">
          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">
            &copy; 2026 FutureStudio Operational Asset.
          </p>
        </div>
      </div>
    </div>
  );
}
