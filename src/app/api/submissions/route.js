import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import { requireAuth } from "@/lib/auth";

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
      status,
      feedback,
    } = body;

    if (!program_id || !deliverable_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Use file_url if provided, fall back to submission_link/file_path for backward compat
    const resolvedFileUrl = file_url || submission_link || file_path || null;

    const result = await db.execute({
      sql: `INSERT INTO v2_submissions (
          program_id, deliverable_id, group_id, participant_id, team_id,
          file_url, status, feedback
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        program_id,
        deliverable_id,
        group_id || null,
        participant_id || null,
        team_id || null,
        resolvedFileUrl,
        status || "pending",
        feedback || null,
      ],
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
        program_id,
        deliverable_id,
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
    const { id, status, feedback, score, follow_up } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing ID or status" },
        { status: 400 },
      );
    }

    // 1. Fetch current submission (handles both participant and team submissions)
    const subRes = await db.execute({
      sql: `
           SELECT s.id, s.program_id, s.participant_id, s.team_id,
                  c.email, c.name as participant_name,
                  d.title as deliverable_title, prog.assigned_pm_id,
                  prog.name as program_name
           FROM v2_submissions s
           LEFT JOIN contacts c ON s.participant_id = c.cid
           LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
           LEFT JOIN v2_programs prog ON s.program_id = prog.id
           WHERE s.id = ?
        `,
      args: [id],
    });

    const sub = subRes.rows[0];

    // 2. Update Database
    await db.execute({
      sql: "UPDATE v2_submissions SET status = ?, feedback = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [status, feedback || null, id],
    });

    // 3. Handle Follow-up scheduling
    if (follow_up && sub) {
      const { scheduled_at, comment } = follow_up;
      try {
        await db.execute({
          sql: `INSERT INTO v2_followups (program_id, team_id, submission_id, scheduled_at, comment, followup_type, week_number)
                VALUES (?, ?, ?, ?, ?, 'coaching', NULL)`,
          args: [
            sub.program_id,
            sub.team_id || null,
            sub.id,
            scheduled_at || null,
            comment || feedback || null,
          ],
        });
      } catch (_) {}
    }

    // 4. Dispatch notifications
    const statusLabel = status?.replace(/_/g, " ") || "reviewed";

    // Team submission: notify all team members
    if (sub && sub.team_id) {
      try {
        const teamMembers = await db.execute({
          sql: "SELECT cid, email, name FROM contacts WHERE team_id = ? AND deleted = 0",
          args: [sub.team_id],
        });

        for (const member of teamMembers.rows) {
          try {
            await db.execute({
              sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                    VALUES (?, ?, ?, 'submission', 0, NOW())`,
              args: [
                member.cid,
                `Team Submission ${statusLabel}`,
                feedback
                  ? `Your team's deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}. Feedback: ${feedback}`
                  : `Your team's deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}.`,
              ],
            });
            if (member.email) {
              try {
                await sendEmail({
                  to: member.email,
                  subject: `Team Submission Update: ${sub.deliverable_title || ""}`,
                  body: `Hello ${member.name || ""},\n\nYour team's submission for "${sub.deliverable_title || ""}" has been reviewed.\n\nStatus: ${statusLabel}\nFeedback: ${feedback || "No additional comments provided."}\n${follow_up?.scheduled_at ? `Follow-up scheduled: ${follow_up.scheduled_at}` : ""}\n\nPlease check your team dashboard for more details.`,
                });
              } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    // Individual participant submission
    if (sub && sub.participant_id) {
      try {
        const notifTitle = `Submission ${statusLabel}`;
        const notifMessage = feedback
          ? `Your deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}. Feedback: ${feedback}`
          : `Your deliverable "${sub.deliverable_title || ""}" for ${sub.program_name || ""} was ${statusLabel}.`;

        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'submission', 0, NOW())`,
          args: [sub.participant_id, notifTitle, notifMessage],
        });
      } catch (_) {}

      if (sub.email) {
        try {
          await sendEmail({
            to: sub.email,
            subject: `Update on your submission: ${sub.deliverable_title || ""}`,
            body: `Hello ${sub.participant_name || ""},\n\nYour submission for "${sub.deliverable_title || ""}" has been reviewed.\n\nStatus: ${statusLabel}\nFeedback: ${feedback || "No additional comments provided."}\n\nPlease check your dashboard for more details.`,
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
    const status = searchParams.get("status");

    let sql = `
       SELECT s.*, d.title as deliverable_title, d.week_number as deliverable_week,
              p.name as participant_name, g.name as group_name,
              t.name as team_name
       FROM v2_submissions s
       LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
       LEFT JOIN v2_participants p ON s.participant_id = p.id
       LEFT JOIN v2_groups g ON s.group_id = g.id
       LEFT JOIN v2_teams t ON s.team_id = t.id
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
    if (status) {
      sql += " AND s.status = ?";
      args.push(status);
    }

    sql += " ORDER BY s.created_at DESC";

    const { rows } = await db.execute({ sql, args });

    // Format for UI (mimic supabase join structure)
    const submissions = rows.map((r) => ({
      ...r,
      v2_deliverables: {
        title: r.deliverable_title,
        week_number: r.deliverable_week,
      },
      v2_participants: r.participant_name ? { name: r.participant_name } : null,
      v2_groups: r.group_name ? { name: r.group_name } : null,
    }));

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
    const { participant_id, program_id, score } = await req.json();

    if (!participant_id || !program_id || score === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // score column does not exist in current v2_submissions schema
    return NextResponse.json({
      success: true,
      message: "Score column not available in current schema",
    });
  } catch (error) {
    console.error("Submissions PUT Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
