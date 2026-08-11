import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/**
 * INTENTS API — Phase 4
 *
 * An Intent is a higher-level objective with tasks, blockers,
 * responsible person, and Contact Group scoping.
 *
 * GET    /api/intents?context_type=staff&context_id=X&status=active&responsible_id=X
 * POST   /api/intents  { title, description, responsible_id, context_type, ... }
 * PUT    /api/intents  { id, title, ... }
 * DELETE /api/intents?id=X
 */

/**
 * GET — List intents filtered by context, status, responsible person.
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
    const context_type = searchParams.get("context_type");
    const context_id = searchParams.get("context_id");
    const responsible_id = searchParams.get("responsible_id");
    const status = searchParams.get("status");
    const project_id = searchParams.get("project_id");

    let sql = "SELECT * FROM intents WHERE 1=1";
    const args = [];

    // SECURITY: Non-SA users see only their own intents + intents in their context
    if (session.role !== "super_admin") {
      // User can see intents they're responsible for, or intents in their context
      if (responsible_id) {
        if (String(responsible_id) !== String(session.cid)) {
          return NextResponse.json(
            { success: false, error: "You can only view your own intents." },
            { status: 403 },
          );
        }
        sql += " AND responsible_id = ?";
        args.push(String(responsible_id));
      } else {
        // See intents where responsible OR in same context
        sql += " AND (responsible_id = ?";
        args.push(String(session.cid));
        if (context_type) {
          sql += " OR context_type = ?";
          args.push(context_type);
        }
        sql += ")";
      }
    } else {
      // SA: apply filters as given
      if (responsible_id) {
        sql += " AND responsible_id = ?";
        args.push(responsible_id);
      }
    }

    if (context_type) {
      sql += " AND context_type = ?";
      args.push(context_type);
    }

    if (context_id) {
      sql += " AND context_id = ?";
      args.push(context_id);
    }

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    if (project_id) {
      sql += " AND project_id = ?";
      args.push(project_id);
    }

    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });

    // Attach task counts per intent
    const intents = await Promise.all(
      result.rows.map(async (intent) => {
        const countRes = await db.execute({
          sql: `SELECT
            COUNT(*) FILTER (WHERE status NOT IN ('completed','archived')) AS active_count,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
            COUNT(*) AS total_count
            FROM tasks WHERE intent_id = ?`,
          args: [intent.id],
        });
        return {
          ...intent,
          taskCounts: countRes.rows[0] || {
            active_count: 0,
            completed_count: 0,
            total_count: 0,
          },
        };
      }),
    );

    return NextResponse.json({ success: true, intents });
  } catch (error) {
    console.error("GET intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST — Create a new Intent.
 */
export async function POST(req) {
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

    const body = await req.json();
    const {
      title,
      description,
      responsible_id,
      context_type,
      context_id,
      contact_group_id,
      project_id,
      status,
      start_date,
      target_date,
    } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 },
      );
    }

    const finalResponsibleId = responsible_id || session.cid;
    const finalContextType = context_type || "staff";

    // SECURITY: Verify responsible person exists
    const respCheck = await db.execute({
      sql: "SELECT cid, name FROM contacts WHERE cid = ?",
      args: [finalResponsibleId],
    });
    if (respCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Responsible person not found." },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO intents
        (title, description, responsible_id, context_type, context_id,
         contact_group_id, project_id, status, start_date, target_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id`,
      args: [
        title,
        description || null,
        finalResponsibleId,
        finalContextType,
        context_id || null,
        contact_group_id || null,
        project_id || null,
        status || "active",
        start_date || null,
        target_date || null,
      ],
    });

    const intentId = result.rows[0].id;

    // Audit log
    await logAuditEvent({
      entity_type: "intent",
      entity_id: intentId,
      user_id: session.cid,
      user_name: session.name || "",
      action: "created",
      details: `Intent "${title}" created`,
      metadata: {
        title,
        context_type: finalContextType,
        context_id: context_id || null,
        responsible_id: finalResponsibleId,
      },
    });

    return NextResponse.json({
      success: true,
      id: intentId,
      action: "created",
    });
  } catch (error) {
    console.error("POST intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PUT — Update an existing Intent.
 */
export async function PUT(req) {
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

    const body = await req.json();
    const {
      id,
      title,
      description,
      responsible_id,
      context_type,
      context_id,
      contact_group_id,
      project_id,
      status,
      start_date,
      target_date,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Fetch existing intent
    const existing = await db.execute({
      sql: "SELECT * FROM intents WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Intent not found" },
        { status: 404 },
      );
    }

    const intent = existing.rows[0];

    // SECURITY: Only responsible person or SA can update
    if (
      session.role !== "super_admin" &&
      String(intent.responsible_id) !== String(session.cid)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the responsible person can update this intent.",
        },
        { status: 403 },
      );
    }

    const updates = [];
    const args = [];

    if (title !== undefined) {
      updates.push("title = ?");
      args.push(title);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      args.push(description);
    }
    if (responsible_id !== undefined) {
      updates.push("responsible_id = ?");
      args.push(responsible_id);
    }
    if (context_type !== undefined) {
      updates.push("context_type = ?");
      args.push(context_type);
    }
    if (context_id !== undefined) {
      updates.push("context_id = ?");
      args.push(context_id);
    }
    if (contact_group_id !== undefined) {
      updates.push("contact_group_id = ?");
      args.push(contact_group_id);
    }
    if (project_id !== undefined) {
      updates.push("project_id = ?");
      args.push(project_id);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      args.push(status);
      if (status === "completed") {
        updates.push("completed_at = NOW()");
      }
    }
    if (start_date !== undefined) {
      updates.push("start_date = ?");
      args.push(start_date);
    }
    if (target_date !== undefined) {
      updates.push("target_date = ?");
      args.push(target_date);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    updates.push("updated_at = NOW()");
    args.push(id);

    await db.execute({
      sql: `UPDATE intents SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    // Audit log
    await logAuditEvent({
      entity_type: "intent",
      entity_id: id,
      user_id: session.cid,
      user_name: session.name || "",
      action: "updated",
      details: `Intent "${intent.title}" updated`,
      metadata: { updated_fields: Object.keys(body).filter((k) => k !== "id") },
    });

    return NextResponse.json({ success: true, action: "updated" });
  } catch (error) {
    console.error("PUT intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Delete an Intent and unlink its tasks.
 */
export async function DELETE(req) {
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Fetch intent
    const existing = await db.execute({
      sql: "SELECT * FROM intents WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Intent not found" },
        { status: 404 },
      );
    }

    const intent = existing.rows[0];

    // SECURITY: Only responsible person or SA can delete
    if (
      session.role !== "super_admin" &&
      String(intent.responsible_id) !== String(session.cid)
    ) {
      return NextResponse.json(
        { success: false, error: "Only the responsible person can delete this intent." },
        { status: 403 },
      );
    }

    // Unlink tasks (set intent_id to NULL, remove supervisor)
    await db.execute({
      sql: "UPDATE tasks SET intent_id = NULL, supervisor_id = NULL WHERE intent_id = ?",
      args: [id],
    });

    // Delete the intent
    await db.execute({
      sql: "DELETE FROM intents WHERE id = ?",
      args: [id],
    });

    // Audit log
    await logAuditEvent({
      entity_type: "intent",
      entity_id: id,
      user_id: session.cid,
      user_name: session.name || "",
      action: "deleted",
      details: `Intent "${intent.title}" deleted`,
    });

    return NextResponse.json({ success: true, action: "deleted" });
  } catch (error) {
    console.error("DELETE intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
