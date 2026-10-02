"use client";

import { Sun, Moon, Monitor, Bell, ChevronRight, ChevronDown, Menu } from "lucide-react";
import { tnav, navCrumb } from "./navigation";
import ContextSwitcher from "@/components/layout/ContextSwitcher";

export default function ShellHeader({
  pathname,
  t,
  setThemeMenuOpen,
  themeMenuOpen,
  theme,
  setTheme,
  switchLang,
  lang,
  setShowAllNotifications,
  showNotifications,
  fetchNotifications,
  setShowNotifications,
  unreadCount,
  notifications,
  showAllNotifications,
  NOTIFICATIONS_PREVIEW,
  router,
  user,
  setPendingInvites,
  setPendingAssignments,
  setMobileMenuOpen,
}) {
  return (
<header className="h-20 flex items-center px-4 lg:px-6 border-b border-[var(--border-primary)] bg-secondary/80 backdrop-blur-xl sticky top-0 z-[100]">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase relative z-10 min-w-0">
              <span className="hidden sm:inline">ImpactOS</span>
              <ChevronRight className="w-3 h-3 opacity-30 hidden sm:inline" />
              <span className="text-[var(--text-primary)] truncate">
                {pathname ? t(navCrumb(pathname)) : t("navigation.dashboard")}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto relative z-10">
              {/* Context Switcher — navigate between legitimate contexts (Phase 2C) */}
              <ContextSwitcher />
              {/* Theme Selector */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="p-2 rounded-md flex items-center gap-1"
                  style={{ color: "var(--text-secondary)" }}
                  title={theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
                >
                  {theme === "system" ? (
                    <Monitor className="w-4 h-4" />
                  ) : theme === "dark" ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                {themeMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[210]"
                      onClick={() => setThemeMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-10 w-36 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl z-[220] overflow-hidden">
                      {[
                        { value: "dark", label: "Dark", icon: Moon },
                        { value: "light", label: "Light", icon: Sun },
                        { value: "system", label: "System", icon: Monitor },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setTheme(option.value);
                            setThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${
                            theme === option.value
                              ? "text-[var(--brand-orange)] bg-brand-orange/10"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                          }`}
                        >
                          <option.icon className="w-3.5 h-3.5" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => switchLang(lang === "en" ? "fr" : "en")}
                className="px-2 py-1 text-[10px] font-bold border border-[var(--border-primary)] rounded uppercase"
              >
                {lang}
              </button>

              <div className="relative">
                <button
                  onClick={() => {
                    // The panel always opens as a SHORT glance, and always on
                    // current rows: opening it re-asks, so the list and the
                    // badge can never disagree with the server.
                    setShowAllNotifications(false);
                    if (!showNotifications) fetchNotifications();
                    setShowNotifications((previousValue) => !previousValue);
                  }}
                  aria-label={
                    unreadCount > 0
                      ? `${t("navigation.notifications")} (${unreadCount})`
                      : t("navigation.notifications")
                  }
                  aria-expanded={showNotifications}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--brand-orange)] text-black text-[10px] font-black rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-10 w-72 bg-secondary border border-[var(--border-primary)] rounded-lg p-4 z-[200]">
                    <h4 className="text-[10px] font-bold uppercase mb-3 text-[var(--text-secondary)]">
                      {t(tnav("intel_feed"))}
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {notifications.length > 0 ? (
                        (showAllNotifications
                          ? notifications
                          : notifications.slice(0, NOTIFICATIONS_PREVIEW)
                        ).map((notification) => (
                          <div
                            key={notification.id}
                            onClick={async () => {
                              // Mark as read
                              try {
                                await fetch("/api/notifications", {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    id: notification.id,
                                    action: "read",
                                  }),
                                });
                                fetchNotifications({ force: true });
                              } catch (_) {}

                              if (
                                notification.type === "verification" ||
                                notification.title.includes("ACCESS")
                              ) {
                                router.push("/admin/communications/contacts");
                                setShowNotifications(false);
                              }
                              if (notification.type === "message") {
                                const role = user?.role || "";
                                if (role === "super_admin")
                                  router.push("/admin/internal-comms");
                                else if (role === "staff")
                                  router.push("/staff/messages");
                                else if (role === "program_manager")
                                  router.push("/pm/messages");
                                else if (role === "participant")
                                  router.push("/participant/messages");
                                setShowNotifications(false);
                              }
                              if (
                                notification.type === "comment" ||
                                notification.type === "mention"
                              ) {
                                router.push("/staff/op-report");
                                setShowNotifications(false);
                              }
                              if (notification.type === "blocker_discussion") {
                                const role = user?.role || "";
                                if (role === "super_admin")
                                  router.push("/admin/blockers");
                                else router.push("/staff/op-report");
                                setShowNotifications(false);
                              }
                              if (notification.type === "investor" && notification.link) {
                                router.push(notification.link);
                                setShowNotifications(false);
                              }
                              if (
                                notification.type === "venture_invite" &&
                                notification.link
                              ) {
                                router.push(notification.link);
                                setShowNotifications(false);
                              }
                            }}
                            className={`p-3 rounded-xl hover:bg-primary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)] group ${!notification.is_read ? "bg-brand-orange/5" : ""}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-black text-[10px] uppercase tracking-tight text-[var(--text-primary)]">
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                              {notification.message}
                            </p>
                            {/* Accept/Decline buttons for project invitations */}
                            {notification.type === "project_invite" && (
                              <div
                                className="flex gap-2 mt-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  onClick={async () => {
                                    setPendingInvites([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const userCid = saved.cid || saved.id;
                                      const invRes = await fetch(
                                        `/api/projects/invitations?invitee_id=${userCid}&status=pending`,
                                      );
                                      const invData = await invRes.json();
                                      const pendingInvite =
                                        invData.invitations?.[0];
                                      if (pendingInvite) {
                                        await fetch(
                                          "/api/projects/invitations/respond",
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              invitation_id: pendingInvite.id,
                                              action: "accept",
                                            }),
                                          },
                                        );
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-emerald-500 text-white rounded text-[10px] font-bold uppercase"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={async () => {
                                    setPendingInvites([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const userCid = saved.cid || saved.id;
                                      const invRes = await fetch(
                                        `/api/projects/invitations?invitee_id=${userCid}&status=pending`,
                                      );
                                      const invData = await invRes.json();
                                      const pendingInvite =
                                        invData.invitations?.[0];
                                      if (pendingInvite) {
                                        await fetch(
                                          "/api/projects/invitations/respond",
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              invitation_id: pendingInvite.id,
                                              action: "decline",
                                            }),
                                          },
                                        );
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[10px] font-bold uppercase"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                            {/* Accept/Decline for task assignments */}
                            {notification.type === "task_assignment" && (
                              <div
                                className="flex gap-2 mt-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  onClick={async () => {
                                    setPendingAssignments([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const userCid = saved.cid || saved.id;
                                      const assRes = await fetch(
                                        `/api/tasks/assignments?assignee_id=${userCid}&status=pending`,
                                      );
                                      const assData = await assRes.json();
                                      const pendingAss =
                                        assData.assignments?.[0];
                                      if (pendingAss) {
                                        await fetch("/api/tasks/assignments", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            assignment_id: pendingAss.id,
                                            action: "accept",
                                          }),
                                        });
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-emerald-500 text-white rounded text-[10px] font-bold uppercase"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={async () => {
                                    setPendingAssignments([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const userCid = saved.cid || saved.id;
                                      const assRes = await fetch(
                                        `/api/tasks/assignments?assignee_id=${userCid}&status=pending`,
                                      );
                                      const assData = await assRes.json();
                                      const pendingAss =
                                        assData.assignments?.[0];
                                      if (pendingAss) {
                                        await fetch("/api/tasks/assignments", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            assignment_id: pendingAss.id,
                                            action: "decline",
                                          }),
                                        });
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[10px] font-bold uppercase"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] opacity-40 py-4 text-center">
                          {t(tnav("no_new_intel"))}
                        </p>
                      )}
                    </div>
                    {notifications.length > NOTIFICATIONS_PREVIEW && (
                      <button
                        onClick={() => setShowAllNotifications((previousValue) => !previousValue)}
                        className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
                      >
                        {t(showAllNotifications ? "common.showLess" : "common.showMore")}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-[var(--border-primary)]">
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] font-bold leading-none">
                    {user?.name || "User"}
                  </p>
                </div>
                <div className="w-8 h-8 rounded bg-primary border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs">
                  {String(user?.name || "U").charAt(0)}
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 bg-[var(--brand-orange)] rounded-md"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
            </div>
          </header>
  );
}
