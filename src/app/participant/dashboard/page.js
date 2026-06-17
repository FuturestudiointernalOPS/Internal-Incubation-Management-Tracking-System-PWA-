"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ParticipantDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/participant");
  }, [router]);
  return null;
}
