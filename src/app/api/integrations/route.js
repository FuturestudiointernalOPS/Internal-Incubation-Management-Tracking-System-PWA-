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

  const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type");

    if (type === "providers") {
      const providers = await getIntegrationProviders();
      return NextResponse.json({ success: true, providers });
    }

    const filters = {
      ventureId: searchParams.get("venture_id"),
      provider: searchParams.get("provider"),
      status: searchParams.get("status"),
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")) : undefined,
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
