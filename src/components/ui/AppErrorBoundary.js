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

  componentDidCatch(error, errorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error, errorInfo);
    // Optionally log to your error reporting service
    if (typeof this.props.onError === "function") {
      this.props.onError(error, errorInfo);
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
