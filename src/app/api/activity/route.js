import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { listActivityLogs, createActivityLog } from "@/models/workspace";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("programs", "view");
  if (capError) return capError;

  const result = await listActivityLogs();
  return NextResponse.json({ success: true, activity: result.rows });
});

export const POST = createHandler(
  async (req) => {
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

    const { user, action } = await req.json();
    await createActivityLog(user || "System", action);
    return NextResponse.json({ success: true });
  },
);
