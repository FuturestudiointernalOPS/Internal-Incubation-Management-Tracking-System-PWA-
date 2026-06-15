import { NextResponse } from "next/server";
import { getMonthlyTrend } from "@/lib/finance";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project") || null;
    const monthly = await getMonthlyTrend(project);
    return NextResponse.json({ success: true, monthly });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
