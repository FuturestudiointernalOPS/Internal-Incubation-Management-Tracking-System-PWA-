"use client";

import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useI18n, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { roleHomeHref } from "@/lib/platform/roles";
import { safeNextPath } from "@/lib/safeNextPath";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const { t, lang, switchLang } = useI18n();
  const router = useRouter();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/auth/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        setSuccess(true);
        setTimeout(async () => {
          // An explicit destination from the URL WINS over the habitual home
          // screen and over the profile-completion gate: this is how a payer
          // lands straight in the course they just bought.
          const requested =
            typeof window !== "undefined"
              ? safeNextPath(new URLSearchParams(window.location.search).get("next"))
              : null;
          if (requested) {
            router.replace(requested);
            return;
          }

          // Where this person belongs was decided server-side, from the
          // relationships read at sign-in — a founder whose baseline badge is
          // "member" cannot be recognised from the badge, which is exactly why
          // this used to need a second request and now does not. The shared map
          // is the fallback for a response that arrives without an answer.
          let target =
            data.user.home || roleHomeHref(data.user.role) || "/workspaces";

          // Profile completion gate: only enforce on the FIRST login. After
          // that the user is not repeatedly redirected, even if they skip it.
          if (data.user.is_first_login) {
            try {
              const profileResponse = await fetch("/api/profile");
              const profileData = await profileResponse.json();
              if (profileData.success && profileData.isComplete === false) {
                const userRole = data.user.role;
                target =
                  userRole === "super_admin" || userRole === "staff"
                    ? "/admin/profile"
                    : userRole === "program_manager"
                      ? "/pm/profile"
                      : userRole === "facilitator"
                          ? "/facilitator/profile"
                          : userRole === "participant"
                            ? "/participant/profile"
                            : userRole === "member" || userRole === "founder" || userRole === "applicant"
                              ? "/workspaces"
                              : "/participant/profile";
              }
            } catch (_) {}
          }

          router.replace(target);
        }, 800);
      } else {
        setErrorMsg(
          t((data.error || t("auth.login.error")) || "") ||
            (data.error || t("auth.login.error")),
        );
        setLoading(false);
      }
    } catch {
      setErrorMsg(t("auth.login.networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-[var(--text-primary)]">
      <div className="w-full max-w-[400px] space-y-8 animate-in">
        <div className="flex flex-col items-center text-center space-y-4">
          <Image
            src="/brand/logo_full.png"
            alt="Future Studio"
            width={1018}
            height={1024}
            className="h-20 w-auto object-contain animate-in fade-in zoom-in duration-700 mb-2"
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
                onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="........"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--brand-orange)] cursor-pointer"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  Remember Me
                </span>
              </label>
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline uppercase tracking-wide"
              >
                Forgot Password?
              </button>
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
          {SUPPORTED_LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => switchLang(language.code)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${
                lang === language.code
                  ? "bg-brand-orange/20 text-[var(--brand-orange)] border border-brand-orange/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
              }`}
            >
              {language.nativeLabel}
            </button>
          ))}
        </div>

        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-40">
            &copy; 2026 FutureStudio Operational Asset.
          </p>
        </div>
      </div>
    </div>
  );
}
