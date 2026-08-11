import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/intents/[id]/tasks
 *
 * Creates a task under a specific Intent.
 * Auto-inherits context_type, context_id, and supervisor_id from the Intent.
 *
 * Body: { title, description, assigned_to, project_id, category,
 *         start_date, end_date, priority, user_id, user_name,
 *         created_week, created_year }
 *
 * Contact Group enforcement applies — assignee must share a group
 * with the Intent's responsible person.
 */
export async function POST(req, { params }) {
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

    const { id: intentId } = await params;

    // Fetch the intent
    const intentRes = await db.execute({
      sql: "SELECT * FROM intents WHERE id = ?",
      args: [intentId],
    });

    if (intentRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Intent not found" },
        { status: 404 },
      );
    }

    const intent = intentRes.rows[0];

    // SECURITY: Only staff, SA, or the same-context users can add tasks to intent
    if (
      session.role !== "super_admin" &&
      String(intent.responsible_id) !== String(session.cid)
    ) {
      // For venture intents, check membership
      if (intent.context_type === "venture" && intent.context_id) {
        const memberCheck = await db.execute({
          sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
          args: [intent.context_id, session.cid],
        });
        if (memberCheck.rows.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error:
                "You do not have permission to add tasks to this intent.",
            },
            { status: 403 },
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Only the responsible person can add tasks to this intent.",
          },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const {
      user_id,
      user_name,
      title,
      description,
      assigned_to,
      project_id,
      category,
      start_date,
      end_date,
      priority,
      created_week,
      created_year,
    } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 },
      );
    }

    const finalUserId = user_id || session.cid;
    const finalAssignedTo = assigned_to || null;

    // Contact Group enforcement for assignment under intent
    if (finalAssignedTo && session.role !== "super_admin") {
      const { validateTaskAssignment } = await import("@/lib/contactGroups");
      const groupCheck = await validateTaskAssignment(
        finalUserId,
        finalAssignedTo,
        {
          context_type: intent.context_type,
          context_id: intent.context_id,
        },
      );
      if (!groupCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot assign task outside the Intent's Contact Group. ${groupCheck.reason || "No shared group found."}`,
          },
          { status: 403 },
        );
      }
    }

    // Inherit context + supervisor from intent
    const finalContextType = intent.context_type;
    const finalContextId = intent.context_id;
    const finalSupervisorId = intent.responsible_id;

    // Determine week/year
    const weekNum = created_week || getCurrentWeekNumber().week;
    const yearNum = created_year || getCurrentWeekNumber().year;

    const result = await db.execute({
      sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, start_date, end_date, assigned_to, priority,
         context_type, context_id, supervisor_id, intent_id)
        VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?)
        RETURNING id`,
      args: [
        finalUserId,
        user_name || session.name || "",
        title,
        description || null,
        project_id || intent.project_id || null,
        category || null,
        weekNum,
        yearNum,
        start_date || null,
        end_date || null,
        finalAssignedTo,
        priority || "medium",
        finalContextType,
        finalContextId,
        finalSupervisorId,
        intentId,
      ],
    });

    const taskId = Number(result.rows[0]?.id || result.lastInsertRowid);

    return NextResponse.json({
      success: true,
      id: taskId,
      intent_id: intentId,
      action: "created",
    });
  } catch (error) {
    console.error("POST intent tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/** Helper: current ISO week number and year */
function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 604800000;
  const week = Math.ceil((diff / oneWeek + start.getDay() + 1) / 7);
  return { week: Math.min(week, 52), year: now.getFullYear() };
}
