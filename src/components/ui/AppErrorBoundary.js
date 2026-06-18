"use client";

import { Component } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

/**
 * AppErrorBoundary — Catches render errors and shows a recovery UI
 *
 * Wrap around route segments to prevent total white-screen crashes.
 *
 * @example
 *   <AppErrorBoundary>
 *     <AdminDashboard />
 *   </AppErrorBoundary>
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    if (typeof window !== "undefined") {
      this.handleGlobalError = (event) => {
        const msg = event?.message || event?.reason?.message || "";
        if (
          msg.includes("ChunkLoadError") ||
          msg.includes("is not a function") ||
          msg.includes("Unexpected token '<'")
        ) {
          const hasReloaded = sessionStorage.getItem("app_chunk_reloaded");
          if (!hasReloaded) {
            sessionStorage.setItem("app_chunk_reloaded", "true");
            window.location.reload(true);
          }
        }
      };

      window.addEventListener("error", this.handleGlobalError);
      window.addEventListener("unhandledrejection", this.handleGlobalError);
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined" && this.handleGlobalError) {
      window.removeEventListener("error", this.handleGlobalError);
      window.removeEventListener("unhandledrejection", this.handleGlobalError);
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error, errorInfo);

    // Auto-reload for known PWA chunking / minification mismatch errors
    if (
      error?.name === "ChunkLoadError" ||
      (error?.message && error.message.includes("is not a function")) ||
      (error?.message && error.message.includes("Unexpected token '<'"))
    ) {
      if (typeof window !== "undefined") {
        const hasReloaded = sessionStorage.getItem("app_chunk_reloaded");
        if (!hasReloaded) {
          sessionStorage.setItem("app_chunk_reloaded", "true");
          window.location.reload(true);
          return;
        }
      }
    }

    // Report error to the API
    this.reportError(error, errorInfo);

    // Optionally call custom onError handler
    if (typeof this.props.onError === "function") {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reports the error to /api/errors for server-side logging.
   */
  reportError(error, errorInfo) {
    try {
      const payload = {
        message: error?.message || "Unknown render error",
        stack: error?.stack || null,
        url: typeof window !== "undefined" ? window.location.href : null,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        severity: "error",
        method: "GET",
        endpoint:
          typeof window !== "undefined" ? window.location.pathname : null,
      };

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/errors", JSON.stringify(payload));
      } else {
        fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    } catch (_) {
      // Fail silently — we don't want to loop on reporting errors
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback
      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback({
              error: this.state.error,
              retry: this.handleRetry,
              goBack: this.handleGoBack,
            })
          : this.props.fallback;
      }

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
            This section encountered an unexpected error.
            {this.state.error?.message && (
              <>
                <br />
                <span
                  className="text-[9px] font-mono mt-1 block opacity-60"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {this.state.error.message}
                </span>
              </>
            )}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleGoBack}
              className="btn btn-secondary flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </button>
            <button
              onClick={this.handleRetry}
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

    return this.props.children;
  }
}
