import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { updateIntegration, deleteIntegration } from "@/lib/ventures";

export const PATCH = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { id } = await params;
    const body = await req.json();
    await updateIntegration(id, body, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);

export const DELETE = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { id } = await params;
    await deleteIntegration(id, req.session?.cid);
    return NextResponse.json({ success: true });
  },
);
