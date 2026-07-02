"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Developer Messages → redirects to the unified /staff/messages
 * (which uses MessagingChat component, same as all other roles)
 */
export default function DeveloperMessages() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/messages");
  }, [router]);

  return null;
}
