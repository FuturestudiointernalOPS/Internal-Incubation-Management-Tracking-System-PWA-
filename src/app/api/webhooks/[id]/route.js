import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { deleteWebhook, getWebhookDeliveryLogs } from "@/lib/ventures";

export const DELETE = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { id } = await params;
    await deleteWebhook(id, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);

export const GET = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { id } = await params;
    const s = new URL(req.url).searchParams;

    const logs = await getWebhookDeliveryLogs(id, {
      limit: parseInt(s.get("limit")) || 50,
      offset: parseInt(s.get("offset")) || 0,
      status: s.get("status"),
    });
    return NextResponse.json({ success: true, logs });
  },
);
