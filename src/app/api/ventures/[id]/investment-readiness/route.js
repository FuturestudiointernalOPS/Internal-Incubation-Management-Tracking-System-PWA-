import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];

const REQUIRED_DOCUMENTS = [
  { key: "pitch_deck", label: "Pitch Deck", icon: "📊" },
  { key: "business_model_canvas", label: "Business Model Canvas", icon: "📋" },
  { key: "financial_projection", label: "Financial Projection", icon: "💰" },
  { key: "customer_validation", label: "Customer Validation Report", icon: "🔍" },
  { key: "goto_market", label: "Go-to-Market Strategy", icon: "🚀" },
  { key: "branding", label: "Branding Assets", icon: "🎨" },
  { key: "team_info", label: "Team Information", icon: "👥" },
  { key: "company_docs", label: "Company Documents", icon: "📁" },
];

const DOC_CATEGORY_MAP = {
  pitch_deck: ["pitch_deck", "investment"],
  business_model_canvas: ["business"],
  financial_projection: ["financial", "investment"],
  customer_validation: ["investment", "general"],
  goto_market: ["investment", "business"],
  branding: ["brand", "marketing"],
  team_info: ["general", "legal"],
  company_docs: ["legal", "general"],
};

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    // Fetch all approved/shared documents for this venture
    const docs = await db.execute({
      sql: "SELECT name, category, approval_status FROM venture_documents WHERE venture_id = ? AND is_deleted = false ORDER BY approval_status, name",
      args: [dbId],
    });

    const allDocs = docs.rows || [];

    // Build the checklist with real document data
    const checklist = REQUIRED_DOCUMENTS.map(req => {
      const mappedCategories = DOC_CATEGORY_MAP[req.key] || ["general"];
      // Find documents matching this category (case-insensitive partial match on name too)
      const matching = allDocs.filter(d => 
        mappedCategories.some(cat => (d.category || "").toLowerCase().includes(cat.toLowerCase())) ||
        (d.name || "").toLowerCase().includes(req.key.replace(/_/g, " ")) ||
        (d.name || "").toLowerCase().includes(req.label.toLowerCase())
      );
      const approved = matching.filter(d => d.approval_status === "approved" || d.approval_status === "shared_with_investor");
      const hasAny = matching.length > 0;
      const hasApproved = approved.length > 0;

      return {
        key: req.key,
        label: req.label,
        icon: req.icon,
        status: hasApproved ? "approved" : hasAny ? "submitted" : "missing",
        documents: matching.map(d => ({ name: d.name, status: d.approval_status })),
      };
    });

    const approvedCount = checklist.filter(d => d.status === "approved").length;
    const totalRequired = checklist.length;
    const readinessPercent = Math.round((approvedCount / totalRequired) * 100);
    const isInvestmentReady = readinessPercent === 100;
    const missing = checklist.filter(d => d.status === "missing");
    const submitted = checklist.filter(d => d.status === "submitted");

    return NextResponse.json({
      success: true,
      investment_readiness: {
        checklist,
        approved_count: approvedCount,
        total_required: totalRequired,
        readiness_percent: readinessPercent,
        is_investment_ready: isInvestmentReady,
        missing_documents: missing,
        submitted_documents: submitted,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
