"use client";

/**
 * The comments thread shown under one task, with its inline composer.
 *
 * `TaskRow` decides when it is mounted (`openComments === task.id`).
 */
export default function TaskRowComments({
  task,
  isSub,
  readOnly,
  loadingComments,
  commentsByTask,
  newComment,
  setNewComment,
  postComment,
  postingComment,
}) {
  return (
        <div
          className={`mt-1 p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] flex flex-col gap-2 ${isSub ? "ml-10" : "ml-8"} max-w-md`}
        >
          {loadingComments ? (
            <p className="text-[10px] font-medium text-slate-500">Loading...</p>
          ) : (commentsByTask[task.id] || []).length === 0 ? (
            <p className="text-[10px] font-medium text-slate-500">
              No comments yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {(commentsByTask[task.id] || []).map((comment) => (
                <div key={comment.id} className="text-[10px]">
                  <span className="font-black text-[var(--text-primary)]">
                    {comment.sender_name || comment.sender_id}:{" "}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {comment.body}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") postComment(task.id);
                }}
                placeholder="Write a comment..."
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] outline-none"
              />
              <button
                onClick={() => postComment(task.id)}
                disabled={!newComment.trim() || postingComment}
                className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[10px] font-bold uppercase disabled:opacity-40"
              >
                Send
              </button>
            </div>
          )}
        </div>
  );
}
