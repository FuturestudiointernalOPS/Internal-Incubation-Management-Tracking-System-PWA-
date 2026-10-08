"use client";
import ShellHeader from "@/components/layout/shell/ShellHeader";

import { SidebarContent } from "@/components/layout/shell/SidebarContent";

import ShellBanners from "./shell/ShellBanners";
import participantStyles from "./participant-shell.module.css";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import {
  getDashboardSession,
  getDashboardSessionUser,
  setDashboardSession,
  subscribeDashboardSession,
} from "@/lib/dashboardSession";
import { useRouter, usePathname } from "next/navigation";

import GlobalToast from "@/components/ui/GlobalToast";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";

import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { clearResponseCache } from "@/lib/hooks/useApi";
import { useDashboardBadges } from "./shell/useDashboardBadges";
import { useDashboardNavigation } from "./shell/useDashboardNavigation";

import { PermissionProvider, usePermissions } from "@/lib/PermissionProvider";


// The bell opens a GLANCE, not an inbox: only this many unread rows are listed
// at once, and "Show more" reveals the rest in place rather than making the
// header panel grow with the inbox.
const NOTIFICATIONS_PREVIEW = 3;




const COLLAPSE_KEY = "impactos_participant_sidebar_collapsed";
const collapseListeners = new Set();
let collapseFallback = false;
function readParticipantCollapse() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return collapseFallback; }
}
function subscribeParticipantCollapse(listener) {
  collapseListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { collapseListeners.delete(listener); window.removeEventListener("storage", listener); };
}
function writeParticipantCollapse(value) {
  const next = typeof value === "function" ? value(readParticipantCollapse()) : value;
  collapseFallback = next;
  try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* Storage may be unavailable. */ }
  collapseListeners.forEach(listener => listener());
}
let legacyCollapseFallback = false;
function readLegacyCollapse() {
  try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return legacyCollapseFallback; }
}
function setLegacyCollapsed(value) {
  const next = typeof value === "function" ? value(readLegacyCollapse()) : value;
  legacyCollapseFallback = next;
  try { localStorage.setItem("sidebar-collapsed", next ? "1" : "0"); } catch { /* Storage may be unavailable. */ }
  collapseListeners.forEach(listener => listener());
}
const expandedServerSnapshot = () => false;

// ─── The identity the shell paints with ─────────────────────────────────────
//
// It comes from the shared session store: the session this shell has already
// published (an in-memory store that survives a remount, so navigating costs no
// re-fetch), or — on a cold load, before the session has answered — the browser's
// stored copy. Reading it through a SUBSCRIPTION is what removes the effect that
// used to copy it into state, and with it the cascaded render that copy caused.
// The server snapshot is deliberately absent, so the server's render and the
// browser's first render agree and the identity arrives on the client's own read.
const EMPTY_USER = {};

function getShellUserSnapshot() {
  return getDashboardSessionUser();
}

function getShellUserServerSnapshot() {
  return null;
}


function DashboardLayoutInner({ children, role = "super_admin", modals, fullWidth = false }) {
  const legacyCollapsed = useSyncExternalStore(subscribeParticipantCollapse, readLegacyCollapse, expandedServerSnapshot);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { lang, t, switchLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const participantSurface = pathname?.startsWith("/participant");
  const participantCollapsed = useSyncExternalStore(subscribeParticipantCollapse, readParticipantCollapse, expandedServerSnapshot);
  const collapsed = participantSurface ? participantCollapsed : legacyCollapsed;
  const setCollapsed = participantSurface ? writeParticipantCollapse : setLegacyCollapsed;

  const { permissions: effectiveCaps } = usePermissions();

  const {
    showNotifications,
    setShowNotifications,
    showAllNotifications,
    setShowAllNotifications,
    notifications,
    setNotifications,
    unreadCount,
    setUnreadCount,
    pendingInvites,
    setPendingInvites,
    pendingAssignments,
    setPendingAssignments,
    pinnedAnnouncements,
    submissionCount,
    unreadByType,
    hasCommunicationActivity,
    fetchAnnouncements,
    fetchNotifications,
    fetchUnreadMessageCount,
    fetchPendingUsersCount,
    fetchPendingInvites,
    fetchPendingAssignments,
  } = useDashboardBadges({ effectiveCaps, pathname });


  const { theme, setTheme } = useTheme();
  const user = useSyncExternalStore(
    subscribeDashboardSession,
    getShellUserSnapshot,
    getShellUserServerSnapshot,
  ) || EMPTY_USER;

  // "We know who is signed in, or we have finished asking." The store answers the
  // first half during render; the second is settled when the session request has
  // answered, which is a write from that request's own continuation rather than
  // from an effect body.
  const [authSettled, setAuthSettled] = useState(false);
  const authChecked = Boolean(user.cid) || authSettled;

  // The ONE writer of the identity. It publishes to the store — preserving the
  // fields other surfaces put there, such as the capability matrix — and keeps
  // the browser's copy in step for the components that still read it.
  const publishUser = useCallback((next) => {
    const current = getDashboardSession() || {};
    setDashboardSession({ ...current, user: next });
    try {
      localStorage.setItem("user", JSON.stringify(next));
    } catch {
      // A browser with storage disabled keeps the identity for this load only.
    }
  }, []);
  const [pmPrograms, setPmPrograms] = useState([]);
  // Whether the connected person holds at least one usable course enrollment.
  // true = show the "My Learning" door; false/null = hidden (known to be
  // false, or the server has not answered yet).
  // The learner door is derived from the enrolment read above and from nothing
  // else, so there is no state here to keep in step with it.

  // The capabilities are restored by PermissionProvider (which mounts above this
  // shell) — the sidebar reads them from that context, and the badge fetchers
  // read `canReadMessages` from it at the top of this component.

  // Load user from session API first, fallback to localStorage
  useEffect(() => {
    async function initAuth() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();

        if (sessionData.authenticated && sessionData.user) {
          // Session API returned user — use it as source of truth
          const userWithFullData = {
            ...sessionData.user,
            // Merge with localStorage if available for extra fields
            ...(localStorage.getItem("user")
              ? JSON.parse(localStorage.getItem("user"))
              : {}),
            // But session data wins for these critical fields
            cid: sessionData.user.cid,
            name: sessionData.user.name,
            email: sessionData.user.email,
            role: sessionData.user.role,
            group_name: sessionData.user.group_name,
          };
          publishUser(userWithFullData);

          // One wave, not two. The badge reads at the end of this list depend on
          // nothing in the three before them, yet the shell used to AWAIT those
          // three and only then start the badges — a serial round-trip per page
          // load for no reason. All eight leave together now.
          const [groupsRes, respRes, notifRes] = await Promise.allSettled([
            fetch(`/api/user-groups?user_cid=${sessionData.user.cid}`),
            fetch(`/api/responsibilities?user_cid=${sessionData.user.cid}`),
            fetch(`/api/notifications?recipient_id=${sessionData.user.cid}`),
            fetchAnnouncements(),
            fetchUnreadMessageCount(),
            fetchPendingUsersCount(),
            fetchPendingInvites(),
            fetchPendingAssignments(),
          ]);

          // User groups
          if (groupsRes.status === "fulfilled") {
            try {
              const groupsData = await groupsRes.value.json();
              if (groupsData.success && groupsData.groups.length > 0) {
                const updatedUser = {
                  ...userWithFullData,
                  groups: groupsData.groups,
                };
                publishUser(updatedUser);
              }
            } catch (_) {}
          }

          // Responsibilities
          if (respRes.status === "fulfilled") {
            try {
              const respData = await respRes.value.json();
              if (respData.success) {
                const current = getDashboardSession() || {};
                setDashboardSession({
                  ...current,
                  responsibilities: respData.responsibilities || [],
                });
              }
            } catch (_) {}
          }

          // Notifications (pre-fetch to avoid separate effect)
          if (notifRes.status === "fulfilled") {
            try {
              const notifData = await notifRes.value.json();
              if (notifData.success) {
                // Only set if we haven't already fetched via the interval
                setNotifications((prev) =>
                  prev.length > 0 ? prev : notifData.notifications || [],
                );
                setUnreadCount(
                  typeof notifData.unread_count === "number"
                    ? notifData.unread_count
                    : (notifData.notifications || []).filter((notification) => !notification.is_read).length,
                );
              }
            } catch (_) {}
          }
        } else {
          // Session API failed — fallback to localStorage
          const savedUser = localStorage.getItem("user");
          if (savedUser) {
            publishUser(JSON.parse(savedUser));
          }
        }
      } catch {
        // Network error — fallback to localStorage
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          publishUser(JSON.parse(savedUser));
        }
      } finally {
        setAuthSettled(true);
      }
    }
    initAuth();
    // Every one of these is a stable callback (an empty dependency array), so
    // naming them here does not re-run the bootstrap; without them the analyser
    // cannot tell.
  }, [
    fetchAnnouncements,
    fetchPendingAssignments,
    fetchPendingInvites,
    fetchPendingUsersCount,
    fetchUnreadMessageCount,
    publishUser,
    setNotifications,
    setUnreadCount,
  ]);

  // Fetch PM programs for program_manager / super_admin roles.
  useEffect(() => {
    if (!user.cid && !user.id) return;
    if (user.role !== "program_manager" && user.role !== "super_admin") {
      return;
    }
    const url =
      user.role === "super_admin"
        ? "/api/pm/programs"
        : "/api/pm/programs?assigned_pm_id=" + (user.cid || user.id);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPmPrograms(data.programs || []);
      })
      .catch((error) => console.error(error));
  }, [user.role, user.cid, user.id]);


  // Personal relationships (program participation + venture membership) —
  // these drive the personal sidebar so it reflects actual membership, not
  // the legacy contact.role string.
  const [relationships, setRelationships] = useState(null);
  useEffect(() => {
    if (!user.cid) return;
    let alive = true;
    fetch("/api/me/relationships")
      .then((response) => response.json())
      .then((payload) => {
        if (alive && payload.success) setRelationships(payload);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.cid]);

  // Staff Venture console visibility (Phase 3): delegated staff see the
  // Ventures entry ONLY when they hold at least one active Venture assignment.
  // The same read says whether this person is a LEAD MANAGER — the check the
  // server applies to the Data bank's document definitions, so the door the
  // sidebar offers matches the door the server opens.
  const [ventureAssignCount, setVentureAssignCount] = useState(null);
  useEffect(() => {
    if (!user.cid) return;
    if (!["staff", "program_manager"].includes(user.role)) return;
    let alive = true;
    fetch("/api/ventures/assigned")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive) return;
        const assignments = payload.assignments || [];
        setVentureAssignCount(assignments.length);
      })
      .catch(() => {
        setVentureAssignCount(0);
      });
    return () => {
      alive = false;
    };
  }, [user.cid, user.role]);


  const { navItems, activePathIds, openMenus, toggleMenu, activeRole } =
    useDashboardNavigation({
      pathname,
      role,
      user,
      effectiveCaps,
      pmPrograms,
      ventureAssignCount,
      relationships,
    });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    // The response cache is module-level and survives this client-side
    // navigation; without purging it the next account could read the previous
    // one's answers (capability matrix included) for up to the cache TTL.
    clearResponseCache();
    localStorage.clear();
    setDashboardSession(null);
    router.replace("/login");
  };

  // Accept/decline a pending project invitation. The row is cleared optimistically
  // before the request, exactly as the inline banner handler did.
  const respondToProjectInvite = async (action) => {
    const invitation = pendingInvites[0];
    setPendingInvites([]);
    try {
      await fetch("/api/projects/invitations/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitation.id, action }),
      });
      fetchNotifications();
    } catch (_) {}
  };

  // Accept/decline a pending task assignment, same optimistic clear.
  const respondToTaskAssignment = async (action) => {
    const assignment = pendingAssignments[0];
    setPendingAssignments([]);
    try {
      await fetch("/api/tasks/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignment.id, action }),
      });
      fetchNotifications();
    } catch (_) {}
  };

  const commonProps = {
    collapsed,
    setCollapsed,
    role: activeRole,
    user,
    navItems,
    openMenus,
    toggleMenu,
    pathname,
    activePathIds,
    setMobileMenuOpen,
    handleLogout,
    t,
    submissionCount,
    unreadByType,
    hasCommunicationActivity,
  };

  // The CRM contacts grid renders edge-to-edge; preserve that behavior now
  // that the shell lives in the layout instead of the page.
  const isFullWidth =
    fullWidth ||
    (typeof pathname === "string" &&
      pathname.startsWith("/admin/communications/contacts"));

  if (!authChecked) {
    return <div className="min-h-screen bg-primary" />;
  }

  return (
    <AppErrorBoundary>
      <div className={`flex h-screen w-full overflow-hidden bg-primary text-[var(--text-primary)] ${participantSurface ? participantStyles.shell : ""}`}>
        <aside
          style={{ width: collapsed ? 76 : 260 }}
          data-collapsed={collapsed}
          className="hidden md:flex flex-col h-screen sticky top-0 bg-secondary border-r border-[var(--border-primary)] p-4 overflow-hidden min-h-0 z-[100] transition-[width] duration-150"
        >
          <SidebarContent {...commonProps} />
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[150]">
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <aside data-mobile-sidebar className="absolute inset-y-0 left-0 w-64 flex flex-col overflow-hidden bg-secondary p-6 border-r border-[var(--border-primary)]">
              <SidebarContent {...commonProps} collapsed={false} mobile />
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ShellHeader
            pathname={pathname}
            t={t}
            setThemeMenuOpen={setThemeMenuOpen}
            themeMenuOpen={themeMenuOpen}
            theme={theme}
            setTheme={setTheme}
            switchLang={switchLang}
            lang={lang}
            setShowAllNotifications={setShowAllNotifications}
            showNotifications={showNotifications}
            fetchNotifications={fetchNotifications}
            setShowNotifications={setShowNotifications}
            unreadCount={unreadCount}
            notifications={notifications}
            showAllNotifications={showAllNotifications}
            NOTIFICATIONS_PREVIEW={NOTIFICATIONS_PREVIEW}
            router={router}
            user={user}
            setPendingInvites={setPendingInvites}
            setPendingAssignments={setPendingAssignments}
            setMobileMenuOpen={setMobileMenuOpen}
          />

          <main className="app-page flex-1 p-6 lg:p-10 overflow-y-auto bg-primary">
            <ShellBanners
              pinnedAnnouncements={participantSurface ? [] : pinnedAnnouncements}
              pendingInvites={pendingInvites}
              pendingAssignments={pendingAssignments}
              onOpenAnnouncements={() => router.push("/admin/announcements")}
              onAcceptInvite={() => respondToProjectInvite("accept")}
              onDeclineInvite={() => respondToProjectInvite("decline")}
              onAcceptAssignment={() => respondToTaskAssignment("accept")}
              onDeclineAssignment={() => respondToTaskAssignment("decline")}
              t={t}
            />
            <div className={isFullWidth ? "w-full animate-in" : "max-w-[1400px] mx-auto animate-in"}>{children}</div>
          </main>
          {modals}
          <GlobalToast />
        </div>
      </div>
    </AppErrorBoundary>
  );
}

/**
 * The shell mounts its own permission provider: ONE capability read for the
 * whole surface, shared by the sidebar (via usePermissions) and every gated
 * affordance rendered underneath. Consumers outside a DashboardLayout keep
 * working standalone (usePermissions falls back to its own read).
 */
export default function DashboardLayout(props) {
  return (
    <PermissionProvider>
      <DashboardLayoutInner {...props} />
    </PermissionProvider>
  );
}
