import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
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
    const start = Date.now();

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

    // ── Notifications ──
    const notifications = (async () => {
      try {
        const res = await db.execute({
          sql: `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id = ? OR recipient_id = 'sa'
                ORDER BY created_at DESC LIMIT 10`,
          args: [id],
        });
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

    // ── Documents (from any venture module) ──
    const documents = (async () => {
      try {
        const [profileDocs, verifDocs] = await Promise.all([
          db.execute({
            sql: "SELECT id, document_type as category, file_name, file_type, file_size, uploaded_at FROM startup_profile_documents WHERE venture_id = ? ORDER BY uploaded_at DESC LIMIT 5",
            args: [id],
          }).catch(() => ({ rows: [] })),
          db.execute({
            sql: `SELECT vvd.id, vvd.category, vvd.file_name, vvd.file_type, vvd.file_size, vvd.uploaded_at
                  FROM venture_verification_documents vvd
                  JOIN venture_verifications vv ON vvd.verification_id = vv.id
                  WHERE vv.venture_id = ? ORDER BY vvd.uploaded_at DESC LIMIT 5`,
            args: [id],
          }).catch(() => ({ rows: [] })),
        ]);
        return {
          total: (profileDocs.rows?.length || 0) + (verifDocs.rows?.length || 0),
          recent: [...(profileDocs.rows || []), ...(verifDocs.rows || [])]
            .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
            .slice(0, 5),
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

    // ── KPI Summary (placeholder — integrates with KPIs module) ──
    const kpiSummary = (async () => {
      try {
        const res = await db.execute({
          sql: `SELECT id, title, category, current_value, target_value, unit, status
                FROM kpis WHERE venture_id = ? ORDER BY updated_at DESC LIMIT 5`,
          args: [id],
        }).catch(() => ({ rows: [] }));
        return (res.rows || []).map((k) => ({
          id: k.id, title: k.title, category: k.category,
          current: k.current_value, target: k.target_value,
          unit: k.unit, status: k.status,
          progress: k.target_value > 0 ? Math.round((k.current_value / k.target_value) * 100) : 0,
        }));
      } catch { return []; }
    })();

    // ── Coaching / Advisors (placeholder) ──
    const coaching = (async () => {
      try {
        const res = await db.execute({
          sql: `SELECT c.cid, c.name, c.email, vmf.role as assignment_role
                FROM venture_members vm
                JOIN contacts c ON vm.user_cid = c.cid
                LEFT JOIN venture_member_functions vmf ON vm.id = vmf.member_id
                WHERE vm.venture_id = ? AND vmf.function_type IN ('coach', 'advisor', 'mentor')
                LIMIT 10`,
          args: [id],
        }).catch(() => ({ rows: [] }));
        const members = res.rows || [];
        return {
          coaches: members.filter((m) => m.assignment_role !== "advisor"),
          advisors: members.filter((m) => m.assignment_role === "advisor"),
          total: members.length,
        };
      } catch { return { coaches: [], advisors: [], total: 0 }; }
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
