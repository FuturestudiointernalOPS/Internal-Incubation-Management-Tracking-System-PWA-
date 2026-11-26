"use client";

import { useParams } from "next/navigation";

import WorkspaceConversation from "@/components/shared/investor/WorkspaceConversation";

export const dynamic = "force-dynamic";

export default function FounderWorkspaceMessagesPage() {
  const { workspaceId } = useParams();
  return <WorkspaceConversation workspaceId={workspaceId} />;
}
