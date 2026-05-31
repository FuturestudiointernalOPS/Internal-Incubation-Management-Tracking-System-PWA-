"use client";

import React, { useEffect, useState } from "react";
import { Shield, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * IMPACTOS TERMINAL — Redirect to unified /login
 *
 * The terminal was previously required for staff/admin authentication.
 * All user types now authenticate through /login.
 * This page redirects with a brief message.
 */

export default function TerminalRedirectPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans bg-primary">
      <div className="w-full max-w-md text-center space-y-8 animate-in">
        <div className="w-16 h-16 mx-auto bg-[var(--brand-orange)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--brand-orange)]/20">
          <Shield className="w-8 h-8 text-white" />
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] uppercase">
            Terminal Unification
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            The Future Studio platform now uses a single unified login
            experience. All users authenticate through the main login page.
          </p>
          <p className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.3em]">
            Redirecting in {countdown} seconds...
          </p>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          Continue to Login <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
