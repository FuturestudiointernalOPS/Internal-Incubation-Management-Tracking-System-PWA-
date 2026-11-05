import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { searchCrm } from "@/services/crm/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/crm/search?q=…
 *
 * Four objects: people, organizations, leads, opportunities. Requires `crm.view`;
 * the people group additionally requires `contacts.view`, decided in the service.
 */
export const GET = createHandler(async (req) => {
  const authError = await requireAuthorization("crm", "view");
  if (authError) return authError;

  const session = await getSession();
  const query = new URL(req.url).searchParams.get("q") ?? "";
  const result = await searchCrm(session, query);

  return NextResponse.json({ success: true, ...result });
});
