import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { acceptNda, getNdaForInvestor } from "@/services/investor/nda";

const PRIVATE = { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } };

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const language = new URL(req.url).searchParams.get("lang") === "fr" ? "fr" : "en";
    const result = await getNdaForInvestor({ language });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { ...PRIVATE, status: result.status });
    }
    return NextResponse.json({ success: true, ...result }, PRIVATE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE, status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const body = await req.json().catch(() => ({}));
    const language = body.language === "fr" ? "fr" : "en";
    const result = await acceptNda({
      session,
      language,
      version: typeof body.version === "string" ? body.version : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { ...PRIVATE, status: result.status });
    }
    return NextResponse.json({ success: true, version: result.version, profile: result.profile }, PRIVATE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE, status: 500 });
  }
}
