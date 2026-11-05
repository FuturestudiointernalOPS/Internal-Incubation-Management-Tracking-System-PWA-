"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/lib/PermissionProvider";
import { CREATION_ACTIONS } from "@/lib/creationActions";

/**
 * Keeps the creation surface to the people who may actually create something.
 *
 * It is a courtesy of the UI, never the security boundary: every API the pages
 * call re-authorizes server-side (`programs.create`, `ventures.create`,
 * `investor.create`). Two levels:
 *
 *   - the `/create` layout renders it WITHOUT `requirements` → the caller must
 *     hold at least one creation capability, otherwise they are sent to their
 *     workspace hub (they have no business in this area at all);
 *   - each page renders it WITH its own requirement → a person holding only
 *     one creation right cannot open another creation page by address.
 *
 * While the matrix is still loading nothing is decided (no flash of a page the
 * caller may not have), and a failed read fails CLOSED.
 */
export default function CreationAccessGuard({ children, requirements = null }) {
  const router = useRouter();
  const { can, loading } = usePermissions();
  const hasRequirement = Array.isArray(requirements) && requirements.length > 0;
  const needed = hasRequirement ? requirements : CREATION_ACTIONS;
  const allowed = needed.some(({ module, capability }) => can(module, capability));
  const destination = hasRequirement ? "/create" : "/workspaces";

  useEffect(() => {
    if (!loading && !allowed) router.replace(destination);
  }, [loading, allowed, destination, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" role="status">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return allowed ? children : null;
}
