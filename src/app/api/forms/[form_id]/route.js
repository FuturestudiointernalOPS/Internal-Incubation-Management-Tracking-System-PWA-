import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Forms feature not available in this schema" },
    { status: 501 },
  );
}
