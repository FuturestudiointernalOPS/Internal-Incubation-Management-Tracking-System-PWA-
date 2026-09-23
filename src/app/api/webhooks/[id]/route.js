import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { deleteWebhook, getWebhookDeliveryLogs } from "@/lib/ventures";

export const DELETE = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { id } = await params;
    await deleteWebhook(id, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);

export const GET = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const { id } = await params;
    const searchParams = new URL(req.url).searchParams;

    const logs = await getWebhookDeliveryLogs(id, {
      limit: parseInt(searchParams.get("limit")) || 50,
      offset: parseInt(searchParams.get("offset")) || 0,
      status: searchParams.get("status"),
    });
    return NextResponse.json({ success: true, logs });
  },
);
