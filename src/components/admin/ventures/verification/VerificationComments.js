import { Loader2, MessageCircle, Send } from "lucide-react";

export default function VerificationComments({
  comments,
  comment,
  sendingComment,
  onCommentChange,
  onSend,
  t,
}) {
  return (
    <div className="card">
      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4 flex items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.verification.comments")}
      </h3>
      {comments.length === 0 && <p className="text-sm text-[var(--text-secondary)] mb-4">{t("vadmin.verification.noCommentsYet")}</p>}
      <div className="space-y-3 mb-4">
        {comments.map((comment, index) => (
          <div key={comment.id || index} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[var(--text-primary)]">{comment.author_name || comment.author_cid}</span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500">{comment.author_type}</span>
              <span className="text-[10px] text-[var(--text-secondary)] ml-auto">{new Date(comment.created_at).toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">{comment.message}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <input type="text" value={comment} onChange={(event) => onCommentChange(event.target.value)}
          placeholder={t("vadmin.verification.addCommentPlaceholder")}
          className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
        <button onClick={onSend} disabled={!comment.trim() || sendingComment}
          className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-2">
          {sendingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          {t("vadmin.verification.send")}
        </button>
      </div>
    </div>
  );
}
