import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The person timeline moved into the CRM workspace.
 * The selected person (`?cid=`) is carried across the redirect.
 */
export default async function LegacyTimelineRedirect({ searchParams }) {
  const query = await searchParams;
  const cid = query?.cid;
  redirect(cid ? `/crm/timeline?cid=${encodeURIComponent(cid)}` : "/crm/timeline");
}
