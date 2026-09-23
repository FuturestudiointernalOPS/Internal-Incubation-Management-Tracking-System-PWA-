import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { createApiKey, getApiKeys } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const queryParams = new URL(req.url).searchParams;
    const limit = queryParams.get("limit") ? parseInt(queryParams.get("limit")) : undefined;
    const offset = queryParams.get("offset") ? parseInt(queryParams.get("offset")) : undefined;

    const keys = await getApiKeys({
      createdBy: queryParams.get("created_by"),
      isActive: queryParams.has("is_active") ? queryParams.get("is_active") === "true" : undefined,
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
