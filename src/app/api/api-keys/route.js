import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { createApiKey, getApiKeys } from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
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

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
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
