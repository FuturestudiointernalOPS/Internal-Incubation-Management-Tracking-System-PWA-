"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Progress Hub has been merged into the Programs page.
 * This redirect ensures any bookmarked links still work.
 */
export default function ProgressRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pm/programs");
  }, [router]);
  return null;
}
