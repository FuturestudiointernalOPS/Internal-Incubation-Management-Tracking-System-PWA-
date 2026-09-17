"use client";

import { useSyncExternalStore } from "react";
import {
  getDashboardSession,
  subscribeDashboardSession,
} from "@/lib/dashboardSession";

/**
 * useSessionUser — the signed-in identity, taken from the shell's session cache.
 *
 * Several screens need to know WHO is signed in before they can ask for
 * anything: a person's tasks, the blockers they may see, the programmes they
 * are attached to. Most of them read the browser's stored copy of the user for
 * that, which is only available because the shell writes it there as a
 * compatibility channel - and reading it costs an effect, because a browser
 * store cannot be read during the render that the server also produces.
 *
 * The shell already fetches the session and publishes it through the shared
 * cache, so this hook adds no request of its own: it subscribes to that cache.
 *
 * The server snapshot is deliberately null, and React also uses it for the
 * hydration render - so the first client render matches what the server sent and
 * there is nothing to warn about. The identity simply arrives a moment later,
 * and any read that waits on it fires then. Screens should treat an absent
 * identity as "not known yet" rather than "empty", which is why the example
 * below keeps its spinner for that moment.
 *
 * @example
 *   const { cid } = useSessionUser();
 *   const { data, loading: readLoading } = useApi(
 *     cid ? `/api/tasks?user_id=${cid}` : null,
 *     { defaultValue: [], transform: pickTasks, deps: [cid] },
 *   );
 *   const loading = !cid || readLoading;
 */
function getServerSession() {
  return null;
}

export function useSessionUser() {
  const session = useSyncExternalStore(
    subscribeDashboardSession,
    getDashboardSession,
    getServerSession,
  );

  const user = session?.user || null;
  return {
    user,
    cid: user?.cid ?? null,
    role: user?.role ?? null,
  };
}
