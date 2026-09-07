import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import {
  getIntegrationProviders,
  getIntegrations,
  createIntegration,
} from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const s = new URL(req.url).searchParams;
    const type = s.get("type");

    if (type === "providers") {
      const providers = await getIntegrationProviders();
      return NextResponse.json({ success: true, providers });
    }

    const filters = {
      ventureId: s.get("venture_id"),
      provider: s.get("provider"),
      status: s.get("status"),
      limit: s.get("limit") ? parseInt(s.get("limit")) : undefined,
      offset: s.get("offset") ? parseInt(s.get("offset")) : undefined,
    };

    const integrations = await getIntegrations(filters);
    return NextResponse.json({ success: true, integrations });
  },
);

export const POST = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const body = await req.json();
    const id = await createIntegration({
      provider: body.provider,
      label: body.label,
      ventureId: body.venture_id,
      config: body.config,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, id });
  },
);
