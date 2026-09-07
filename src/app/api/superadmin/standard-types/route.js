import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  createStandardType,
  deleteStandardType,
  listActiveStandardTypes,
  updateStandardType,
} from "@/models/platformConfig";

const ROLE = { roles: ['super_admin'] };

export const GET = createHandler(ROLE, async (req) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const res = await listActiveStandardTypes(category);
  return NextResponse.json({ success: true, types: res.rows });
});

export const POST = createHandler(ROLE, async (req) => {
  const { category, label, id } = await req.json();
  if (id) {
    await updateStandardType(label, id);
  } else {
    await createStandardType(label, category);
  }
  return NextResponse.json({ success: true });
});

export const DELETE = createHandler(ROLE, async (req) => {
  const { id } = await req.json();
  await deleteStandardType(id);
  return NextResponse.json({ success: true });
});
