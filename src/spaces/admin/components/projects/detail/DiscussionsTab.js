import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function DiscussionsTab({ newDiscussion,
  onDiscussionChange,
  onPostDiscussion,
  postingDiscussion,
  discussionsLoading,
  discussions, }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Post new message */}
      <div className="card space-y-3">
        <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">
          {t("adminMisc.projectDetail.projectDiscussions")}
        </h3>
        <div className="flex gap-2">
          <textarea
            value={newDiscussion}
            onChange={(event) => onDiscussionChange(event.target.value)}
            placeholder={t("messaging.typeDiscussion")}
            rows={2}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none resize-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onPostDiscussion();
              }
            }}
          />
          <button
            onClick={onPostDiscussion}
            disabled={postingDiscussion || !newDiscussion.trim()}
            className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 flex items-center gap-2 self-end"
          >
            <Send className="w-3.5 h-3.5" />
            {postingDiscussion ? "..." : t("messaging.postDiscussion")}
          </button>
        </div>
      </div>

      {/* Messages list */}
      {discussionsLoading ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
          <RefreshCw className="w-8 h-8 animate-spin mb-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            {t("messaging.loadingDiscussions")}
          </p>
        </div>
      ) : discussions.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
          <MessageSquare className="w-12 h-12 mb-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            {t("messaging.noDiscussions")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {discussions.map((message) => (
            <div key={message.id} className="card p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">
                  {(message.sender_name || "?").charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-bold text-[var(--text-primary)]">
                  {message.sender_name || t("adminMisc.projectDetail.unknown")}
                </span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">
                  {new Date(message.created_at).toLocaleDateString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap">
                {message.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
