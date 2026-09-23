"use client";

import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
  Wrench,
  ChevronDown,
  LogIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useI18n, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { roleHomeHref } from "@/lib/platform/roles";

// Hardcoded staging test users as fallback
const FALLBACK_USERS = {
  super_admin: [{ cid: "sp", name: "Super Admin", email: "sp@staging.bj" }],
};

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

  // Staging-only impersonation
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [impersonateUsers, setImpersonateUsers] = useState({});
  const [selectedRole, setSelectedRole] = useState("");
  // The chosen user belongs to the role it was chosen under, so the pair is kept
  // together: switching role then clears the choice by derivation, instead of by
  // an effect that cleared it after the fact and cost an extra render.
  const [userChoice, setUserChoice] = useState({ role: "", cid: "" });
  const selectedUserCid = userChoice.role === selectedRole ? userChoice.cid : "";
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [impersonateError, setImpersonateError] = useState("");
  const [impersonateDebug, setImpersonateDebug] = useState("");
  const isStaging =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_ALLOW_IMPERSONATION === "true";

  // Fetch available users when dev tools are opened
  useEffect(() => {
    if (!devToolsOpen || !isStaging) return;
    async function fetchUsers() {
      setImpersonateDebug("Fetching users...");
      try {
        const response = await fetch("/api/auth/impersonate");
        setImpersonateDebug("API responded: " + response.status);
        const data = await response.json();
        if (data.success && Object.keys(data.users || {}).length > 0) {
          setImpersonateUsers(data.users);
          setImpersonateDebug("Loaded " + Object.keys(data.users).length + " roles from API");
        } else {
          // Fallback to hardcoded users
          setImpersonateDebug("API returned empty — using fallback users");
          setImpersonateUsers(FALLBACK_USERS);
        }
      } catch (error) {
        setImpersonateDebug("Fetch failed: " + (error.message || "network error") + " — using fallback");
        setImpersonateUsers(FALLBACK_USERS);
      }
    }
    fetchUsers();
  }, [devToolsOpen, isStaging]);

  const handleImpersonate = async () => {
    if (!selectedUserCid) return;
    setImpersonateLoading(true);
    setImpersonateError("");
    try {
      const selectedUsers = impersonateUsers[selectedRole] || [];
      const selectedUser = selectedUsers.find((user) => user.cid === selectedUserCid);
      const userEmail = selectedUser ? selectedUser.email : selectedUserCid;

      // Use the passwordless staging impersonation endpoint instead of a
      // hardcoded password login. This works for any existing contact and
      // removes the "Invalid credentials" failure caused by password drift.
      const response = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: selectedUserCid, email: userEmail }),
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        // The destination comes with the identity: the server decided it from
        // the relationships it read at sign-in. The local map stays as the
        // fallback, so a response without it behaves exactly as before.
        var role = data.user.role;
        var target = data.user.home || roleHomeHref(role) || "/workspaces";
        // Client-side navigation: the destination section layout re-reads the
        // localStorage user + session cookie and mounts the shell itself.
        router.replace(target);
      } else {
        setImpersonateError(
          t(data.error || "Impersonation failed.") || data.error || "Impersonation failed.",
        );
        setImpersonateLoading(false);
      }
    } catch {
      setImpersonateError("Network error.");
      setImpersonateLoading(false);
    }
  };

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

        {/* Staging-Only Impersonation */}
        {isStaging && (
          <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDevToolsOpen(!devToolsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-500/10 transition-all"
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500" />
                <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest">
                  Impersonation (Staging Only)
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-amber-500 transition-transform ${devToolsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {devToolsOpen && (
              <div className="px-4 pb-4 space-y-3 animate-in">
                <div className="border-t border-amber-500/20 pt-3">
                  <p className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wide mb-2">
                    Login as any user without password
                  </p>

                  {/* Debug info */}
                  {impersonateDebug && (
                    <div className="mb-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] font-bold text-amber-500/80 uppercase">{impersonateDebug}</p>
                    </div>
                  )}

                  {/* Role selector */}
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">
                    Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value)}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-2 px-3 text-xs font-medium outline-none focus:border-amber-500 transition-all mb-2"
                  >
                    <option value="">-- Select role --</option>
                    {Object.keys(impersonateUsers).map((role) => (
                      <option key={role} value={role}>
                        {role.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ))}
                  </select>

                  {/* User selector */}
                  {selectedRole && impersonateUsers[selectedRole] && (
                    <>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">
                        User
                      </label>
                      <select
                        value={selectedUserCid}
                        onChange={(event) => setUserChoice({ role: selectedRole, cid: event.target.value })}
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-2 px-3 text-xs font-medium outline-none focus:border-amber-500 transition-all mb-2"
                      >
                        <option value="">-- Select user --</option>
                        {impersonateUsers[selectedRole].map((user) => (
                          <option key={user.cid} value={user.cid}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {/* Error */}
                  {impersonateError && (
                    <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 mb-2">
                      <AlertCircle className="w-3 h-3 text-rose-500" />
                      <span className="text-[10px] font-bold uppercase text-rose-500">
                        {impersonateError}
                      </span>
                    </div>
                  )}

                  {/* Login button */}
                  <button
                    type="button"
                    disabled={!selectedUserCid || impersonateLoading}
                    onClick={handleImpersonate}
                    className="w-full py-2.5 bg-amber-500 text-black rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {impersonateLoading ? "Logging in..." : "Login as Selected User"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mb-4">
          <Globe className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          {SUPPORTED_LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => switchLang(language.code)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${
                lang === language.code
                  ? "bg-[var(--brand-orange)]/20 text-[var(--brand-orange)] border border-[var(--brand-orange)]/30"
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
