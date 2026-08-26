import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { createApiKey, getApiKeys } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const s = new URL(req.url).searchParams;
    const limit = s.get("limit") ? parseInt(s.get("limit")) : undefined;
    const offset = s.get("offset") ? parseInt(s.get("offset")) : undefined;

    const keys = await getApiKeys({
      createdBy: s.get("created_by"),
      isActive: s.has("is_active") ? s.get("is_active") === "true" : undefined,
      limit,
      offset,
    });
    return NextResponse.json({ success: true, keys });
  },
);

export const POST = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const body = await req.json();
    const result = await createApiKey({
      name: body.name,
      description: body.description,
      scopes: body.scopes,
      expiresAt: body.expires_at,
      allowedIps: body.allowed_ips,
      rateLimit: body.rate_limit,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, ...result });
  },
);
