"use client";

import { cn } from "@/components/messaging/chat/cn";
import { Send, MessageSquare, X, CheckCheck, Paperclip, ExternalLink, Loader2 } from "lucide-react";
import React from "react";
import { formatTime } from "@/components/messaging/chat/formatTime";

export default function ConversationThread({
  mobileView,
  activeConversation,
  t,
  setMobileView,
  threadIcon,
  activeMessages,
  uid,
  chatEndRef,
  replyShowAttachment,
  handleReplyFile,
  replyUploading,
  replyAttachmentUrl,
  setReplyAttachmentUrl,
  setReplyShowAttachment,
  setReplyAttachmentName,
  replyAttachmentName,
  replyInputRef,
  replyText,
  setReplyText,
  handleReplyKeyDown,
  handleReply,
  sending,
}) {
  return (
<div
          className={cn(
            "flex-1 flex flex-col bg-tertiary/10 rounded-r-xl overflow-hidden",
            mobileView === "list" && "hidden lg:flex",
          )}
        >
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <MessageSquare className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  {t("messaging.selectConversation")}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
                  {t("messaging.unreadHighlight")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-[var(--border-primary)] flex-shrink-0 bg-tertiary/30">
                {mobileView === "chat" && (
                  <button
                    onClick={() => setMobileView("list")}
                    className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] mr-1"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}
                <div className="w-9 h-9 rounded-full bg-brand-orange/15 text-[var(--brand-orange)] flex items-center justify-center flex-shrink-0">
                  {React.createElement(threadIcon(activeConversation), {
                    className: "w-4 h-4",
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-wider truncate">
                    {activeConversation.label}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {activeMessages.length !== 1
                      ? t("messaging.messageCountPlural", {
                          count: activeMessages.length,
                        })
                      : t("messaging.messageCount", {
                          count: activeMessages.length,
                        })}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-2">
                {activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {t("messaging.noMessages")}
                    </p>
                  </div>
                ) : (
                  activeMessages.map((message, index) => {
                    const isSent = message.sender_id === uid;
                    const isLast = index === activeMessages.length - 1;
                    const showRead = isSent && isLast && message.is_read === 1;
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex items-center gap-1.5 group",
                          isSent ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] lg:max-w-[60%] px-3.5 py-2.5 rounded-2xl",
                            isSent
                              ? "bg-[var(--brand-orange)] text-black rounded-br-md"
                              : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-primary)] rounded-bl-md",
                          )}
                        >
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                            {message.body}
                          </p>
                          {message.attachment_url && (
                            <a
                              href={message.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-colors",
                                isSent
                                  ? "bg-black/10 text-black hover:bg-black/20"
                                  : "bg-brand-orange/10 text-[var(--brand-orange)] hover:bg-brand-orange/20",
                              )}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {message.attachment_name || message.attachment_url}
                              </span>
                            </a>
                          )}
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isSent ? "justify-end" : "justify-start",
                            )}
                          >
                            <span className="text-[10px] font-medium opacity-50">
                              {formatTime(message.created_at)}
                            </span>
                            {showRead && (
                              <CheckCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick reply */}
              <div className="p-3 border-t border-[var(--border-primary)] flex-shrink-0 space-y-2">
                {/* Attachment fields */}
                {replyShowAttachment && (
                  <div className="space-y-2 px-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        onChange={handleReplyFile}
                        className="flex-1 text-[10px] text-slate-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-tertiary file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:text-[var(--text-primary)] file:cursor-pointer"
                      />
                      {replyUploading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-orange)] shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={t("messaging.attachmentUrlPlaceholder")}
                        value={replyAttachmentUrl}
                        onChange={(event) => setReplyAttachmentUrl(event.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                      />
                      <button
                        onClick={() => {
                          setReplyShowAttachment(false);
                          setReplyAttachmentUrl("");
                          setReplyAttachmentName("");
                        }}
                        className="text-[var(--text-secondary)] hover:text-red-500"
                        title={t("messaging.removeAttachment")}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder={t("messaging.attachmentNamePlaceholder")}
                      value={replyAttachmentName}
                      onChange={(event) => setReplyAttachmentName(event.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setReplyShowAttachment(!replyShowAttachment)}
                    className={cn(
                      "px-2.5 py-2.5 rounded-xl text-[10px] font-bold transition-all",
                      replyShowAttachment || replyAttachmentUrl
                        ? "bg-brand-orange/20 text-[var(--brand-orange)]"
                        : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    )}
                    title={t("messaging.attachFile")}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={replyInputRef}
                    type="text"
                    placeholder={t("messaging.typeMessage")}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-1.5"
                  >
                    {sending ? (
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> {t("messaging.send")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
  );
}
