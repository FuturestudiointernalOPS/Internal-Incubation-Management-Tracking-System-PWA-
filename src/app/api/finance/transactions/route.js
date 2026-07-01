import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getTransactions } from "@/lib/finance/queries";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const dataSourceId = searchParams.get("dataSourceId") || null;
    const type = searchParams.get("type") || null;
    const programId = searchParams.get("programId") || null;
    const dateFrom = searchParams.get("dateFrom") || null;
    const dateTo = searchParams.get("dateTo") || null;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await getTransactions(dataSourceId, {
      type,
      programId,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
