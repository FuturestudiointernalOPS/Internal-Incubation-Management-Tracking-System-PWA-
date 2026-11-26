"use client";

import { X, Shield } from "lucide-react";

/**
 * The blocker modal, with its discussion thread.
 *
 * It opens on a task (`blockerModal` = { taskId, taskTitle }), raises the blocker
 * and — once there are blockers on the task — resolves them and talks about them
 * inline. It renders nothing when no task is open.
 */
export default function BlockerModal({
  blockerModal,
  onClose,
  tasks,
  blockerTitle,
  setBlockerTitle,
  blockerDescription,
  setBlockerDescription,
  blockerPriority,
  setBlockerPriority,
  blockerRefUrl,
  setBlockerRefUrl,
  blockerNotes,
  setBlockerNotes,
  blockerAdding,
  handleAddBlocker,
  handleResolveBlocker,
  readOnly,
  toggleBlockerDiscuss,
  openBlockerDiscuss,
  blockerMessages,
  newBlockerMsg,
  setNewBlockerMsg,
  postBlockerMessage,
  postingBlockerMsg,
  t,
}) {
  // Closing the modal also clears the title field, so reopening it on another
  // task never shows the previous task's half-typed blocker.
  const closeModal = () => {
    onClose();
    setBlockerTitle("");
  };

  if (!blockerModal) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-black uppercase tracking-wider text-rose-400">
              Blockers
            </span>
          </div>
          <button
            onClick={closeModal}
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <p className="text-[10px] font-bold text-[var(--text-primary)]">
          {blockerModal.taskTitle}
        </p>

        {/* Existing blockers */}
        {(() => {
          const taskBlockers =
            tasks.find((candidate) => candidate.id === blockerModal.taskId)?.blockers || [];
          const activeBlockers = taskBlockers.filter(
            (blocker) => blocker.status === "active",
          );
          const resolvedBlockers = taskBlockers.filter(
            (blocker) => blocker.status !== "active",
          );
          return (
            <>
              {activeBlockers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
                    Active ({activeBlockers.length})
                  </p>
                  {activeBlockers.map((blocker) => (
                    <div
                      key={blocker.id}
                      className="flex flex-col p-2 rounded-lg bg-rose-500/10 border border-rose-500/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-rose-400 font-bold">
                            {blocker.title}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-rose-500/60">
                            {blocker.severity || "medium"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleBlockerDiscuss(blocker.id)}
                            className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500 hover:text-white transition-all"
                          >
                            Discuss
                          </button>
                          {!readOnly && (
                            <button
                              onClick={() => handleResolveBlocker(blocker.id)}
                              className="px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500 hover:text-white transition-all"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                      {(blocker.description || blocker.reference_url || blocker.notes) && (
                        <div className="mt-1.5 pt-1.5 border-t border-rose-500/10 space-y-1">
                          {blocker.description && (
                            <p className="text-[10px] font-medium text-slate-400">
                              {blocker.description}
                            </p>
                          )}
                          {blocker.reference_url && (
                            <a
                              href={blocker.reference_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-400 underline break-all"
                            >
                              {blocker.reference_url}
                            </a>
                          )}
                          {blocker.notes && (
                            <p className="text-[10px] font-medium text-slate-500">
                              {blocker.notes}
                            </p>
                          )}
                        </div>
                      )}
                      {/* Discussion thread */}
                      {openBlockerDiscuss === blocker.id && (
                        <div className="mt-2 pt-2 border-t border-rose-500/10 space-y-1.5">
                          {(blockerMessages[blocker.id] || []).map((message) => (
                            <div key={message.id} className="text-[10px]">
                              <span className="font-black text-[var(--text-primary)]">
                                {message.sender_name || message.sender_id}:{" "}
                              </span>
                              <span className="text-[var(--text-secondary)]">
                                {message.body}
                              </span>
                            </div>
                          ))}
                          {!readOnly && (
                            <div className="flex items-center gap-1 pt-1">
                              <input
                                type="text"
                                value={newBlockerMsg}
                                onChange={(event) =>
                                  setNewBlockerMsg(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter")
                                    postBlockerMessage(blocker.id);
                                }}
                                placeholder="Reply..."
                                className="flex-1 bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] outline-none"
                              />
                              <button
                                onClick={() => postBlockerMessage(blocker.id)}
                                disabled={
                                  !newBlockerMsg.trim() || postingBlockerMsg
                                }
                                className="px-2 py-1 bg-blue-500 text-white rounded text-[10px] font-bold uppercase disabled:opacity-40"
                              >
                                Send
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {resolvedBlockers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Resolved ({resolvedBlockers.length})
                  </p>
                  {resolvedBlockers.map((blocker) => (
                    <div
                      key={blocker.id}
                      className="flex items-center p-2 rounded-lg bg-slate-500/10"
                    >
                      <span className="text-[10px] text-slate-400 font-bold line-through">
                        {blocker.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {/* New blocker input */}
        {!readOnly && (
          <div className="space-y-2">
            <input
              type="text"
              value={blockerTitle}
              onChange={(event) => setBlockerTitle(event.target.value)}
              placeholder={t("staff.opReport.blockerTitlePlaceholder")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold outline-none focus:border-rose-500/50"
              autoFocus
            />
            <textarea
              value={blockerDescription}
              onChange={(event) => setBlockerDescription(event.target.value)}
              placeholder={t(
                "staff.opReport.blockerDescriptionPlaceholder",
              )}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] outline-none focus:border-rose-500/50 resize-none"
            />
            <div className="flex gap-2">
              <select
                value={blockerPriority}
                onChange={(event) => setBlockerPriority(event.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
              >
                <option value="low">
                  {t("staff.opReport.priorityLow")}
                </option>
                <option value="medium">
                  {t("staff.opReport.priorityMedium")}
                </option>
                <option value="high">
                  {t("staff.opReport.priorityHigh")}
                </option>
                <option value="critical">
                  {t("staff.opReport.priorityCritical")}
                </option>
              </select>
              <input
                type="url"
                value={blockerRefUrl}
                onChange={(event) => setBlockerRefUrl(event.target.value)}
                placeholder={t(
                  "staff.opReport.blockerReferenceUrlPlaceholder",
                )}
                className="flex-[2] px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] outline-none focus:border-rose-500/50"
              />
            </div>
            <textarea
              value={blockerNotes}
              onChange={(event) => setBlockerNotes(event.target.value)}
              placeholder={t("staff.opReport.blockerNotesPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] outline-none focus:border-rose-500/50 resize-none"
            />
            <button
              onClick={handleAddBlocker}
              disabled={!blockerTitle.trim() || blockerAdding}
              className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 hover:bg-rose-600 transition-all"
            >
              {blockerAdding
                ? t("staff.opReport.addingBlocker")
                : t("staff.opReport.addBlockerButton")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
