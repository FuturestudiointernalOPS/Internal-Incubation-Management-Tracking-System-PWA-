import { NextResponse } from "next/server";
import { getBudgetLines } from "@/lib/finance";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project") || "Future Studio";
    const lines = await getBudgetLines(project);
    return NextResponse.json({ success: true, lines });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
