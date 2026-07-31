"use client";

import { useState } from "react";
import { Lock, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SetupPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!password) return setError("Password is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/investor/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) setSuccess(true);
      else setError(data.error || "Failed to set password.");
    } catch (_) { setError("Network error."); }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-sm font-bold text-[var(--text-secondary)]">Invalid or missing setup link.</p>
          <p className="text-xs text-[var(--text-tertiary)]">Please use the link from your approval email.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase">Password Set</h1>
          <p className="text-sm text-[var(--text-secondary)]">Your password has been set. You can now log in to Investor OS.</p>
          <button onClick={() => router.push("/login")}
            className="px-6 py-3 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 mx-auto">
            Go to Login <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <h1 className="text-xl font-black text-[var(--text-primary)] uppercase">Set Your Password</h1>
          <p className="text-xs text-[var(--text-secondary)]">Your investor account has been approved. Set your password to access Investor OS.</p>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 text-center">{error}</div>}

        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full mt-1 px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
          </div>
          <div>
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full mt-1 px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-wider rounded-xl disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Set Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
