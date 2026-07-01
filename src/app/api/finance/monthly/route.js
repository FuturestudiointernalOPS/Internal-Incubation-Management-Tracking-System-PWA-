import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getMonthly } from "@/lib/finance/queries";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const dataSourceId = searchParams.get("dataSourceId") || null;
    const year = searchParams.get("year") || null;

    const result = await getMonthly(dataSourceId, year);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
