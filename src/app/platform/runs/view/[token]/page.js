"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { Eye, CheckCircle, XCircle, Clock } from "lucide-react";

export default function RunViewPage({ params }) {
  const token = params.token;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/runs/view?token=" + token + "&email=" + encodeURIComponent(email));
      const json = await res.json();
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
              <p className="text-[10px] text-white/40">Read-only access</p>
            </div>
          </div>
          <p className="text-[11px] text-white/60">Enter the email address you were invited with to view the responses.</p>
          <form onSubmit={handleVerify} className="space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/60" />
            {error && <p className="text-[11px] font-bold text-rose-400 text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 bg-orange-500 text-black text-[11px] font-black uppercase rounded-xl hover:brightness-110 disabled:opacity-40 transition-all">{loading ? "Verifying..." : "View Responses"}</button>
          </form>
        </div>
      </div>
    );
  }

  const { run, submissions } = data;
  const statusIcons = { pending: "pending", approved: "approved", rejected: "rejected" };
  return (
    <div className="min-h-screen bg-[#0f1117] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center"><Eye className="w-5 h-5 text-orange-400" /></div>
          <div>
            <h1 className="text-lg font-black text-white">{run.name}</h1>
            <p className="text-[10px] text-white/40">{run.formName} - {submissions.length} response(s) - Read-only</p>
          </div>
        </div>
        {submissions.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">No responses yet.</div>
        ) : submissions.map((sub) => (
          <div key={sub.id} className="bg-[#1a1d27] rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">{sub.respondent_name || "Anonymous"}</p>
                <p className="text-[10px] text-white/40">{sub.respondent_email}</p>
              </div>
              {sub.score != null && <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-black">{sub.score}</span>}
            </div>
            {sub.answers && sub.answers.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                {sub.answers.map((a, ai) => (
                  <div key={ai}>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-0.5">{a.question_text}</p>
                    <p className="text-[12px] text-white/80">{a.answer_text || "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <p className="text-center text-[9px] text-white/20 pt-4">This is a read-only view. You cannot edit, delete, or export responses.</p>
      </div>
    </div>
  );
}