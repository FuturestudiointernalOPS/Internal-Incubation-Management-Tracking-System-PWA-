import { NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        cid: session.cid,
        name: session.name,
        email: session.email,
        role: session.role,
        group_name: session.group_name,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
