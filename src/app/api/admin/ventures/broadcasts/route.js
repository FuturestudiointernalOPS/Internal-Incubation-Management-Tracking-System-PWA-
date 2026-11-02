import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import {
  selectActiveBroadcasts,
  selectAllBroadcasts,
  insertVentureBroadcast,
  updateBroadcastStatus,
  checkVentureSubmissionForRun,
} from "@/models/ventureBroadcastStore";
import { sendEmail } from "@/lib/email/send";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ventures/broadcasts
 * Returns active or all broadcasts, with completion counts.
 * Also handles: ?venture_id=VNT-XXX to check active broadcast for that venture.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const mode = searchParams.get("mode");

    // If querying for a specific venture (e.g. founder dashboard check)
    if (ventureId) {
      const activeBroadcastsRes = await selectActiveBroadcasts();
      const broadcasts = activeBroadcastsRes.rows || [];
      if (broadcasts.length === 0) {
        return NextResponse.json({ success: true, activeBroadcast: null });
      }

      // Check the latest active broadcast
      const latest = broadcasts[0];
      // Check scope
      let isTargeted = false;
      if (latest.target_scope === "all") {
        isTargeted = true;
      } else if (latest.target_scope === "custom") {
        const targetIds = Array.isArray(latest.target_venture_ids) ? latest.target_venture_ids : [];
        isTargeted = targetIds.includes(ventureId) || targetIds.includes(String(ventureId));
      } else if (latest.target_scope === "segment" && latest.target_segment) {
        // Query venture program_type or stage
        const vRes = await db.execute({
          sql: "SELECT program_type, stage FROM ventures WHERE id::text = ? OR vnt_id = ? LIMIT 1",
          args: [ventureId, ventureId],
        });
        const v = vRes.rows[0];
        if (v && (v.program_type === latest.target_segment || v.stage === latest.target_segment)) {
          isTargeted = true;
        }
      }

      if (!isTargeted) {
        return NextResponse.json({ success: true, activeBroadcast: null });
      }

      // Check if already submitted
      const subRes = await checkVentureSubmissionForRun(latest.form_run_id, latest.form_run_slug, ventureId);
      const isSubmitted = subRes.rows.length > 0;

      return NextResponse.json({
        success: true,
        activeBroadcast: isSubmitted ? null : latest,
        isSubmitted,
      });
    }

    // Otherwise, admin listing
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const broadcastsRes = mode === "all" ? await selectAllBroadcasts() : await selectActiveBroadcasts();
    const broadcasts = broadcastsRes.rows || [];

    // Calculate submission stats for each broadcast
    const enriched = await Promise.all(
      broadcasts.map(async (b) => {
        try {
          const statsRes = await db.execute({
            sql: `SELECT COUNT(DISTINCT COALESCE(venture_id, data->>'venture_id', data->>'Startup Name', submitter_name)) as submitted_count
                  FROM platform_form_submissions
                  WHERE (run_id = ? OR run_id IN (SELECT id FROM platform_form_runs WHERE public_slug = ?))
                    AND status != 'draft'`,
            args: [b.form_run_id || -1, b.form_run_slug],
          });
          return {
            ...b,
            submitted_count: parseInt(statsRes.rows[0]?.submitted_count) || 0,
          };
        } catch (_) {
          return { ...b, submitted_count: 0 };
        }
      })
    );

    return NextResponse.json({ success: true, broadcasts: enriched });
  } catch (err) {
    console.error("[Broadcast API] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/ventures/broadcasts
 * Creates a new broadcast and optionally triggers emails to lead founders.
 */
export async function POST(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      link, // e.g. "https://impactos.futurestudio.bj/s/r619232621d" or "r619232621d"
      target_scope = "all", // "all", "segment", "custom"
      target_segment = null,
      target_venture_ids = [],
      message = null,
      button_text = "Complete Census",
      send_email = false,
    } = body;

    if (!link) {
      return NextResponse.json({ success: false, error: "Link is required" }, { status: 400 });
    }

    // Extract slug from link
    let slug = link.trim();
    if (slug.includes("/s/")) {
      slug = slug.split("/s/")[1].split("?")[0].replace(/\/$/, "");
    }

    // Find run_id from slug
    const runRes = await db.execute({
      sql: "SELECT id, name FROM platform_form_runs WHERE public_slug = ? LIMIT 1",
      args: [slug],
    });
    const runId = runRes.rows[0]?.id || null;
    const broadcastTitle = title || runRes.rows[0]?.name || "Venture Performance Census";

    // Insert broadcast
    const insertRes = await insertVentureBroadcast({
      title: broadcastTitle,
      form_run_slug: slug,
      form_run_id: runId,
      target_scope,
      target_segment,
      target_venture_ids,
      message,
      button_text,
      created_by: session.cid || session.email || "super_admin",
    });

    const broadcast = insertRes.rows[0];

    // Optional email blast to lead founders
    let emailStats = { sent: 0, failed: 0, recipients: [] };
    if (send_email) {
      // Find eligible ventures
      let venturesSql = `
        SELECT v.id, v.name, v.vnt_id, v.program_type, v.stage,
               c.name as founder_name, c.email as founder_email
        FROM ventures v
        LEFT JOIN LATERAL (
          SELECT vm.contact_id
          FROM venture_members vm
          WHERE vm.venture_id::text = v.id::text
            AND (vm.lead_founder = TRUE OR vm.member_type = 'founder')
            AND vm.removed_at IS NULL
          ORDER BY vm.lead_founder DESC, vm.id ASC
          LIMIT 1
        ) lead_mem ON true
        LEFT JOIN contacts c ON lead_mem.contact_id = c.cid
        WHERE v.status = 'active'
      `;
      const vRes = await db.execute({ sql: venturesSql, args: [] });
      let ventures = vRes.rows || [];

      // Filter by scope
      if (target_scope === "custom") {
        ventures = ventures.filter(
          (v) => target_venture_ids.includes(String(v.id)) || target_venture_ids.includes(String(v.vnt_id))
        );
      } else if (target_scope === "segment" && target_segment) {
        ventures = ventures.filter(
          (v) => v.program_type === target_segment || v.stage === target_segment
        );
      }

      const origin = process.env.NEXT_PUBLIC_APP_URL || "https://impactos.futurestudio.bj";

      for (const venture of ventures) {
        if (!venture.founder_email || !venture.founder_email.includes("@")) continue;

        const magicLink = `${origin}/s/${slug}?venture_id=${encodeURIComponent(
          venture.vnt_id || venture.id
        )}&name=${encodeURIComponent(venture.name)}`;

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 20px;">
            <div style="background-color: #0f172a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
              <h1 style="color: #ffffff; font-size: 20px; margin: 0;">Future Studio — Venture Census</h1>
            </div>
            <p>Dear <strong>${venture.founder_name || "Founder"}</strong>,</p>
            <p>As part of Future Studio's commitment to supporting <strong>${venture.name}</strong> and showcasing our portfolio's impact to partners and investors, we invite you to complete the periodic performance census.</p>
            ${message ? `<div style="background: #f8fafc; border-left: 4px solid #f97316; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><p style="margin: 0; color: #334155; font-style: italic;">${message}</p></div>` : ""}
            <div style="text-align: center; margin: 32px 0;">
              <a href="${magicLink}" style="background-color: #f97316; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                ${button_text || "Complete Census for " + venture.name}
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px;">This link is customized for ${venture.name}. Any sections not yet applicable to your stage (such as funding or revenue) can simply be marked as N/A or left blank.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center;">Future Studio ImpactOS · Port-Novo & Cotonou, Benin</p>
          </div>
        `;

        try {
          const res = await sendEmail({
            to: venture.founder_email,
            subject: `Action Required: Future Studio Census for ${venture.name}`,
            html: emailHtml,
          });
          if (res?.success) {
            emailStats.sent++;
            emailStats.recipients.push(venture.name);
          } else {
            emailStats.failed++;
          }
        } catch (e) {
          console.warn("[Broadcast Email] Failed for", venture.founder_email, e.message);
          emailStats.failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      broadcast,
      emailStats,
    });
  } catch (err) {
    console.error("[Broadcast API] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/ventures/broadcasts
 * Toggle active status of a broadcast.
 */
export async function PATCH(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id, is_active } = await req.json();
    const updateRes = await updateBroadcastStatus(id, is_active);
    return NextResponse.json({ success: true, broadcast: updateRes.rows[0] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
