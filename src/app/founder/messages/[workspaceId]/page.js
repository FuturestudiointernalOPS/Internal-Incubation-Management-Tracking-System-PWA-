"use client";

import { useParams } from "next/navigation";

import WorkspaceConversation from "@/components/investor/WorkspaceConversation";

export const dynamic = "force-dynamic";

export default function FounderWorkspaceMessagesPage() {
  const { workspaceId } = useParams();
  return <WorkspaceConversation workspaceId={workspaceId} />;
}
