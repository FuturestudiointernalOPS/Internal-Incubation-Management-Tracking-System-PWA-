import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveVentureScopedDecision } from "@/lib/ventureScopedAccess";
import { hasVentureCapability } from "@/lib/venturePermissions";

/**
 * GET /api/ventures/[id]/my-access — "what may I do HERE?"
 *
 * PHASE 1 of the permission plan: the read that lets a screen hide or disable
 * what the server would refuse, instead of guessing. It answers with the SAME
 * verdict function the guard uses (`resolveVentureScopedDecision`), so the UI
 * can never be told something `requireVentureScopedAccess` would deny. Nothing
 * here enforces anything — this route changes no behaviour. It only reports.
 *
 * ── WHAT IS REPORTED (and what deliberately is not) ─────────────────────────
 *
 * `capabilities` covers exactly the two keys the venture routes are actually
 * gated on: `ventures.view` (reads) and `ventures.edit` (writes). Those are the
 * only two the guard consults, so they are the only two that are true.
 *
 * The Venture PERMISSION MATRIX (milestones / internal_notes / calendar, per
 * responsibility) is reported ONLY for the cells that a route actually reads —
 * listed in `matrix_enforced`. Everything else in the matrix stays private: it
 * is configured and seeded, but publishing a cell the server ignores would
 * rebuild the very problem this phase exists to remove — an interface that
 * promises something the server does not honour. Each wire that lands adds its
 * key to `matrix_enforced` and to `matrix`, and nothing else.
 *
 * Today exactly one cell is enforced: `calendar.schedule`, read by the sessions
 * route wherever the CALENDAR is defined — booking, moving, cancelling and
 * deleting a session. A Coach supports a Venture and attends; a manager
 * schedules it. Writing the Memo, recording attendance and raising action items
 * are participation, not management, and stay open to the Coach.
 *
 * `assignments` is NOT a judgement — it is the raw active assignment rows, so a
 * surface can show "your assignment" without interpreting anything.
 *
 * ── ACCESS ──────────────────────────────────────────────────────────────────
 *
 * An authenticated session is required, but NOT the capability being reported:
 * a person with neither view nor edit must be able to learn that, otherwise the
 * read is useless precisely when it matters. The Venture itself must exist —
 * existence is proved against the table rather than trusted from the URL, so an
 * unknown id is a 404 and the endpoint cannot be used to probe for Ventures.
 */
const REPORTED_CAPABILITIES = ["view", "edit"];

/**
 * The matrix cells a ROUTE actually reads. This list is the contract between
 * enforcement and this payload: a cell may be published here only once a route
 * consults it, and wiring a route means adding its cell here in the same change.
 */
const ENFORCED_MATRIX_CELLS = ["calendar.schedule"];

/** Resolve the canonical code, or null when no such Venture exists. */
async function findVentureCode(id) {
  const r = await db.execute({
    sql: "SELECT venture_id FROM ventures WHERE venture_id = ? OR id::text = ? LIMIT 1",
    args: [id, id],
  });
  return r.rows?.[0]?.venture_id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }

    const code = await findVentureCode(id);
    if (!code) {
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    }

    // One verdict per reported key, through the guard's own function.
    const capabilities = {};
    for (const capability of REPORTED_CAPABILITIES) {
      const verdict = await resolveVentureScopedDecision({
        session,
        ventureId: id,
        module: "ventures",
        capability,
      });
      capabilities[capability] = verdict.allowed
        ? { allowed: true, decision: verdict.decision }
        : {
            allowed: false,
            decision: verdict.decision,
            missing: verdict.missing || null,
          };
    }

    // The gate's own verdict — never a guess from the role string. A global role
    // holds no assignment rows, so without this the matrix read below would
    // report FALSE for someone the server lets through; an under-claim hides a
    // button that works, so the bypass has to be reproduced exactly.
    const isSuperAdmin = capabilities.view?.decision === "super-admin";

    const matrix = {};
    for (const cell of ENFORCED_MATRIX_CELLS) {
      const [area, action] = cell.split(".");
      let allowed = false;
      if (isSuperAdmin) {
        allowed = true; // unscoped authority
      } else if (session.cid) {
        allowed = await hasVentureCapability(db, {
          ventureId: code,
          contactId: session.cid,
          area,
          action,
        });
      }
      matrix[cell] = { allowed };
    }

    // The person's own active assignments — facts, not a verdict. Global roles
    // hold no assignment rows (their authority is unscoped), so this stays
    // empty for them rather than pretending otherwise.
    let assignments = [];
    if (session.cid) {
      const r = await db
        .execute({
          sql: `SELECT responsibility_code, scope_type, scope_ref_type, scope_ref_id
                FROM venture_staff_assignments
                WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active'`,
          args: [code, session.cid],
        })
        .catch(() => ({ rows: [] }));
      assignments = r.rows || [];
    }

    return NextResponse.json({
      success: true,
      venture_id: code,
      role: session.role || null,
      is_super_admin: isSuperAdmin,
      capabilities,
      assignments,
      reported: REPORTED_CAPABILITIES,
      matrix,
      // Which cells above are backed by a real gate, and which are not.
      matrix_enforced: ENFORCED_MATRIX_CELLS,
    });
  } catch (e) {
    console.error("[ventures/my-access] error:", e?.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
