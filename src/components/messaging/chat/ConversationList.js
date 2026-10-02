"use client";

import { cn } from "@/components/messaging/chat/cn";
import { MessageSquare, Search, Check } from "lucide-react";
import { formatTime } from "@/components/messaging/chat/formatTime";

export default function ConversationList({
  mobileView,
  t,
  search,
  setSearch,
  loading,
  filteredConversations,
  activeConversation,
  unreadCounts,
  uid,
  threadIcon,
  openConversation,
}) {
  return (
<div
          className={cn(
            "w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-[var(--border-primary)] bg-tertiary/20 flex flex-col rounded-l-xl overflow-hidden",
            mobileView === "chat" && "hidden lg:flex",
          )}
        >
          <div className="p-3 border-b border-[var(--border-primary)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder={t("messaging.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] mb-3 opacity-30" />
                <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                  {search
                    ? t("messaging.noMatchingConversations")
                    : t("messaging.noConversations")}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">
                  {t("messaging.clickNewToStart")}
                </p>
              </div>
            ) : (
              filteredConversations.map((thread) => {
                const isActive = activeConversation?.id === thread.id;
                const unread = unreadCounts[thread.id] || 0;
                const lastMessage = thread.lastMessage;
                const isLastFromOther = lastMessage?.sender_id !== uid;
                const Icon = threadIcon(thread);

                return (
                  <button
                    key={thread.id}
                    onClick={() => openConversation(thread)}
                    className={cn(
                      "w-full text-left p-3 transition-all flex items-center gap-3 border-b border-divider/50",
                      isActive
                        ? "bg-brand-orange/10"
                        : "hover:bg-tertiary",
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        isActive || unread > 0
                          ? "bg-brand-orange/15 text-[var(--brand-orange)]"
                          : "bg-tertiary text-[var(--text-secondary)]",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-[11px] truncate",
                            unread > 0
                              ? "font-black text-[var(--text-primary)]"
                              : "font-bold text-[var(--text-primary)]",
                          )}
                        >
                          {thread.label}
                        </p>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                          {formatTime(lastMessage?.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {thread.type === "individual" &&
                          !isLastFromOther &&
                          (lastMessage?.is_read === 1 ? (
                            <span className="flex items-center gap-0.5 shrink-0">
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                              <Check className="w-2.5 h-2.5 text-emerald-400 -ml-1" />
                            </span>
                          ) : (
                            <Check className="w-2.5 h-2.5 text-[var(--text-secondary)] shrink-0" />
                          ))}
                        <p
                          className={cn(
                            "text-[10px] truncate flex-1",
                            unread > 0
                              ? "font-bold text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {lastMessage?.body || lastMessage?.subject || ""}
                        </p>
                      </div>
                    </div>

                    {unread > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[var(--brand-orange)] text-black text-[8px] font-black flex items-center justify-center shrink-0">
                        {unread}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
  );
}
