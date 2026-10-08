"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Users,
  LayoutDashboard,
  Briefcase,
  Calendar,
  User,
  MessageSquare,
  Bell,
  TrendingUp,
  FileText,
  ShieldCheck,
  Rocket,
  Send,
  Library,
  BarChart3,
  ListTodo,
  ClipboardList,
  Wrench,
  CheckSquare,
  Clock,
  GraduationCap,
} from "lucide-react";
import { getActivePathIds } from "./navigation";
import { buildAccessNav, hasCapability } from "@/lib/masterNavigation";
import { useApi } from "@/lib/hooks/useApi";

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

// Roles whose shell is a PERSONAL surface (a person, not a staff function).
// Their sidebar is relationship-driven and their learning door is derived from
// an actual course enrollment, never from the role string.
const PERSONAL_ROLES = ["member", "founder", "participant", "team"];

/** Whether the connected person actually holds at least one course enrollment. */
const pickLmsEnrollment = (payload) => (payload && payload.success ? !!payload.enrolled : false);

export function useDashboardNavigation({
  pathname,
  role,
  user,
  effectiveCaps,
  pmPrograms,
  ventureAssignCount,
  relationships,
}) {
  // The sections the person opened or closed BY HAND, recorded together with the
  // route they were on. Nothing else about the accordion is state: the effective
  // map is derived below, so a navigation no longer needs an effect to settle it.
  const [menuToggles, setMenuToggles] = useState({ key: null, map: {} });

  const activeRole = shellRole(user.role, role);
  const sessionRole = shellRole(user.role, role);

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
  const { data: hasLmsEnrollments } = useApi(
    PERSONAL_ROLES.includes(sessionRole) ? "/api/lms/my-learning?exists=1" : null,
    { defaultValue: false, transform: pickLmsEnrollment, deps: [pathname] },
  );

  const navItems = useMemo(() => {
    // The sidebar reflects the CONNECTED user: their role, and — via the
    // capability projection in buildAccessNav — everything their
    // responsibilities actually grant them. It never changes with the page
    // being viewed (see shellRole).
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
      if (activeRole !== "team") items.push({ id: "announcements", name: "ANNOUNCEMENTS", icon: Bell, href: "/participant/announcements" });
      if (activeRole !== "team" && hasCapability(effectiveCaps, "messaging", "view")) items.push({ id: "messages", name: "MESSAGES", icon: MessageSquare, href: "/participant/messages" });
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
    activeRole,
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

  // Accordion toggle: opening one section closes the other click-opened ones,
  // except sections on the active path (they stay as context). Defined AFTER
  // activePathIds — referencing it in the dependency array before its
  // declaration would hit the const temporal dead zone (build crash).
  const toggleMenu = useCallback(
    (id) => {
      if (!id) return;
      setMenuToggles((prev) => {
        const map = prev.key === activePathKey ? { ...prev.map } : {};
        if (openMenus[id]) {
          map[id] = false;
          return { key: activePathKey, map };
        }
        // Opening one section closes the other hand-opened ones, except the
        // sections on the active path — they stay as context.
        for (const key of Object.keys(map)) {
          if (key !== id && !activePathIds.has(key)) delete map[key];
        }
        map[id] = true;
        return { key: activePathKey, map };
      });
    },
    [activePathKey, activePathIds, openMenus],
  );

  return { navItems, activePathIds, openMenus, toggleMenu, activeRole };
}
