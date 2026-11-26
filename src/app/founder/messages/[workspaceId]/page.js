import { redirect } from "next/navigation";
export default async function LegacyFounderMessages({ params }) {
  const { workspaceId } = await params;
  redirect(`/member/founder/messages/${encodeURIComponent(workspaceId)}`);
}
