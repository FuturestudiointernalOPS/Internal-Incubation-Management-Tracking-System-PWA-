import { NextResponse } from "next/server";
import { getMonthlyTrend } from "@/lib/finance";

export async function GET() {
  try {
    const monthly = await getMonthlyTrend();
    return NextResponse.json({ success: true, monthly });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
