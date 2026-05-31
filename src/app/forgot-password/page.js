"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Mail, ArrowRight, CheckCircle, AlertCircle,
  Loader2, ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || "Failed to send reset email.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
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
            Check Your Email
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            If an account exists for <strong>{email}</strong>, we've sent a password reset link.
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            The link expires in 1 hour. Check your spam folder if you don't see it.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs mt-4"
          >
            Return to Login
          </button>
        </motion.div>
      </div>
    );
  }

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
            <Lock className="w-7 h-7 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">
              Forgot Password
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Enter your email and we'll send you a reset link.
            </p>
          </div>
        </div>

        <div className="card shadow-2xl border-[var(--border-primary)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span className="text-[11px] font-bold text-rose-500 uppercase">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@impactos.com"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-md py-3 pl-12 pr-4 text-sm font-medium outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                <>
                  Send Reset Link
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Login
        </button>
      </motion.div>
    </div>
  );
}
