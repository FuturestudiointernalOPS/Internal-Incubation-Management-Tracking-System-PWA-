import { getSession } from "@/lib/auth";

/**
 * Shared venture access check — import this instead of re-implementing
 * the membership check in every route. Returns the session or null.
 *
 * Usage in a route:
 *   const { ventureId, session } = await requireVentureAccess(params.id);
 *   if (!session) return NextResponse.json({...}, {status: 404});
 *
 * Rules:
 *   - staff / super_admin / program_manager / developer → bypass membership (org-wide)
 *   - participant / teacher → must be active venture_member
 *   - Non-member → 404 (don't leak existence)
 */
export async function requireVentureAccess(ventureId, db) {
  const session = await getSession();
  if (!session) return { ventureId, session: null };

  const privilegedRoles = ["staff", "super_admin", "program_manager", "developer"];

  if (privilegedRoles.includes(session.role)) {
    return { ventureId, session };
  }

  if (session.cid) {
    // venture_members stores venture_id as the VNT code (TEXT). Convert an
    // internal UUID (if passed) back to the code so the membership check matches.
    let code = ventureId;
    try {
      if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
        const v = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [ventureId] });
        if (v.rows?.[0]?.venture_id) code = v.rows[0].venture_id;
      }
    } catch {}
    const r = await db.execute({
      sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
      args: [code, session.cid],
    });
    if (r.rows?.length > 0) {
      return { ventureId, session };
    }
  }

  return { ventureId, session: null };
}
