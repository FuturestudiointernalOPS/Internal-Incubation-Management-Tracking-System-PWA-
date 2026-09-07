"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy route — the timeline now lives inside the profile page.
 * Redirect to the profile's timeline section so old links/bookmarks keep working.
 */
export default function ParticipantTimelineRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/participant/profile#timeline");
  }, [router]);

  return null;
}
