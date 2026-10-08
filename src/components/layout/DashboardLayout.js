"use client";
import ShellHeader from "@/components/layout/shell/ShellHeader";

import { SidebarContent } from "@/components/layout/shell/SidebarContent";

import { tnav, getActivePathIds } from "./shell/navigation";

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import {
  getDashboardSession,
  getDashboardSessionUser,
  setDashboardSession,
  subscribeDashboardSession,
} from "@/lib/dashboardSession";
import { Users, LayoutDashboard, Briefcase, Calendar, User, MessageSquare, Bell, TrendingUp, FileText, ShieldCheck, Rocket, Send, Library, BarChart3, ListTodo, ClipboardList, Wrench, CheckSquare, Megaphone, Clock, GraduationCap } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

import GlobalToast from "@/components/ui/GlobalToast";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";

import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { fetchSwrJson, useApi, clearResponseCache } from "@/lib/hooks/useApi";
import { buildAccessNav, hasCapability } from "@/lib/masterNavigation";

import { PermissionProvider, usePermissions } from "@/lib/PermissionProvider";

// LocalStorage keys that remember when the user last viewed a given page,
// so sidebar badges only count items that arrived after that visit.
const SEEN_KEYS = {
  submissions: "impactos_pm_submissions_seen_at",
  messages: "impactos_messages_seen_at",
  pendingUsers: "impactos_pending_users_seen_at",
  announcements: "impactos_announcements_seen_at",
  forms: "impactos_forms_seen_at",
};

// The bell opens a GLANCE, not an inbox: only this many unread rows are listed
// at once, and "Show more" reveals the rest in place rather than making the
// header panel grow with the inbox.
const NOTIFICATIONS_PREVIEW = 3;

// The badge's own rhythm, and the floor under every automatic re-read: the
// inbox is one shared read, and no combination of triggers may ask for it more
// often than this.
const NOTIFICATIONS_POLL_MS = 10_000;
const NOTIFICATIONS_MIN_INTERVAL_MS = 10_000;

const readSeenWatermark = (key) => {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(key);
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const writeSeenWatermark = (key) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, new Date().toISOString());
};

// Returns true when `dateValue` is newer than the watermark (or when we can't
// tell — we err on the side of showing the badge).
const isNewerThan = (dateValue, watermark) => {
  if (!watermark) return true;
  if (!dateValue) return true;
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return timestamp > watermark;
};

// Resolve icon names from the master navigation module into components.
const NAV_ICONS = {
  layoutDashboard: LayoutDashboard,
  users: Users,
  messageSquare: MessageSquare,
  briefcase: Briefcase,
  rocket: Rocket,
  barChart3: BarChart3,
  listTodo: ListTodo,
  fileText: FileText,
  library: Library,
  shieldCheck: ShieldCheck,
  wrench: Wrench,
  calendar: Calendar,
  send: Send,
  checkSquare: CheckSquare,
  bell: Bell,
  clipboardList: ClipboardList,
  user: User,
  trendingUp: TrendingUp,
  clock: Clock,
  graduationCap: GraduationCap,
};

function attachIcons(items) {
  return (items || []).map((item) => ({
    ...item,
    // Idempotent: string names are resolved to components; already-resolved
    // components (from a previous pass) pass through untouched.
    icon:
      typeof item.icon === "string" ? NAV_ICONS[item.icon] : item.icon,
    subItems: item.subItems ? attachIcons(item.subItems) : item.subItems,
  }));
}

/**
 * The role that drives the shell + sidebar. It is ALWAYS the connected user's
 * session role; the section layout's `role` prop is only a pre-session
 * fallback (before the cached/server session supplies `user.role`). The visited
 * page never contributes a role — a staff member on /crm stays staff.
 */
function shellRole(userRole, role) {
  return userRole || role || "super_admin";
}

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

// Roles whose shell is a PERSONAL surface (a person, not a staff function).
// Their sidebar is relationship-driven and their learning door is derived from
// an actual course enrollment, never from the role string.
const PERSONAL_ROLES = ["member", "founder", "participant", "team"];

/** Whether the connected person actually holds at least one course enrollment. */
const pickLmsEnrollment = (payload) => (payload && payload.success ? !!payload.enrolled : false);

function DashboardLayoutInner({ children, role = "super_admin", modals, fullWidth = false }) {
  const [collapsed, setCollapsedState] = useState(false);
  // The choice survives a reload. It is read after mount (never during render),
  // so the server and first client paint agree.
  useEffect(() => {
    try {
      if (localStorage.getItem("sidebar-collapsed") === "1") setCollapsedState(true);
    } catch {
      /* storage unavailable: the rail simply starts open */
    }
  }, []);
  const setCollapsed = useCallback((next) => {
    setCollapsedState((previous) => {
      const value = typeof next === "function" ? next(previous) : next;
      try {
        localStorage.setItem("sidebar-collapsed", value ? "1" : "0");
      } catch {
        /* storage unavailable: the choice just won't be remembered */
      }
      return value;
    });
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  // The sections the person opened or closed BY HAND, recorded together with the
  // route they were on. Nothing else about the accordion is state: the effective
  // map is derived below, so a navigation no longer needs an effect to settle it.
  const [menuToggles, setMenuToggles] = useState({ key: null, map: {} });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { lang, t, switchLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  // Effective capability matrix for the whole surface, read ONCE from the shared
  // permission context (the server remains authoritative). It sits here, above
  // the badge fetchers, because they consult it — see `canReadMessages` below.
  const { permissions: effectiveCaps } = usePermissions();

  // Whether this person may use the Messages feature at all.
  //
  // The unread badge is the ONLY consumer of the messages endpoint in the shell,
  // and the badge is only ever painted beside the Messages menu item. For
  // somebody whose sidebar has no Messages item — a member's sidebar is the
  // dashboard alone — the request is refused by the server, written into the
  // error log, and its answer thrown away. Every page load. Asking for an answer
  // that cannot be used is not a permission problem; it is a request that should
  // not be made.
  //
  // False while the matrix is still loading, which is deliberate: every caller
  // depends on this value, so the read fires the moment the answer arrives
  // rather than being skipped for the session.
  const canReadMessages = hasCapability(effectiveCaps, "messaging", "view");

  // When the inbox was last read — shared by every trigger through
  // fetchNotifications, so they throttle each other instead of each keeping
  // their own idea of "recently".
  const lastInboxReadAt = useRef(0);

  const fetchAnnouncements = useCallback(async () => {
    fetchSwrJson("/api/announcements", (data) => {
      // Only keep pinned, non-archived announcements for the banner
      setPinnedAnnouncements(
        (data.announcements || []).filter(
          (announcement) => announcement.is_pinned && !announcement.is_archived,
        ),
      );
    });
  }, []);

  // The inbox is read by several triggers — the timer below, a return to the
  // tab, a refresh event, the panel reopening — and each re-read is a full
  // server round trip (~590 ms measured). They share ONE read per
  // NOTIFICATIONS_MIN_INTERVAL_MS, so a burst of triggers can never become a
  // burst of requests, and a hidden tab asks for nothing at all (it re-asks
  // when it comes back, which is wired below). A read that a user action must
  // show immediately — marking a row read, answering an invitation — passes
  // `force`.
  const fetchNotifications = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force) {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (now - lastInboxReadAt.current < NOTIFICATIONS_MIN_INTERVAL_MS) return;
    }
    lastInboxReadAt.current = now;
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const recipientId =
      parsedUser.role === "super_admin"
        ? "sa"
        : parsedUser.cid || parsedUser.id;
    fetchSwrJson(`/api/notifications?recipient_id=${recipientId}`, (data) => {
      const rows = data.notifications || [];
      setNotifications(rows);
      // The badge is the server's own COUNT of unread rows, not the length of
      // this page of rows: the list is limited (50), so a list-derived badge
      // under-reports a big inbox and can only shrink when those 50 are read.
      setUnreadCount(
        typeof data.unread_count === "number"
          ? data.unread_count
          : rows.filter((row) => !row.is_read).length,
      );
    });
  }, []);

  // ── Fetch actual unread message count (not from notifications) ──
  const fetchUnreadMessageCount = useCallback(async () => {
    // No Messages feature, no badge, no request. See `canReadMessages`.
    if (!canReadMessages) return;
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const userCid = parsedUser.cid || parsedUser.id;
    if (!userCid) return;
    fetchSwrJson(`/api/internal-comms?cid=${userCid}`, (data) => {
      const seenAt = readSeenWatermark(SEEN_KEYS.messages);
      const myMessages = data.messages.filter(
        (message) =>
          String(message.recipient_id) === String(userCid) &&
          (message.is_read === 0 || message.is_read === null) &&
          isNewerThan(message.created_at, seenAt),
      );
      setUnreadMessageCount(myMessages.length);
    });
  }, [canReadMessages]);

  // ── Fetch pending user approvals count ──
  const fetchPendingUsersCount = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    if (parsedUser.role !== "super_admin") return;
    fetchSwrJson("/api/admin/pending-users", (data) => {
      const seenAt = readSeenWatermark(SEEN_KEYS.pendingUsers);
      setPendingUsersCount(
        (data.users || data.pendingUsers || []).filter(
          (user) => user.status === "pending" && isNewerThan(user.created_at, seenAt),
        ).length,
      );
    });
  }, []);

  // ── Fetch pending submission count for PM ──
  const [submissionCount, setSubmissionCount] = useState(0);
  const fetchSubmissionCount = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    if (parsedUser.role !== "program_manager") return;
    const pmId = parsedUser.cid || parsedUser.id;
    if (!pmId) return;
    fetchSwrJson(
      `/api/pm/submissions?assigned_pm_id=${encodeURIComponent(pmId)}`,
      (data) => {
        const seenAt = readSeenWatermark(SEEN_KEYS.submissions);
        const pending = (data.submissions || []).filter(
          (submission) => submission.status === "pending" && isNewerThan(submission.created_at, seenAt),
        ).length;
        setSubmissionCount(pending);
      },
    );
  }, []);

  // When a PM opens the submissions page (or a program's submissions tab),
  // remember the visit so the sidebar "programs" badge only counts submissions
  // that arrived after that point.
  const markSubmissionsSeen = useCallback(() => {
    writeSeenWatermark(SEEN_KEYS.submissions);
    fetchSubmissionCount();
  }, [fetchSubmissionCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname || !pathname.startsWith("/pm/submissions")) return;
    try {
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (savedUser?.role !== "program_manager") return;
    } catch (_) {
      return;
    }
    markSubmissionsSeen();
  }, [pathname, markSubmissionsSeen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSeen = () => {
      try {
        const savedUser = JSON.parse(localStorage.getItem("user") || "null");
        if (savedUser?.role !== "program_manager") return;
      } catch (_) {
        return;
      }
      markSubmissionsSeen();
    };
    window.addEventListener("pm:submissions-seen", onSeen);
    return () => window.removeEventListener("pm:submissions-seen", onSeen);
  }, [markSubmissionsSeen]);

  // Clear the other sidebar badges when the user visits their page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname) return;
    const currentPath = pathname;

    const messagesPage =
      currentPath === "/admin/internal-comms" || currentPath.endsWith("/messages");
    if (messagesPage) {
      writeSeenWatermark(SEEN_KEYS.messages);
      fetchUnreadMessageCount();
    }
    if (currentPath.startsWith("/admin/pending-users")) {
      writeSeenWatermark(SEEN_KEYS.pendingUsers);
      fetchPendingUsersCount();
    }
    if (currentPath.startsWith("/admin/communications/announcements")) {
      writeSeenWatermark(SEEN_KEYS.announcements);
      fetchNotifications();
    }
  }, [
    pathname,
    fetchNotifications,
    fetchUnreadMessageCount,
    fetchPendingUsersCount,
  ]);

  const fetchPendingInvites = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const userCid = parsedUser.cid || parsedUser.id;
    if (!userCid) return;
    fetchSwrJson(
      `/api/projects/invitations?invitee_id=${userCid}&status=pending`,
      (data) => setPendingInvites(data.invitations || []),
    );
  }, []);

  const fetchPendingAssignments = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const userCid = parsedUser.cid || parsedUser.id;
    if (!userCid) return;
    fetchSwrJson(
      `/api/tasks/assignments?assignee_id=${userCid}&status=pending`,
      (data) => setPendingAssignments(data.assignments || []),
    );
  }, []);

  // Listen for manual refresh events from approve actions
  useEffect(() => {
    const onRefresh = () => {
      // A refresh event is automatic: it respects the same floor as the timer,
      // so a screen that emits several of them reads the inbox once.
      const now = Date.now();
      if (now - lastInboxReadAt.current < NOTIFICATIONS_MIN_INTERVAL_MS) return;
      lastInboxReadAt.current = now;
      fetchNotifications({ force: true });
      fetchSubmissionCount();
      fetchPendingInvites();
      fetchPendingAssignments();
      fetchAnnouncements();
      fetchUnreadMessageCount();
      fetchPendingUsersCount();
    };
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
  }, [
    fetchNotifications,
    fetchSubmissionCount,
    fetchPendingInvites,
    fetchPendingAssignments,
    fetchAnnouncements,
    fetchUnreadMessageCount,
    fetchPendingUsersCount,
  ]);

  // An unread badge is only worth showing if it is CURRENT. The shell used to ask
  // once, so the number stayed frozen for the whole session: reading a
  // notification in another tab (or on any page that marks one read) left the
  // bell claiming the old total, and it never came down on its own. It now polls,
  // and re-asks whenever the tab returns to the foreground.
  useEffect(() => {
    const poll = setInterval(fetchNotifications, NOTIFICATIONS_POLL_MS);
    const onForeground = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, [fetchNotifications]);

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

  // "My Learning" only appears once the learner actually holds a course
  // (self-subscribed, admin enrollment or program assignment). The shell asks on
  // every PERSONAL surface — not only for the `participant` role — because a
  // course subscriber belongs to no program, so the relationship-driven sidebar
  // would leave them with a dashboard-only menu. Staff-side surfaces open the
  // course library from their capabilities instead (buildAccessNav).
  //
  // The read is addressed ON THE ROLE, so a surface that is not personal has no
  // address at all: no request is made and the door is hidden, which is what the
  // synchronous write this replaces was expressing. `pathname` is a dependency
  // rather than part of the address, so navigating inside the shell re-asks —
  // the door then opens as soon as an enrollment exists (e.g. right after
  // subscribing to a course from another page), and a failed request heals on
  // the next click instead of staying hidden.
  const sessionRole = shellRole(user.role, role);
  const { data: hasLmsEnrollments } = useApi(
    PERSONAL_ROLES.includes(sessionRole) ? "/api/lms/my-learning?exists=1" : null,
    { defaultValue: false, transform: pickLmsEnrollment, deps: [pathname] },
  );

  // Unread counts per nav type — messages from actual unread count, others from notifications
  const unreadByType = useMemo(() => {
    const counts = {
      messages: unreadMessageCount,
      announcements: 0,
      forms: 0,
      all_contacts: 0,
      pending_users: pendingUsersCount,
      bulk_upload: 0,
    };
    const announcementsSeenAt = readSeenWatermark(SEEN_KEYS.announcements);
    const formsSeenAt = readSeenWatermark(SEEN_KEYS.forms);
    for (const notification of notifications) {
      if (!notification.is_read) {
        if (
          notification.type === "announcement" &&
          isNewerThan(notification.created_at, announcementsSeenAt)
        ) {
          counts.announcements++;
        }
        if (notification.type === "form" && isNewerThan(notification.created_at, formsSeenAt)) {
          counts.forms++;
        }
      }
    }
    return counts;
  }, [notifications, unreadMessageCount, pendingUsersCount]);

  // Whether the COMMUNICATION section has any activity in its sub-items
  const hasCommunicationActivity = useMemo(() => {
    if (!unreadByType) return false;
    const commSubIds = [
      "messages",
      "announcements",
      "forms",
      "all_contacts",
      "pending_users",
      "bulk_upload",
    ];
    return commSubIds.some((id) => unreadByType[id] > 0);
  }, [unreadByType]);

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

  const navItems = useMemo(() => {
    // The sidebar reflects the CONNECTED user: their role, and — via the
    // capability projection in buildAccessNav — everything their
    // responsibilities actually grant them. It never changes with the page
    // being viewed (see shellRole).
    const activeRole = shellRole(user.role, role);

    // Personal roles: sidebar is relationship-driven (Phase 1). A person with
    // no program and no venture sees only Dashboard; the learner door appears
    // from an actual course enrollment, programs/certificates only for program
    // participants, ventures only for venture members.
    if (PERSONAL_ROLES.includes(activeRole)) {
      const rel = relationships || {
        isProgramParticipant: false,
        isVentureMember: false,
        isFounder: false,
        isInvestor: false,
        ventures: [],
      };
      // ONE dashboard per surface: the calendar page. "member" is the
      // baseline identity, not a destination — a member (and a founder, and a
      // participant) all land on /participant and get their contexts as
      // sidebar additions. Only the team surface has a different calendar page.
      const dashboardHref = activeRole === "team" ? "/team" : "/participant";
      const items = [
        { id: "dashboard", name: "DASHBOARD", icon: LayoutDashboard, href: dashboardHref },
      ];
      // The learner door. It opens from an actual enrollment — the LMS decides
      // access server-side — never from belonging to a program: someone who
      // subscribed to a course on the website holds no program and no venture.
      if (hasLmsEnrollments === true) {
        items.push({
          id: "learning",
          name: "MY LEARNING",
          icon: GraduationCap,
          href: "/participant/learning",
        });
      }
      if (rel.isProgramParticipant) {
        items.push({ id: "programs", name: "MY PROGRAMS", icon: Briefcase, href: "/participant/dashboard" });
        items.push({ id: "certificates", name: "MY CERTIFICATES", icon: FileText, href: "/participant/certificates" });
      }
      if (rel.isVentureMember) {
        // A founder's venture door sits with their program doors (the founder
        // nav contract reads Dashboard → Programs → Ventures → Timeline),
        // not buried after every participant item. Team members keep the
        // additive arrangement: their venture door comes last.
        const ventureDoor = { id: "ventures", name: "MY VENTURES", icon: Rocket, href: "/participant/ventures" };
        if (rel.isFounder) {
          const progIndex = items.findIndex((navItem) => navItem.id === "programs");
          items.splice(progIndex === -1 ? 1 : progIndex + 2, 0, ventureDoor);
        } else {
          items.push(ventureDoor);
        }
      }
      // The investor context: an APPROVED investor profile is a relationship the
      // baseline badge cannot carry, so a "member" who was taken as an investor
      // gets their investor space here — exactly like the program and venture
      // doors, driven by what the server resolved for this person, never by the
      // role string.
      if (rel.isInvestor) {
        items.push({ id: "investor", name: "INVESTOR SPACE", icon: TrendingUp, href: "/investor/dashboard" });
      }
      return items;
    }

    // SIDEBAR ADDITION — the ventures console appears only when this staff
    // member actually holds venture assignments. Navigation belongs in the
    // sidebar, not on the dashboard: clicking it opens ALL ventures.
    const withVentureConsole = (list) => {
      if (!["staff", "program_manager"].includes(activeRole)) return list;
      if (typeof ventureAssignCount !== "number" || ventureAssignCount <= 0) {
        return list;
      }
      const next = list.slice();
      if (!next.some((navItem) => navItem.id === "ventures")) {
        const dashIndex = next.findIndex((navItem) => navItem.id === "dashboard");
        const insertAt = dashIndex === -1 ? 0 : dashIndex + 1;
        next.splice(insertAt, 0, {
          id: "ventures",
          name: "MY VENTURES",
          icon: Rocket,
          href: "/staff/ventures",
        });
      }
      return next;
    };

    // The single source of sidebar truth: the role's doors plus every section
    // the user's effective capabilities grant, deduped and href-safe.
    const items = attachIcons(buildAccessNav(activeRole, effectiveCaps));

    if (
      (activeRole === "program_manager" || activeRole === "super_admin") &&
      pmPrograms.length > 0
    ) {
      const progIndex = items.findIndex((navItem) => navItem.id === "programs");
      if (progIndex !== -1) {
        const baseSubItems =
          activeRole === "super_admin"
            ? [
                {
                  id: "all_programs",
                  name: "ALL PROGRAMS",
                  href: "/admin/programs",
                },
                {
                  id: "create_program",
                  name: "CREATE PROGRAM",
                  href: "/admin/programs/new",
                },
              ]
            : [
                { id: "all_programs", name: "OVERVIEW", href: "/pm/programs" },
                {
                  id: "submissions",
                  name: "SUBMISSIONS",
                  href: "/pm/submissions",
                },
              ];

        // Only static menu items — no dynamic program listing
        items[progIndex] = {
          ...items[progIndex],
          subItems: [...baseSubItems],
        };
      }
    }

    // Staff-side surfaces keep their capability-projected doors; the learner
    // door is added inside the personal branch above.
    return withVentureConsole(items);
  }, [
    user.role,
    role,
    pmPrograms,
    hasLmsEnrollments,
    effectiveCaps,
    ventureAssignCount,
    relationships,
  ]);

  // Active navigation path — the current page plus every ancestor node id.
  const activePathIds = useMemo(
    () => getActivePathIds(navItems, pathname),
    [navItems, pathname],
  );
  const activePathKey = useMemo(
    () => [...(activePathIds || [])].join("|"),
    [activePathIds],
  );

  // The accordion: on a new route only the sections containing the current page
  // stay open, and whatever the person toggled ON THAT ROUTE is laid over that.
  // Derived during render, so arriving somewhere costs no state write and cannot
  // cascade a render — and the first paint already has the route's section open.
  const openMenus = useMemo(() => {
    const next = {};
    for (const id of activePathKey.split("|").filter(Boolean)) next[id] = true;
    if (menuToggles.key === activePathKey) {
      for (const [id, open] of Object.entries(menuToggles.map)) next[id] = open;
    }
    return next;
  }, [activePathKey, menuToggles]);

  // Toggle one section; several can stay open together.
  const toggleMenu = useCallback(
    (id) => {
      if (!id) return;
      setMenuToggles((prev) => {
        const map = prev.key === activePathKey ? { ...prev.map } : {};
        if (openMenus[id]) {
          map[id] = false;
          return { key: activePathKey, map };
        }
        // Several groups may be open at once.
        map[id] = true;
        return { key: activePathKey, map };
      });
    },
    [activePathKey, openMenus],
  );

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

  const activeRole = shellRole(user?.role, role);
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
      <div className="flex h-screen w-full overflow-hidden bg-primary text-[var(--text-primary)]">
        <aside
          style={{ width: collapsed ? 76 : 260 }}
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
            <aside className="absolute inset-y-0 left-0 w-64 flex flex-col overflow-hidden bg-secondary p-6 border-r border-[var(--border-primary)]">
              <SidebarContent {...commonProps} collapsed={false} />
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

          <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-primary">
            {/* Pinned Announcements Banner */}
            {pinnedAnnouncements.length > 0 && (
              <div className="mb-6 space-y-2">
                {pinnedAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-between flex-wrap gap-3 cursor-pointer hover:bg-brand-orange/15 transition-all"
                    onClick={() => router.push("/admin/announcements")}
                  >
                    <div className="flex items-center gap-3">
                      <Megaphone className="w-5 h-5 text-[var(--brand-orange)]" />
                      <div>
                        <p className="text-[11px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                          {t(tnav("announcements"))}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          <span className="font-bold text-[var(--text-primary)]">
                            {announcement.title}
                          </span>
                          {" — "}
                          {announcement.body.length > 120
                            ? announcement.body.substring(0, 117) + "..."
                            : announcement.body}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t("common.viewAll")} →
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Project Invitation Banner */}
            {pendingInvites.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
                  <div>
                    <p className="text-[11px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                      Project Invitation
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      You&apos;ve been invited to join{" "}
                      <span className="font-bold text-[var(--text-primary)]">
                        {pendingInvites[0].project_name || "a project"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setPendingInvites([]);
                      try {
                        await fetch("/api/projects/invitations/respond", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            invitation_id: pendingInvites[0].id,
                            action: "accept",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      setPendingInvites([]);
                      try {
                        await fetch("/api/projects/invitations/respond", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            invitation_id: pendingInvites[0].id,
                            action: "decline",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-slate-500 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            {/* Task Assignment Banner */}
            {pendingAssignments.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <ListTodo className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-[11px] font-black text-emerald-500 uppercase tracking-wider">
                      Task Assignment
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      You&apos;ve been assigned:{" "}
                      <span className="font-bold text-[var(--text-primary)]">
                        {pendingAssignments[0].task_title || "a task"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setPendingAssignments([]);
                      try {
                        await fetch("/api/tasks/assignments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            assignment_id: pendingAssignments[0].id,
                            action: "accept",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      setPendingAssignments([]);
                      try {
                        await fetch("/api/tasks/assignments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            assignment_id: pendingAssignments[0].id,
                            action: "decline",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-slate-500 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
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
