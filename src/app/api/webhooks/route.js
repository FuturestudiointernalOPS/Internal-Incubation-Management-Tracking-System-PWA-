import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getWebhooks, createWebhook } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const s = new URL(req.url).searchParams;
    const limit = s.get("limit") ? parseInt(s.get("limit")) : undefined;
    const offset = s.get("offset") ? parseInt(s.get("offset")) : undefined;

    const webhooks = await getWebhooks({
      ventureId: s.get("venture_id"),
      event: s.get("event"),
      isActive: s.has("is_active") ? s.get("is_active") === "true" : undefined,
      limit,
      offset,
    });
    return NextResponse.json({ success: true, webhooks });
  },
);

export const POST = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const body = await req.json();
    const id = await createWebhook({
      name: body.name,
      url: body.url,
      secret: body.secret,
      events: body.events,
      ventureId: body.venture_id,
      retryCount: body.retry_count,
      timeoutMs: body.timeout_ms,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, id });
  },
);
