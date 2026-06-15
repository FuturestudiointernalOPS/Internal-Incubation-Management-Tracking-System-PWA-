import { NextResponse } from "next/server";
import { getTransactions } from "@/lib/finance";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project") || null;
    const transactions = await getTransactions(project);
    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
