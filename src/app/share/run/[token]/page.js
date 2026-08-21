"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { Eye, Lock, LogOut, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function RunShareViewPage({ params }) {
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorEmail, setErrorEmail] = useState(null);
  const [data, setData] = useState(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const apiUrl = "/api/run-response-shares/resolve?token=" + encodeURIComponent(token);

        const res = await fetch(apiUrl);
        const json = await res.json();

        if (json.success) {
          setData(json);
        } else {
          if (res.status === 401 && json.requiresLogin) {
            // Not logged in — redirect to login with return URL
            window.location.href = "/login?redirect=" + encodeURIComponent(window.location.href);
            return;
          }
          if (res.status === 403) {
            setIsUnauthorized(true);
            setErrorEmail(json.loggedInEmail);
          }
          setError(json.error || "Access denied.");
        }
      } catch (_) {
        setError("Failed to load. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40 text-sm">
          <div className="w-5 h-5 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
          Verifying access...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1a1d27] rounded-2xl border border-white/10 p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-wider">Access Denied</h1>
              <p className="text-[10px] text-white/40">View Responses</p>
            </div>
          </div>

          {isUnauthorized ? (
            <div className="space-y-3">
              <p className="text-[12px] text-white/70 leading-relaxed">
                You don&apos;t have access to this resource. This link was shared with a different account.
              </p>
              {errorEmail && (
                <div className="bg-white/5 rounded-xl px-4 py-3 text-[11px] text-white/60">
                  Currently signed in as: <span className="font-bold text-white">{errorEmail}</span>
                </div>
              )}
              <p className="text-[11px] text-white/40 leading-relaxed">
                Please use the original link from your email, or sign in with the account that was granted access.
              </p>
              <a
                href="/api/auth/session-logout"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white/60 uppercase tracking-wider hover:bg-white/10 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out &amp; switch account
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] text-white/70 leading-relaxed">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { run, submissions, viewerEmail } = data;

  const statusIcon = (status) => {
    if (status === "approved") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === "rejected") return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
    return <Clock className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Minimal header — NO admin sidebar, NO navigation */}
      <header className="border-b border-white/10 bg-[#1a1d27] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Eye className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <p className="text-[11px] font-black text-white uppercase tracking-wider">{run.name}</p>
            <p className="text-[9px] text-white/30">{run.formName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
            View Only
          </span>
          <span className="text-[10px] text-white/30 hidden sm:block">{viewerEmail}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="bg-[#1a1d27] rounded-xl border border-white/10 px-4 py-3 text-center">
            <p className="text-xl font-black text-white">{submissions.length}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wider">Responses</p>
          </div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/10 px-4 py-3 text-center">
            <p className="text-xl font-black text-white capitalize">{run.status || "active"}</p>
            <p className="text-[9px] text-white/40 uppercase tracking-wider">Status</p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">No responses yet.</div>
        ) : (
          submissions.map((sub) => (
            <div key={sub.id} className="bg-[#1a1d27] rounded-2xl border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">{sub.respondent_name || "Anonymous"}</p>
                  <p className="text-[10px] text-white/40">{sub.respondent_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sub.review_status && (
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      {statusIcon(sub.review_status)}
                      {sub.review_status}
                    </span>
                  )}
                  {sub.score != null && (
                    <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-black">
                      {sub.score}
                    </span>
                  )}
                </div>
              </div>
              {sub.answers && sub.answers.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  {sub.answers.map((a, ai) => (
                    <div key={ai}>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-0.5">{a.question_text}</p>
                      <p className="text-[12px] text-white/80 leading-relaxed">{a.answer_text || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[9px] text-white/20">
                Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"}
              </p>
            </div>
          ))
        )}

        <p className="text-center text-[9px] text-white/20 pt-4">
          This is a read-only view. You cannot edit, delete, or export responses.
        </p>
      </main>
    </div>
  );
}