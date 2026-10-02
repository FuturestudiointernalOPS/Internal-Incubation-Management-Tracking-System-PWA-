import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import {
  contactSearchPattern,
  searchProgramPoolForMember,
  searchGlobalDirectory,
} from "@/services/contacts/directorySearch";

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

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("q")?.trim();
    const programId = searchParams.get("program_id");

    if (!searchQuery || searchQuery.length < 2) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const likePattern = contactSearchPattern(searchQuery);

    // Membership-keyed branch: the caller belongs to the requested program as a
    // participant or as a venture founder whose venture belongs to it.
    if (programId) {
      const scoped = await searchProgramPoolForMember({ session, programId, likePattern });
      if (scoped.member) {
        return NextResponse.json({ success: true, contacts: scoped.contacts });
      }
    }

    // Global directory search: capability-gated (contacts.view). Internal CRM
    // roles hold it; everyone else is denied here. The model query includes
    // `role` so callers (e.g. the Venture Staff picker) can distinguish
    // Future Studio staff from founders/participants.
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;
    const contacts = await searchGlobalDirectory(likePattern);

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("GET /api/contacts/search error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
