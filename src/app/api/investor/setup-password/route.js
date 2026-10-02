import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import { setupInvestorPassword } from "@/services/investor";

/**
 * POST /api/investor/setup-password
 *
 * The required fields, the length rule, the setup-token lookup and its expiry
 * live in `@/services/investor`.
 */
export async function POST(req) {
  try {
    await initDb();
    const { token, password } = await req.json();

    const result = await setupInvestorPassword({ token, password });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, message: "Password set successfully." });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
