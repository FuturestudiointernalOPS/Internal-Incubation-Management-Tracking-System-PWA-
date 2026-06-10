"use client";

import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

/**
 * ErrorPage — Next.js error.js compatible fallback
 *
 * Receives `error` and `reset` from Next.js's error boundary convention.
 * Can be imported by any route segment's error.js.
 *
 * @param {{ error: Error, reset: () => void }} props
 */
export default function ErrorPage({ error, reset }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[400px] p-12 text-center"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
        style={{ background: "rgba(239,68,68,0.1)" }}
      >
        <AlertTriangle
          className="w-8 h-8"
          style={{ color: "var(--chart-danger)" }}
        />
      </div>

      <h2
        className="text-lg font-bold uppercase tracking-tight mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        Something went wrong
      </h2>

      <p
        className="text-[10px] max-w-md mb-8 leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        This page encountered an unexpected error. Please try again or go back.
        {error?.message && (
          <>
            <br />
            <span
              className="text-[9px] font-mono mt-2 block opacity-60"
              style={{ color: "var(--text-tertiary)" }}
            >
              {error.message}
            </span>
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="btn btn-secondary flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Go Back
        </button>
        <button
          onClick={reset}
          className="btn btn-primary flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "var(--brand-orange)",
            color: "#fff",
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    </div>
  );
}
