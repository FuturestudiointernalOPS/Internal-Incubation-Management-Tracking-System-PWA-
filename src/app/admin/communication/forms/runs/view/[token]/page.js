"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { Eye } from "lucide-react";

export default function RunViewPage({ params }) {
  const token = params.token;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleVerify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/platform/runs/view?token=" + token + "&email=" + encodeURIComponent(email));
      const json = await response.json();
      if (json.success) { setData(json); }
      else { setError(json.error || "Access denied."); }
    } catch (_) { setError("Failed to load. Please try again."); }
    finally { setLoading(false); }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1a1d27] rounded-2xl border border-white/10 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-wider">View Responses</h1>
              <p className="text-[10px] font-medium text-white/40">Read-only access</p>
            </div>
          </div>
          <p className="text-sm text-white/60">Enter the email address you were invited with to view the responses.</p>
          <form onSubmit={handleVerify} className="space-y-4">
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/60" />
            {error && <p className="text-[11px] font-bold text-rose-400 text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 bg-orange-500 text-black text-sm font-bold uppercase tracking-wide rounded-xl hover:brightness-110 disabled:opacity-40 transition-all">{loading ? "Verifying..." : "View Responses"}</button>
          </form>
        </div>
      </div>
    );
  }

  const { run, submissions } = data;
  return (
    <div className="min-h-screen bg-[#0f1117] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center"><Eye className="w-5 h-5 text-orange-400" /></div>
          <div>
            <h1 className="text-lg font-black text-white">{run.name}</h1>
            <p className="text-[10px] font-medium text-white/40">{run.formName} - {submissions.length} response(s) - Read-only</p>
          </div>
        </div>
        {submissions.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">No responses yet.</div>
        ) : submissions.map((submission) => (
          <div key={submission.id} className="bg-[#1a1d27] rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-white">{submission.respondent_name || "Anonymous"}</p>
                <p className="text-[10px] font-medium text-white/40">{submission.respondent_email}</p>
              </div>
              {submission.score != null && <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase">{submission.score}</span>}
            </div>
            {submission.answers && submission.answers.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                {submission.answers.map((answer, answerIndex) => (
                  <div key={answerIndex}>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">{answer.question_text}</p>
                    <p className="text-sm text-white/80">{answer.answer_text || "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <p className="text-center text-[10px] font-medium text-white/20 pt-4">This is a read-only view. You cannot edit, delete, or export responses.</p>
      </div>
    </div>
  );
}