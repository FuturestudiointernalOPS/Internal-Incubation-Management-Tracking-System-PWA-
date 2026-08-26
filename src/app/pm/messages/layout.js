import { getSession } from "@/lib/auth";
import { can } from "@/lib/authorization";
import MessagingAccessDenied from "@/components/messaging/MessagingAccessDenied";

export const dynamic = "force-dynamic";

/**
 * Server-side guard: Messaging is a Future Studio internal-operations feature.
 * Program Managers hold messaging capability; anyone else is denied
 * server-side.
 */
export default async function MessagingGuard({ children }) {
  const session = await getSession();
  const allowed = await can(session, "messaging", "view");
  if (!allowed) return <MessagingAccessDenied />;
  return children;
}
