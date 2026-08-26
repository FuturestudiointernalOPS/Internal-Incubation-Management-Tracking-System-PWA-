import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { updateIntegration, deleteIntegration } from "@/lib/ventures";

export const PATCH = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { id } = await params;
    const body = await req.json();
    await updateIntegration(id, body, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);

export const DELETE = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { id } = await params;
    await deleteIntegration(id, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);
