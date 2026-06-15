import { NextResponse } from "next/server";
import { getTransactions } from "@/lib/finance";

export async function GET() {
  try {
    const transactions = await getTransactions();
    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
