import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getAlertStats,
  acknowledgeAlert,
  resolveAlert,
} from "@/services/ventures/monitoring";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type");

  if (type === "stats") {
    const stats = await getAlertStats();
    return NextResponse.json({ success: true, ...stats });
  }

  return NextResponse.json(
    { success: false, error: "Invalid type. Use type=stats." },
    { status: 400 },
  );
});

export const POST = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const body = await req.json();
  const { action, alert_id } = body;
  const actorCid = req.session?.cid;

  if (action === "acknowledge") {
    const result = await acknowledgeAlert(alert_id, actorCid);
    return NextResponse.json({ success: true, result });
  }

  if (action === "resolve") {
    const result = await resolveAlert(alert_id, actorCid);
    return NextResponse.json({ success: true, result });
  }

  return NextResponse.json(
    { success: false, error: "Invalid action. Use acknowledge or resolve." },
    { status: 400 },
  );
});
