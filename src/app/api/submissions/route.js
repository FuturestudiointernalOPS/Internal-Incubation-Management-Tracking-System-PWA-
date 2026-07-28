import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import { requireAuth } from "@/lib/auth";

/**
 * SUBMISSIONS API — TRACK 3 ENHANCED
 * Supports versioning, instructor review actions, follow-up scheduling.
 * Never overwrites previous submissions — each POST creates a new version.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "participant",
      "team",
    ]);
    if (authError) return authError;
    const body = await req.json();
    const {
      program_id,
      deliverable_id,
      group_id,
      participant_id,
      team_id,
      submission_link,
      file_path,
      file_url,
      supporting_url,
      status,
      feedback,
      document_id,
    } = body;

    if (!program_id || (!deliverable_id && !document_id)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (program_id and deliverable_id or document_id)" },
        { status: 400 },
      );
    }

    // Resolve file URL
    const resolvedFileUrl = file_url || submission_link || file_path || null;

    // Auto-detect deliverable_id from document_id if needed
    const finalDeliverableId = deliverable_id || null;
    const finalDocumentId = document_id || 
      (deliverable_id && !isNaN(Number(deliverable_id)) ? Number(deliverable_id) : null);

    // Determine version number: find the highest existing version for this participant+deliverable
    let nextVersion = 1;
    try {
      let verSql = "SELECT MAX(version_number) as max_ver FROM v2_submissions WHERE participant_id = ? AND program_id = ? AND (";
      let verArgs = [participant_id || null, program_id];
      let conditions = [];
      
      if (finalDeliverableId) {
        conditions.push("deliverable_id = ?");
        verArgs.push(finalDeliverableId);
      }
      if (finalDocumentId) {
        conditions.push("document_id = ?");
        verArgs.push(finalDocumentId);
      }
      
      if (conditions.length > 0) {
        verSql += conditions.join(" OR ") + ")";
        const existingRes = await db.execute({ sql: verSql, args: verArgs });
        const existingVersion = existingRes.rows[0]?.max_ver;
        if (existingVersion) {
          nextVersion = Number(existingVersion) + 1;
        }
      }
    } catch (_) {
      // version_number column might not exist yet (pre-migration)
    }

    const result = await db.execute({
      sql: `INSERT INTO v2_submissions (
          program_id, deliverable_id, document_id, group_id, participant_id,
          file_url, supporting_url, status, feedback, version_number
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        program_id,
        finalDeliverableId,
        finalDocumentId,
        group_id || null,
        participant_id || null,
        team_id || null,
        resolvedFileUrl,
        supporting_url || null,
        status || "pending",
        feedback || null,
        nextVersion,
      ],
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
        program_id,
        deliverable_id,
        version_number: nextVersion,
        status: status || "pending",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const {
      id,
      status,
      feedback,
      score,
      review_action,
      rejection_reason,
      followup_date,
      followup_time,
      followup_duration,
      meeting_link,
      followup_notes,
    } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing ID or status" },
        { status: 400 },
      );
    }

    // ─── Business Rules ──────────────────────────────────────────────
    if (status === "revision_requested" && !feedback) {
      return NextResponse.json(
        { success: false, error: "Written feedback is required when requesting a revision" },
        { status: 400 },
      );
    }

    if (status === "rejected" && !rejection_reason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 },
      );
    }
    // ─────────────────────────────────────────────────────────────────

    // 1. Fetch current submission & participant details for notification
    const subRes = await db.execute({
      sql: `
           SELECT s.id, s.program_id, s.participant_id, s.team_id,
                  c.email, c.name as participant_name,
                  d.title as deliverable_title, prog.assigned_pm_id,
                  prog.name as program_name
           FROM v2_submissions s
           LEFT JOIN contacts c ON s.participant_id = c.cid
           LEFT JOIN v2_document_requirements d ON s.deliverable_id = CAST(d.id AS TEXT)
           LEFT JOIN v2_programs prog ON s.program_id = prog.id
           WHERE s.id = ?
        `,
      args: [id],
    });

    const sub = subRes.rows[0];

    // 2. Update Database with all review fields
    await db.execute({
      sql: `UPDATE v2_submissions SET
              status = ?, feedback = ?, review_action = ?,
              rejection_reason = ?, approved_at = CURRENT_TIMESTAMP,
              updated_at = NOW()
            WHERE id = ?`,
      args: [
        status,
        feedback || null,
        review_action || null,
        rejection_reason || null,
        id,
      ],
    });

    // 3. Handle Follow-up Scheduling (creates calendar event)
    if (status === "pending_followup" && followup_date && sub) {
      try {
        // Create event in v2_events for calendar sync
        const eventTitle = `Follow-up: ${sub.deliverable_title || "Submission Review"}`;
        const eventStart = followup_time
          ? new Date(`${followup_date}T${followup_time}`)
          : new Date(followup_date);

        const eventRes = await db.execute({
          sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, participant_id, created_by)
                VALUES (?, ?, ?, 'followup', ?, ?, ?, ?) RETURNING id`,
          args: [
            sub.program_id,
            eventTitle,
            followup_notes || null,
            eventStart.toISOString(),
            new Date(eventStart.getTime() + (followup_duration || 30) * 60000).toISOString(),
            sub.participant_id,
            "instructor",
          ],
        });

        // Also create a followup record
        await db.execute({
          sql: `INSERT INTO v2_followups (program_id, participant_id, submission_id, comment, scheduled_at, duration_minutes, meeting_link, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
          args: [
            sub.program_id,
            sub.participant_id,
            id,
            followup_notes || `Follow-up meeting for ${sub.deliverable_title || "submission"}`,
            eventStart.toISOString(),
            followup_duration || 30,
            meeting_link || null,
            followup_notes || null,
          ],
        });
      } catch (_) {
        // Calendar creation failure is non-blocking
      }
    }

    // 4. Dispatch In-App Notification to Participant (non-blocking)
    if (sub && sub.participant_id) {
      try {
        let notifTitle = `Submission ${statusLabel}`;
        let notifMessage = feedback
          ? `Your deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}. Feedback: ${feedback}`
          : `Your deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}.`;

        if (status === "rejected" && rejection_reason) {
          notifMessage += ` Reason: ${rejection_reason}`;
        }

        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'submission', 0, NOW())`,
          args: [sub.participant_id, notifTitle, notifMessage],
        });
      } catch (_) {}

      if (sub.email) {
        try {
          let emailBody = `Hello ${sub.participant_name || ""},\n\nYour submission for "${sub.deliverable_title || ""}" has been reviewed.\n\nStatus: ${statusLabel}\n`;
          if (feedback) emailBody += `Feedback: ${feedback}\n`;
          if (rejection_reason) emailBody += `Reason: ${rejection_reason}\n`;
          emailBody += `\nPlease check your dashboard for more details.`;

          await sendEmail({
            to: sub.email,
            subject: `Update on your submission: ${sub.deliverable_title || ""}`,
            body: emailBody,
          });
        } catch (_) {}
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const participant_id = searchParams.get("participant_id");
    const team_id = searchParams.get("team_id");
    const group_id = searchParams.get("group_id");
    const program_id = searchParams.get("program_id");
    const deliverable_id = searchParams.get("deliverable_id");
    const document_id = searchParams.get("document_id");
    const status = searchParams.get("status");
    const include_versions = searchParams.get("include_versions") === "true";
    const latest_only = searchParams.get("latest_only") === "true";

    let sql = `
       SELECT s.*,
              d.title as deliverable_title,
              d.week_number as deliverable_week,
              d.due_date as deliverable_due_date,
              p.name as participant_name, g.name as group_name
       FROM v2_submissions s
       LEFT JOIN v2_deliverables d ON s.deliverable_id = CAST(d.id AS TEXT)
       LEFT JOIN v2_participants p ON s.participant_id = CAST(p.id AS TEXT)
       LEFT JOIN v2_groups g ON s.group_id = CAST(g.id AS TEXT)
       WHERE 1=1
    `;
    let args = [];

    if (participant_id) {
      sql += " AND s.participant_id = ?";
      args.push(participant_id);
    }
    if (team_id) {
      sql += " AND s.team_id = ?";
      args.push(team_id);
    }
    if (group_id) {
      sql += " AND s.group_id = ?";
      args.push(group_id);
    }
    if (program_id) {
      sql += " AND s.program_id = ?";
      args.push(program_id);
    }
    if (deliverable_id) {
      sql += " AND s.deliverable_id = ?";
      args.push(deliverable_id);
    }
    if (document_id) {
      sql += " AND s.document_id = ?";
      args.push(Number(document_id));
    }
    if (status) {
      sql += " AND s.status = ?";
      args.push(status);
    }

    // If latest_only, get the latest version per participant+deliverable
    if (latest_only) {
      sql = `
        SELECT s1.*,
               COALESCE(del.title, dr.title) as deliverable_title,
               COALESCE(del.week_number, dr.week_number) as deliverable_week,
               del.due_date as deliverable_due_date,
               p.name as participant_name, g.name as group_name
        FROM v2_submissions s1
        LEFT JOIN v2_deliverables del ON s1.deliverable_id = del.id
        LEFT JOIN v2_document_requirements dr ON s1.document_id = dr.id
        LEFT JOIN v2_participants p ON s1.participant_id = p.id
        LEFT JOIN v2_groups g ON s1.group_id = g.id
        INNER JOIN (
          SELECT participant_id, COALESCE(deliverable_id, document_id::text) as lookup_id, MAX(version_number) as max_ver
          FROM v2_submissions
          WHERE 1=1
      `;
      let innerArgs = [];
      if (participant_id) {
        sql += " AND participant_id = ?";
        innerArgs.push(participant_id);
      }
      if (program_id) {
        sql += " AND program_id = ?";
        innerArgs.push(program_id);
      }
      if (deliverable_id) {
        sql += " AND (deliverable_id = ? OR document_id = ?)";
        innerArgs.push(deliverable_id, Number(deliverable_id) || 0);
      }
      sql += " GROUP BY participant_id, COALESCE(deliverable_id, document_id::text)";
      sql += " ) s2";
      sql += " ON s1.participant_id = s2.participant_id AND COALESCE(s1.deliverable_id, s1.document_id::text) = s2.lookup_id AND s1.version_number = s2.max_ver";
      args = [...innerArgs];
    }

    sql += " ORDER BY s.created_at DESC";

    const { rows } = await db.execute({ sql, args });

    // Format for UI
    const submissions = rows.map((r) => ({
      ...r,
      v2_deliverables: {
        title: r.deliverable_title,
        week_number: r.deliverable_week,
        due_date: r.deliverable_due_date,
      },
      v2_participants: r.participant_name ? { name: r.participant_name } : null,
      v2_groups: r.group_name ? { name: r.group_name } : null,
    }));

    // If include_versions, group and include version history
    if (include_versions && (participant_id || group_id)) {
      const grouped = {};
      for (const sub of submissions) {
        const groupId = sub.deliverable_id || sub.document_id || `doc-${sub.id}`;
        const key = `${sub.program_id}-${groupId}`;
        if (!grouped[key]) {
          grouped[key] = {
            deliverable_id: sub.deliverable_id,
            program_id: sub.program_id,
            deliverable_title: sub.deliverable_title,
            deliverable_week: sub.deliverable_week,
            deliverable_due_date: sub.deliverable_due_date,
            latest: sub,
            versions: [],
          };
        }
        grouped[key].versions.push(sub);
        // Sort versions by version_number
        grouped[key].versions.sort(
          (a, b) => (b.version_number || 0) - (a.version_number || 0),
        );
      }

      return NextResponse.json({
        success: true,
        grouped: Object.values(grouped),
        total: Object.keys(grouped).length,
      });
    }

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    console.error("Submissions GET Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { id, score, evaluation_data } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing submission ID" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "UPDATE v2_submissions SET evaluation_score = ?, evaluation_data = ?, updated_at = NOW() WHERE id = ?",
      args: [score || null, evaluation_data ? JSON.stringify(evaluation_data) : null, id],
    });

    return NextResponse.json({ success: true, message: "Evaluation updated" });
  } catch (error) {
    console.error("Submissions PUT Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
