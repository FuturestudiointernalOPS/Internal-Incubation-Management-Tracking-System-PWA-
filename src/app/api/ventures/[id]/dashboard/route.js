import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { getSession } from "@/lib/auth";
import {
  getOrCreateStartupProfile,
  getOrCreateVerification,
  listFounders,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/dashboard
 *
 * Aggregates all venture dashboard data.
 * Each widget section loads independently — if one fails, others still return.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const start = Date.now();

    // Resolve the internal id (UUID-lineage tables key on it, not the VNT code)
    let dbId = id;
    try {
      const vRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
      if (vRes.rows[0]) dbId = vRes.rows[0].id;
    } catch (_) {}

    // ── Profile Completion ──
    const profileCompletion = (async () => {
      try {
        const data = await getOrCreateStartupProfile(id);
        const items = [
          { step: 1, name: "Startup Identity", completed: !!data.profile?.step_1_data?.startup_name },
          { step: 2, name: "Business Information", completed: !!data.profile?.step_2_data?.legal_structure },
          { step: 3, name: "Founder Information", completed: Array.isArray(data.profile?.step_3_data?.founders) && data.profile.step_3_data.founders.length > 0 },
          { step: 4, name: "Team Information", completed: !!data.profile?.step_4_data?.team_size },
          { step: 5, name: "Supporting Documents", completed: data.documents?.length > 0 },
          { step: 6, name: "Review & Submit", completed: data.profile?.is_submitted },
        ];
        return {
          percentage: data.completion_percentage || 0,
          is_submitted: data.profile?.is_submitted || false,
          items,
          missing: items.filter((i) => !i.completed).map((i) => i.name),
        };
      } catch { return null; }
    })();

    // ── Venture Info ──
    const ventureInfo = (async () => {
      try {
        const res = await db.execute({
          sql: "SELECT company_name, venture_id, industry, business_stage, status, created_at, description, website, logo_url, registration_number FROM ventures WHERE venture_id = ?",
          args: [id],
        });
        return res.rows[0] || null;
      } catch { return null; }
    })();

    // ── Founders / Team ──
    const foundersData = (async () => {
      try {
        const founders = await listFounders(id);
        const owner = founders.find((f) => f.is_owner);
        return {
          total: founders.length,
          active: founders.filter((f) => f.status === "accepted" && !f.suspended_at).length,
          pending: founders.filter((f) => f.status === "pending").length,
          suspended: founders.filter((f) => !!f.suspended_at).length,
          owner: owner ? { name: owner.name, email: owner.email } : null,
          founders: founders.map((f) => ({
            id: f.id, name: f.name, email: f.email, role: f.role,
            role_label: f.role_label, status: f.status, is_owner: !!f.is_owner,
            is_suspended: !!f.suspended_at,
          })),
        };
      } catch { return null; }
    })();

    // ── Notifications (recipients = the venture's members, not the VNT code) ──
    const notifications = (async () => {
      try {
        const memberRes = await db.execute({
          sql: "SELECT contact_id, user_cid FROM venture_members WHERE venture_id = ? AND removed_at IS NULL",
          args: [id],
        });
        const recipientIds = [...new Set((memberRes.rows || []).flatMap((r) => [r.contact_id, r.user_cid]).filter(Boolean))];
        let sql, args;
        if (recipientIds.length > 0) {
          sql = `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id IN (${recipientIds.map(() => "?").join(", ")}) OR recipient_id = 'sa'
                ORDER BY created_at DESC LIMIT 10`;
          args = recipientIds;
        } else {
          sql = `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id = 'sa'
                ORDER BY created_at DESC LIMIT 10`;
          args = [];
        }
        const res = await db.execute({ sql, args });
        const notifs = res.rows || [];
        return {
          unread: notifs.filter((n) => !n.is_read).length,
          recent: notifs.slice(0, 5).map((n) => ({
            id: n.id, title: n.title, message: n.message, type: n.type,
            is_read: !!n.is_read, created_at: n.created_at,
          })),
        };
      } catch { return null; }
    })();

    // ── Recent Activity ──
    const recentActivity = (async () => {
      try {
        const res = await db.execute({
          sql: `SELECT id, action, actor_name, details, created_at
                FROM venture_activity_log WHERE venture_id = ?
                ORDER BY created_at DESC LIMIT 10`,
          args: [id],
        });
        return (res.rows || []).map((a) => ({
          id: a.id, action: a.action, actor: a.actor_name || "System",
          details: a.details, created_at: a.created_at,
        }));
      } catch { return null; }
    })();

    // ── Verification Status ──
    const verification = (async () => {
      try {
        const data = await getOrCreateVerification(id);
        const items = data.items.map((i) => ({
          category: i.category,
          label: i.category_label,
          status: i.status,
        }));
        return {
          status: data.verification.status,
          categories: items,
          verified_count: items.filter((i) => i.status === "verified").length,
          total_count: items.length,
        };
      } catch { return null; }
    })();

    // ── Documents (the real data room) ──
    const documents = (async () => {
      try {
        let rows = [];
        try {
          const res = await db.execute({
            sql: "SELECT id, title, category, file_name, file_type, file_size, uploaded_by, created_at FROM venture_documents WHERE venture_id = ? AND is_deleted = false ORDER BY created_at DESC LIMIT 5",
            args: [id],
          });
          rows = res.rows || [];
        } catch (_) {
          const res = await db.execute({
            sql: "SELECT id, title, category, file_name, file_type, file_size, uploaded_by, created_at FROM venture_documents WHERE venture_id = ? ORDER BY created_at DESC LIMIT 5",
            args: [id],
          });
          rows = res.rows || [];
        }
        return {
          total: rows.length,
          recent: rows,
        };
      } catch { return null; }
    })();

    // ── Meetings (placeholder — integrates with calendar/events module) ──
    const meetings = (async () => {
      try {
        const res = await db.execute({
          sql: `SELECT id, title, description, event_date, event_time, status, type
                FROM calendar_events WHERE venture_id = ? AND event_date >= CURRENT_DATE
                ORDER BY event_date ASC LIMIT 5`,
          args: [id],
        }).catch(() => ({ rows: [] }));
        return (res.rows || []).map((m) => ({
          id: m.id, title: m.title, description: m.description,
          date: m.event_date, time: m.event_time, status: m.status, type: m.type || "meeting",
        }));
      } catch { return []; }
    })();

    // ── KPI Summary (the venture KPI module, not the global kpis table) ──
    const kpiSummary = (async () => {
      try {
        const res = await db.execute({
          sql: `SELECT d.name, d.unit, d.auto_calc_source, a.target_value, a.current_value, a.updated_at
                FROM venture_kpi_assignments a
                JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
                WHERE a.venture_id::text = ?
                ORDER BY a.updated_at DESC LIMIT 5`,
          args: [dbId],
        }).catch(() => ({ rows: [] }));
        return (res.rows || []).map((k) => ({
          id: k.id, title: k.name, category: k.auto_calc_source || "manual",
          current: k.current_value, target: k.target_value,
          unit: k.unit, status: k.auto_calc_source ? "auto" : "manual",
          progress: k.target_value > 0 ? Math.round((k.current_value / k.target_value) * 100) : 0,
        }));
      } catch { return []; }
    })();

    // ── Coaching / Advisors (real sources) ──
    const coaching = (async () => {
      try {
        const [advisorRes, sessionRes, assignmentRes] = await Promise.all([
          db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_advisors WHERE venture_id::text = ?", args: [dbId] }).catch(() => ({ rows: [{ n: 0 }] })),
          db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_coaching_sessions WHERE venture_id::text = ?", args: [dbId] }).catch(() => ({ rows: [{ n: 0 }] })),
          db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_coach_assignments WHERE venture_id::text = ? AND status = 'active'", args: [dbId] }).catch(() => ({ rows: [{ n: 0 }] })),
        ]);
        const coaches = Number(assignmentRes.rows?.[0]?.n || 0);
        const advisors = Number(advisorRes.rows?.[0]?.n || 0);
        const sessions = Number(sessionRes.rows?.[0]?.n || 0);
        return { coaches, advisors, coaching_sessions: sessions, total: coaches + advisors };
      } catch { return { coaches: [], advisors: [], coaching_sessions: 0, total: 0 }; }
    })();

    // ── Investment Readiness (calculated from profile completeness + stage) ──
    const investmentReadiness = (async () => {
      try {
        const [venture, profile] = await Promise.all([ventureInfo, profileCompletion]);
        const stage = venture?.business_stage || "idea";
        const stageScores = { idea: 10, validation: 25, early_traction: 45, growth: 65, scaling: 85 };
        const stageScore = stageScores[stage] || 10;
        const profileScore = profile?.percentage || 0;
        const score = Math.min(Math.round((stageScore * 0.4) + (profileScore * 0.6)), 100);
        const nextMilestones = [];
        if (!profile?.is_submitted) nextMilestones.push("Complete Startup Profile");
        if (!profile?.items?.[4]?.completed) nextMilestones.push("Upload Supporting Documents");
        return { score, stage, stage_weight: stageScore, profile_weight: profileScore, next_milestones: nextMilestones };
      } catch { return { score: 0, stage: "unknown", next_milestones: [] }; }
    })();

    // ── Wait for all (with individual error handling) ──
    const [
      profileResult,
      ventureResult,
      foundersResult,
      notifResult,
      activityResult,
      verifResult,
      docsResult,
      meetingsResult,
      kpiResult,
      coachingResult,
      investmentResult,
    ] = await Promise.all([
      profileCompletion, ventureInfo, foundersData, notifications,
      recentActivity, verification, documents, meetings, kpiSummary, coaching, investmentReadiness,
    ]);

    const duration = Date.now() - start;

    return NextResponse.json({
      success: true,
      dashboard: {
        profile_completion: profileResult,
        venture: ventureResult,
        founders: foundersResult,
        notifications: notifResult,
        recent_activity: activityResult,
        verification: verifResult,
        documents: docsResult,
        meetings: meetingsResult,
        kpis: kpiResult,
        coaching: coachingResult,
        investment_readiness: investmentResult,
      },
      meta: { duration_ms: duration, generated_at: new Date().toISOString() },
    });
  },
);
