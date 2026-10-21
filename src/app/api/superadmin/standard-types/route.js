import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  createStandardType,
  deleteStandardType,
  listActiveStandardTypes,
  updateStandardType,
} from "@/models/platformConfig";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const res = await listActiveStandardTypes(category);
  return NextResponse.json({ success: true, types: res.rows });
});

export const POST = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { category, label, id } = await req.json();
  if (id) {
    await updateStandardType(label, id);
  } else {
    await createStandardType(label, category);
  }
  return NextResponse.json({ success: true });
});

export const DELETE = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

  const { id } = await req.json();
  await deleteStandardType(id);
  return NextResponse.json({ success: true });
});
