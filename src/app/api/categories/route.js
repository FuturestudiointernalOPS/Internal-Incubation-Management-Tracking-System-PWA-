import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { listActiveWorkCategories } from "@/models/workspace";

export const GET = createHandler(async () => {
  // Reference data for the task form (Operations / projects).
  const capError = await requireAuthorization("projects", "view");
  if (capError) return capError;

  const result = await listActiveWorkCategories();
  return NextResponse.json({ success: true, categories: result.rows });
});
