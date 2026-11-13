import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { getHomeContactByCid } from "@/models/participantPortal";
import { buildMemberDashboard } from "@/services/member";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/dashboard — the ONE personal dashboard, for every member.
 *
 * The response IS the page: identity, the profiles the person actually holds,
 * the personal agenda and announcements, and one block per held profile. A
 * block whose relationship is false is ABSENT, not empty — which is how "no
 * program data without a program seat" is enforced at the source rather than by
 * hiding widgets.
 *
 * The controller authenticates, reads the contact and shapes the envelope; the
 * assembly and every gating decision live in `@/services/member`.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.cid) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }

    const contactResult = await getHomeContactByCid(session.cid);
    const contact = contactResult.rows[0] || null;

    const dashboard = await buildMemberDashboard({ session, contact });
    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    console.error("GET /api/member/dashboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
