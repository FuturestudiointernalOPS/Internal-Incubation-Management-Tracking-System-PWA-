import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { isInvestorManagement } from "@/models/authorization/investorScope";

/** Module view permission alone must never expose cross-investor studio data. */
export async function requireInvestorStudioAuthorization(...capabilityArgs) {
  const denied = await requireAuthorization(...capabilityArgs);
  if (denied) return denied;
  if (!isInvestorManagement(await getSession())) {
    return NextResponse.json({ success: false, error: "errors.insufficientPermissions" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  return null;
}
