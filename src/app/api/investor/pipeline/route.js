import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/** POST /api/investor/pipeline — add venture to pipeline or update stage */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const session = await getSession();
    const user = session;
    const { venture_id, stage, notes, amount } = await req.json();

    if (!venture_id) {
      return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });
    }

    // Get investor profile
    const profile = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [user.cid || user.id],
    });
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    const investorId = profile.rows[0].id;
    const validStages = ["interested", "watching", "meeting_requested", "due_diligence", "negotiation", "invested", "declined"];
    const newStage = stage || "interested";

    if (!validStages.includes(newStage)) {
      return NextResponse.json({ success: false, error: "Invalid stage" }, { status: 400 });
    }

    // Upsert pipeline entry
    const result = await db.execute({
      sql: `INSERT INTO investment_pipeline (investor_id, venture_id, stage, notes, stage_changed_at)
            VALUES (?, ?, ?, ?, NOW())
            ON CONFLICT (investor_id, venture_id)
            DO UPDATE SET stage = EXCLUDED.stage, notes = EXCLUDED.notes,
                          stage_changed_at = NOW(), updated_at = NOW()
            RETURNING *`,
      args: [investorId, venture_id, newStage, notes || null],
    });

    // If stage is "meeting_requested", notify admin + create calendar placeholder
    if (newStage === "meeting_requested") {
      try {
        // Get investor and venture names
        const info = await db.execute({
          sql: `SELECT c.name as investor_name, ipr.organization_name, p.name as venture_name
                FROM investor_profiles ipr
                JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON p.id = ?
                WHERE ipr.id = ?`,
          args: [venture_id, investorId],
        });
        const inv = info.rows[0] || {};

        // Notify super admins
        const admins = await db.execute({
          sql: "SELECT cid FROM contacts WHERE role = 'super_admin' AND deleted_at IS NULL",
          args: [],
        });
        for (const a of admins.rows) {
          await db.execute({
            sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                  VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
            args: [
              a.cid,
              `Introduction Request: ${inv.venture_name || "Venture"}`,
              `${inv.investor_name || "Investor"} (${inv.organization_name || "Individual"}) requested an introduction to ${inv.venture_name || "a venture"}.${notes ? ` Message: "${notes.length > 100 ? notes.substring(0, 100) + '...' : notes}"` : ""}`,
              "/admin/investors/overview",
            ],
          });
        }

        // Create calendar placeholder event
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        await db.execute({
          sql: `INSERT INTO v2_events (program_id, team_id, title, description, event_type, start_time, end_time, location, created_by)
                VALUES (?, NULL, ?, ?, 'investor_meeting', ?, ?, 'TBD', ?)`,
          args: [
            venture_id,
            `Meeting: ${inv.venture_name || "Venture"} — ${inv.investor_name || "Investor"}`,
            `Meeting requested by ${inv.investor_name || "Investor"} (${inv.organization_name || "Individual"}) for ${inv.venture_name || "venture"}. Pending confirmation.`,
            nextWeek.toISOString(),
            nextWeek.toISOString(),
            user.cid || user.id,
          ],
        });
      } catch (_) {}
    }

    // If stage is "invested", auto-create decision, update campaign, portfolio
    if (newStage === "invested") {
      const pipelineId = result.rows[0].id;
      const investedAmount = parseFloat(amount || notes) || 0;

      const decisionRes = await db.execute({
        sql: `INSERT INTO investment_decisions (pipeline_id, decision_type, decision_date, investment_amount, decision_notes)
              VALUES (?, 'invest', CURRENT_DATE, ?, ?)
              ON CONFLICT (pipeline_id) DO NOTHING
              RETURNING *`,
        args: [pipelineId, investedAmount > 0 ? investedAmount : null, notes || null],
      });

      // Update fundraising campaign current_raised
      if (investedAmount > 0) {
        try {
          await db.execute({
            sql: `UPDATE fundraising_campaigns
                  SET current_raised = COALESCE(current_raised, 0) + ?,
                      status = CASE WHEN COALESCE(current_raised, 0) + ? >= target_raise THEN 'closed' ELSE status END,
                      updated_at = NOW()
                  WHERE venture_id = ? AND status = 'active'`,
            args: [investedAmount, investedAmount, venture_id],
          });
        } catch (_) {}
      }

      // Timeline entry in relationship workspace
      try {
        const relWs = await db.execute({
          sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?",
          args: [pipelineId],
        });
        if (relWs.rows.length > 0) {
          await db.execute({
            sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                  VALUES (?, 'investment_committed', ?)`,
            args: [relWs.rows[0].id, `Investment committed${investedAmount > 0 ? ' — $' + investedAmount.toLocaleString() : ''}`],
          });
          // Update workspace stage
          await db.execute({
            sql: "UPDATE relationship_workspaces SET current_stage = 'active_investment', updated_at = NOW() WHERE id = ?",
            args: [relWs.rows[0].id],
          });
        }
      } catch (_) {}

      // Notify everyone
      try {
        const info = await db.execute({
          sql: `SELECT c.name as investor_name, c.email, ipr.organization_name, p.name as venture_name, ipr.user_id
                FROM investor_profiles ipr
                JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON p.id = ?
                WHERE ipr.id = ?`,
          args: [venture_id, investorId],
        });
        const inv = info.rows[0] || {};

        // Notify admins
        const admins = await db.execute({
          sql: "SELECT cid FROM contacts WHERE role IN ('super_admin','staff') AND deleted_at IS NULL",
          args: [],
        });
        for (const a of admins.rows) {
          await db.execute({
            sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                  VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
            args: [
              a.cid,
              `Investment Confirmed: ${inv.venture_name || "Venture"}`,
              `${inv.investor_name || "Investor"} (${inv.organization_name || "Individual"}) has invested${investedAmount > 0 ? ' $' + investedAmount.toLocaleString() : ''} in ${inv.venture_name || "a venture"}.`,
              "/admin/investors/overview",
            ],
          });
        }

        // Notify investor
        if (inv.user_id) {
          await db.execute({
            sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                  VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
            args: [
              inv.user_id,
              `Investment Confirmed: ${inv.venture_name || "Venture"}`,
              `Your investment${investedAmount > 0 ? ' of $' + investedAmount.toLocaleString() : ''} in ${inv.venture_name || "the venture"} has been recorded. Welcome to your portfolio!`,
              "/investor/portfolio",
            ],
          });
        }

        // Notify RM and IM
        const relWs = await db.execute({
          sql: "SELECT relationship_manager_id, investment_manager_id FROM relationship_workspaces WHERE pipeline_id = ?",
          args: [pipelineId],
        });
        if (relWs.rows.length > 0) {
          const rw = relWs.rows[0];
          for (const cid of [rw.relationship_manager_id, rw.investment_manager_id]) {
            if (cid) {
              await db.execute({
                sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                      VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
                args: [
                  cid,
                  `Investment Confirmed: ${inv.venture_name || "Venture"}`,
                  `${inv.investor_name || "Investor"} has completed their investment in ${inv.venture_name || "a venture"}${investedAmount > 0 ? ' ($' + investedAmount.toLocaleString() + ')' : ''}.`,
                  "/admin/investors/relationships",
                ],
              });
            }
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, pipeline: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** GET /api/investor/pipeline — list pipeline for current investor or by venture */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor", "program_manager"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const stage = searchParams.get("stage");

    const session = await getSession();
    const user = session;
    let sql, args;

    if (ventureId) {
      sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.venture_id = ?`;
      args = [ventureId];
    } else if (stage && (user.role === "super_admin" || user.role === "staff")) {
      // Admin filtering by stage (e.g., meeting_requested)
      sql = `SELECT ip.*, p.name as venture_name, ipr.organization_name, c.name as investor_name, c.email,
                     ipref.industries, ipref.countries, ipref.startup_stages,
                     ipref.ticket_size_min, ipref.ticket_size_max
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id
             LEFT JOIN contacts c ON ipr.user_id = c.cid
             LEFT JOIN investor_preferences ipref ON ipref.investor_id = ipr.id
             WHERE ip.stage = ?
             ORDER BY ip.stage_changed_at DESC`;
      args = [stage];
    } else {
      const profile = await db.execute({
        sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
        args: [user.cid || user.id],
      });
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, pipeline: [] });
      }
      sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.investor_id = ?
             ORDER BY ip.stage_changed_at DESC`;
      args = [profile.rows[0].id];
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, pipeline: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
