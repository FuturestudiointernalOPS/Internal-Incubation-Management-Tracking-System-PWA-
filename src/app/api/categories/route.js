import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listActiveWorkCategories } from "@/models/workspace";

export const GET = createHandler(async () => {
  const result = await listActiveWorkCategories();
  return NextResponse.json({ success: true, categories: result.rows });
});
