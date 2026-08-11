import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];

const PLAYBOOK_STAGES = [
  { stage_order: 1, stage_name: "Complete Venture Profile",
    objective: "Ensure the venture has a complete, professional profile with all required documentation.",
    expected_outcome: "Venture profile is 100% complete with logo, description, founders, and supporting documents.",
    questions: "Is the problem clearly stated? Are the founders credible? Is the business description clear and compelling?",
    evidence: "Completed profile form, uploaded logo, founder bios, venture registration documents.",
    documents: "Company Logo, Executive Summary, Legal Registration Documents",
    mistakes: "Vague business description, missing founder information, no social proof.",
    approval_criteria: "All profile fields completed, at least 1 founder added, logo uploaded, business description > 100 chars." },
  { stage_order: 2, stage_name: "Define the Problem",
    objective: "Ensure founders have clearly articulated and validated the problem they are solving.",
    expected_outcome: "A clear, specific problem statement backed by evidence from potential customers.",
    questions: "Who has this problem? How do you know? How do they solve it today? What is the cost of not solving it?",
    evidence: "Problem statement document, customer interview notes, market research data.",
    documents: "Problem Statement, Customer Interview Notes",
    mistakes: "Too broad or vague problem, no evidence of customer pain, assuming the problem exists.",
    approval_criteria: "Problem statement is specific, at least 3 customer interviews conducted, market size estimated." },
  { stage_order: 3, stage_name: "Validate the Idea",
    objective: "Confirm that the proposed solution resonates with target customers.",
    expected_outcome: "Validated idea with positive feedback from potential customers.",
    questions: "Would you use this? Would you pay for this? How much? What alternatives do you use?",
    evidence: "Validation interviews, survey results, letters of intent, pre-orders.",
    documents: "Customer Validation Report, Survey Results",
    mistakes: "Only asking friends and family, ignoring negative feedback, no pricing validation.",
    approval_criteria: "At least 5 validation interviews with positive signals, pricing validated, key features identified." },
  { stage_order: 4, stage_name: "Identify Target Customers",
    objective: "Define and understand the primary customer segments.",
    expected_outcome: "Clear customer personas with demographics, behaviors, and pain points.",
    questions: "Who is your ideal first customer? What is their daily workflow? Where do they hang out online?",
    evidence: "Customer personas, segmentation analysis, TAM/SAM/SOM calculations.",
    documents: "Customer Personas, Market Segmentation",
    mistakes: "Targeting everyone, no specific persona, ignoring early adopter profile.",
    approval_criteria: "At least 2 detailed customer personas, market size calculated, acquisition channels identified." },
  { stage_order: 5, stage_name: "Develop Business Model Canvas",
    objective: "Map out a viable business model using the Business Model Canvas framework.",
    expected_outcome: "Complete BMC with all 9 blocks filled and internally consistent.",
    questions: "How will you make money? Who are key partners? What are key activities and resources?",
    evidence: "Completed Business Model Canvas, revenue model analysis, cost structure breakdown.",
    documents: "Business Model Canvas, Financial Projection",
    mistakes: "Unrealistic revenue projections, ignoring key costs, no clear value proposition.",
    approval_criteria: "All 9 BMC blocks filled, revenue model is clear, cost structure is realistic." },
  { stage_order: 6, stage_name: "Define Value Proposition",
    objective: "Articulate a compelling and differentiated value proposition.",
    expected_outcome: "Clear value proposition that resonates with target customers.",
    questions: "What makes you different? Why should customers choose you? What is your unfair advantage?",
    evidence: "Value proposition canvas, competitive analysis, customer testimonials.",
    documents: "Value Proposition Canvas, Competitive Analysis",
    mistakes: "Generic value prop, no differentiation, feature-focused instead of benefit-focused.",
    approval_criteria: "Value prop is specific and differentiated, competitive advantages identified, customer quotes support claims." },
  { stage_order: 7, stage_name: "Conduct Market Research",
    objective: "Research the market landscape, competitors, and trends.",
    expected_outcome: "Comprehensive understanding of market size, competition, and positioning.",
    questions: "Who are your competitors? What is the market trend? What is your market share potential?",
    evidence: "Competitor matrix, market size analysis, industry reports.",
    documents: "Market Research Report, Competitor Analysis",
    mistakes: "Ignoring indirect competitors, overestimating market size, no differentiation strategy.",
    approval_criteria: "At least 3 competitors analyzed, market size validated, positioning strategy defined." },
  { stage_order: 8, stage_name: "Build Brand Identity",
    objective: "Create a professional brand identity that resonates with the target market.",
    expected_outcome: "Complete brand kit with name, logo, colors, and brand guidelines.",
    questions: "What does your brand represent? What emotions should it evoke? Is the name available?",
    evidence: "Brand guidelines, logo variations, color palette, typography, brand story.",
    documents: "Branding Assets, Brand Guidelines",
    mistakes: "Copying competitors, unprofessional design, no brand consistency.",
    approval_criteria: "Logo finalized, brand colors defined, brand story written, name legally available." },
  { stage_order: 9, stage_name: "Prepare Pitch Deck",
    objective: "Create a compelling investor-ready pitch deck.",
    expected_outcome: "Professional pitch deck covering problem, solution, market, traction, team, and ask.",
    questions: "Does the story flow? Are key metrics highlighted? Is the ask clear?",
    evidence: "Pitch deck PDF, pitch video or recording, investor feedback.",
    documents: "Pitch Deck PDF, Pitch Deck URL",
    mistakes: "Too many slides, no clear ask, hiding weaknesses, no traction data.",
    approval_criteria: "10-15 slides covering all key sections, clear ask, compelling narrative, professional design." },
  { stage_order: 10, stage_name: "Develop Go-to-Market Strategy",
    objective: "Plan the launch and customer acquisition strategy.",
    expected_outcome: "Detailed GTM plan with channels, timeline, and budget.",
    questions: "How will you acquire your first 100 customers? What channels? What is your CAC?",
    evidence: "GTM strategy document, channel analysis, marketing plan, sales playbook.",
    documents: "Go-to-Market Strategy, Product Roadmap",
    mistakes: "No clear acquisition channel, unrealistic growth targets, ignoring retention.",
    approval_criteria: "At least 3 acquisition channels identified, CAC estimated, launch timeline defined." },
  { stage_order: 11, stage_name: "Build MVP",
    objective: "Create a functional minimum viable product for testing.",
    expected_outcome: "Working MVP with core features that can be tested with real users.",
    questions: "What is the minimum feature set? What can be cut? How will you measure success?",
    evidence: "Working MVP, user testing results, feature prioritization matrix.",
    documents: "Product Roadmap, MVP Specification",
    mistakes: "Building too much, no user testing, ignoring technical debt completely.",
    approval_criteria: "Core features working, at least 5 users tested, feedback collected and analyzed." },
  { stage_order: 12, stage_name: "Acquire First Customers",
    objective: "Get first paying customers and validate willingness to pay.",
    expected_outcome: "At least 10 paying customers with positive feedback.",
    questions: "How many paying customers? What is the conversion rate? What is churn?",
    evidence: "Customer list, revenue data, testimonials, usage metrics.",
    documents: "Customer Validation Report, Revenue Reports",
    mistakes: "Free users only, no payment validation, high churn ignored.",
    approval_criteria: "At least 10 paying customers, revenue > $0, churn < 10% monthly." },
  { stage_order: 13, stage_name: "Validate Product-Market Fit",
    objective: "Confirm strong product-market fit with quantitative and qualitative evidence.",
    expected_outcome: "Clear PMF signals: high retention, word-of-mouth growth, strong NPS.",
    questions: "Would users be very disappointed without your product? Is growth organic?",
    evidence: "NPS survey, retention cohort analysis, referral data, user testimonials.",
    documents: "PMF Assessment, Customer Metrics",
    mistakes: "Confusing early adopters with PMF, ignoring churn, no quantitative metrics.",
    approval_criteria: "NPS > 40, retention > 60% after 30 days, organic growth evidence, PMF assessment completed." },
  { stage_order: 14, stage_name: "Prepare Investment Readiness",
    objective: "Organize all required documents and data for investor due diligence.",
    expected_outcome: "Complete data room with all required documents approved and organized.",
    questions: "Is your data room complete? Are financials ready? Is your team complete?",
    evidence: "Data room, financial models, legal documents, cap table, team bios.",
    documents: "Pitch Deck, Business Model Canvas, Financial Projection, Customer Validation Report, Go-to-Market Strategy, Branding Assets, Team Information, Legal Registration Documents",
    mistakes: "Incomplete data room, unrealistic projections, messy cap table, missing legal docs.",
    approval_criteria: "All 8 required documents uploaded and approved, financial projections reviewed, legal docs verified." },
  { stage_order: 15, stage_name: "Become Investment Ready",
    objective: "Final verification that the venture is ready for investor introductions.",
    expected_outcome: "Investment ready status confirmed, venture visible to investors.",
    questions: "Are you ready to pitch investors? Is your team complete? Are all documents approved?",
    evidence: "All checkmarks on investment checklist, mentor sign-off, final pitch practice.",
    documents: "All required documents approved, Investment Readiness Checklist",
    mistakes: "Rushing before ready, incomplete documents, untested pitch, weak team.",
    approval_criteria: "All previous stages completed, all 8 investment documents approved, mentor final sign-off." },
];

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
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    // Ensure table exists
    await db.execute({ sql: `CREATE TABLE IF NOT EXISTS venture_facilitator_playbook (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      stage_order INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      objective TEXT,
      expected_outcome TEXT,
      questions TEXT,
      evidence TEXT,
      documents TEXT,
      mistakes TEXT,
      approval_criteria TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )` });

    // Seed if empty
    const existing = await db.execute({ sql: "SELECT COUNT(*) as c FROM venture_facilitator_playbook WHERE venture_id = ?", args: [dbId] });
    if (parseInt(existing.rows?.[0]?.c || 0) === 0) {
      for (const s of PLAYBOOK_STAGES) {
        await db.execute({
          sql: "INSERT INTO venture_facilitator_playbook (venture_id, stage_order, stage_name, objective, expected_outcome, questions, evidence, documents, mistakes, approval_criteria) VALUES (?,?,?,?,?,?,?,?,?,?)",
          args: [dbId, s.stage_order, s.stage_name, s.objective, s.expected_outcome, s.questions, s.evidence, s.documents, s.mistakes, s.approval_criteria],
        });
      }
    }

    const entries = await db.execute({
      sql: "SELECT * FROM venture_facilitator_playbook WHERE venture_id = ? ORDER BY stage_order ASC",
      args: [dbId],
    });

    return NextResponse.json({ success: true, playbook: entries.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
