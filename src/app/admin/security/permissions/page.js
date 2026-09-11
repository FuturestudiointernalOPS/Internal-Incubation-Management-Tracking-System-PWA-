"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_BASE } from "@/components/permissions/permissionNav";

/**
 * PHASE UI-5 — Permission Center landing.
 *
 * The old Home door is retired: the health numbers now head History. This base
 * URL is where the master navigation and old bookmarks point, so it forwards to
 * the first tab — People, the screen an admin actually came to use — keeping a
 * `?cid=` deep link intact.
 */
export default function PermissionCenterLanding() {
  const router = useRouter();

  useEffect(() => {
    let target = `${PERMISSION_BASE}/people`;
    try {
      const cid = new URLSearchParams(window.location.search).get("cid");
      if (cid) target += `?cid=${encodeURIComponent(cid)}`;
    } catch {
      /* no deep link — land on People */
    }
    router.replace(target);
  }, [router]);

  return null;
}
