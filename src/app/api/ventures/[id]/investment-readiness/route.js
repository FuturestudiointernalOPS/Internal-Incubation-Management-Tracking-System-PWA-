import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { computeRoadmapReadiness } from "@/lib/ventureReadiness";
import {
  getInvestmentReadinessVentureId,
  getVentureInvestmentDocuments,
} from "@/models/ventureJourney";


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
  const ventureResult = await getInvestmentReadinessVentureId(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });


    // Fetch all approved/shared documents for this venture
    const documentsResult = await getVentureInvestmentDocuments(dbId);

    const allDocuments = documentsResult.rows || [];

    // Build the checklist with real document data
    const checklist = REQUIRED_DOCUMENTS.map(req => {
      const mappedCategories = DOC_CATEGORY_MAP[req.key] || ["general"];
      // Find documents matching this category (case-insensitive partial match on name too)
      const matching = allDocuments.filter(documentRow =>
        mappedCategories.some(category => (documentRow.category || "").toLowerCase().includes(category.toLowerCase())) ||
        (documentRow.name || "").toLowerCase().includes(req.key.replace(/_/g, " ")) ||
        (documentRow.name || "").toLowerCase().includes(req.label.toLowerCase())
      );
      const approved = matching.filter(documentRow => documentRow.approval_status === "approved" || documentRow.approval_status === "shared_with_investor");
      const hasAny = matching.length > 0;
      const hasApproved = approved.length > 0;

      return {
        key: req.key,
        label: req.label,
        icon: req.icon,
        status: hasApproved ? "approved" : hasAny ? "submitted" : "missing",
        documents: matching.map(documentRow => ({ name: documentRow.name, status: documentRow.approval_status })),
      };
    });

    const approvedCount = checklist.filter(item => item.status === "approved").length;
    const totalRequired = checklist.length;
    const readinessPercent = Math.round((approvedCount / totalRequired) * 100);
    const isInvestmentReady = readinessPercent === 100;
    const missing = checklist.filter(item => item.status === "missing");
    const submitted = checklist.filter(item => item.status === "submitted");

    // Roadmap-derived readiness (Vinance 3 — Phase 3): computed live over the
    // whole defined Venture progression. Additive cutover — legacy keys above
    // stay untouched so current consumers keep working unchanged.
    const roadmap = await computeRoadmapReadiness(db, { dbId, code: id });

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
      roadmap_readiness: roadmap,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
