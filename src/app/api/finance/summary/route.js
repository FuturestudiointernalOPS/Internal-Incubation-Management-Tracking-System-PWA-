import { NextResponse } from "next/server";
import { getSummary } from "@/lib/finance";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project") || null;
    const summary = await getSummary(project);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
