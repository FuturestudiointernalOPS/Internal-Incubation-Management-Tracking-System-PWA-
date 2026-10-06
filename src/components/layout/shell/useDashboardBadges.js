"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSwrJson } from "@/lib/hooks/useApi";
import { hasCapability } from "@/lib/masterNavigation";

// LocalStorage keys that remember when the user last viewed a given page,
// so sidebar badges only count items that arrived after that visit.
const SEEN_KEYS = {
  submissions: "impactos_pm_submissions_seen_at",
  messages: "impactos_messages_seen_at",
  pendingUsers: "impactos_pending_users_seen_at",
  announcements: "impactos_announcements_seen_at",
  forms: "impactos_forms_seen_at",
};

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

export function useDashboardBadges({ effectiveCaps, pathname }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  // The effective capability matrix is read ONCE by the shell (the server
  // remains authoritative) and passed in, because the badge fetchers consult it
  // — see `canReadMessages` below.

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

  return {
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
  };
}
