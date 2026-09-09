import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  isParticipantInProgram,
  isVentureFounderInProgram,
  searchContactsInProgram,
  searchContactsByNameOrEmail,
} from "@/models/contacts";

/**
 * GET /api/contacts/search?q=...&program_id=X
 *
 * MVP boundary: the general Future Studio CRM directory is NOT available to
 * external users.
 *
 * - Membership-keyed (Phase 1.2): anyone who holds an active participant or
 *   venture-founder relationship IN the requested program gets the
 *   program-scoped search — works for member-baseline users too.
 * - Global directory search requires the contacts.view capability (internal
 *   CRM roles hold it via their profile).
 * - Names/emails only — never full records.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const programId = searchParams.get("program_id");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const like = `%${q}%`;

    // Membership-keyed branch: the caller belongs to the requested program as
    // a participant or as a venture founder whose venture belongs to it.
    if (programId) {
      const [pp, vf] = await Promise.all([
        isParticipantInProgram(session.cid, programId),
        isVentureFounderInProgram(session.cid, programId),
      ]);
      if (pp.rows.length > 0 || vf.rows.length > 0) {
        // Scoped pool: program participants, program staff, assigned program
        // manager. Name/email only — minimal identity, no full contact record.
        const result = await searchContactsInProgram(like, programId);
        return NextResponse.json({ success: true, contacts: result.rows || [] });
      }
    }

    // Global directory search: capability-gated (contacts.view). Internal CRM
    // roles hold it; everyone else is denied here. The model query includes
    // `role` so callers (e.g. the Venture Staff picker) can distinguish
    // Future Studio staff from founders/participants.
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;
    const result = await searchContactsByNameOrEmail(like);

    return NextResponse.json({ success: true, contacts: result.rows || [] });
  } catch (error) {
    console.error("GET /api/contacts/search error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
