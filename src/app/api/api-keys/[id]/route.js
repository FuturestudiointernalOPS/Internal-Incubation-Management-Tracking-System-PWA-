import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { revokeApiKey, rotateApiKey } from "@/lib/ventures";

export const DELETE = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { id } = await params;
    await revokeApiKey(id, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);

export const PATCH = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { id } = await params;
    const body = await req.json();

    if (body.action === "rotate") {
      const secret = await rotateApiKey(id, req.session?.cid);
      return NextResponse.json({ success: true, secret });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  },
);
