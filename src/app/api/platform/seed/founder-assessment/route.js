import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/platform/seed/founder-assessment
 *
 * One-click seed of the Founder Fit Score Assessment form.
 * Idempotent — re-running updates the existing form.
 * Only super_admin can trigger.
 */

const RATING_OPTIONS = [
  { label: "1 - Strongly Disagree", value: "1" },
  { label: "2 - Disagree", value: "2" },
  { label: "3 - Neutral", value: "3" },
  { label: "4 - Agree", value: "4" },
  { label: "5 - Strongly Agree", value: "5" },
];

function ratingField(label, sort) {
  return { field_type: "rating", label, required: true, options: RATING_OPTIONS, settings: { scored: true }, sort_order: sort };
}

const SCORED_SECTIONS = [
  {
    title: "Founder Motivation", weight: 10,
    questions: [
      "I clearly understand the problem I am solving.",
      "I am passionate about the industry I am building in.",
      "My motivation goes beyond financial gain.",
      "I have a strong desire to create meaningful impact.",
      "I am willing to dedicate the next 5+ years to this venture.",
      "I have a clear vision of where I want my company to be in 3 years.",
      "I am building a solution for a problem I have personally experienced.",
      "I stay motivated despite setbacks and challenges.",
      "I actively seek opportunities to learn and grow as a founder.",
      "I am building this startup for the right reasons.",
    ],
  },
  {
    title: "Leadership", weight: 15,
    questions: [
      "I am comfortable making difficult decisions under pressure.",
      "I communicate my vision clearly to my team.",
      "I actively listen to team members and value their input.",
      "I take full ownership of both successes and failures.",
      "I hold myself and my team accountable for results.",
      "I handle conflicts constructively and fairly.",
      "I am aware of how my emotions affect my decision-making.",
      "I can motivate others even during difficult periods.",
      "I delegate tasks effectively rather than trying to do everything.",
      "I invest time in developing the skills of my team members.",
    ],
  },
  {
    title: "Business Understanding", weight: 20,
    questions: [
      "I have conducted thorough customer discovery interviews.",
      "I understand my target customer's pain points deeply.",
      "I can clearly articulate my unique value proposition.",
      "I have analyzed my competitors and understand their strengths and weaknesses.",
      "I have a validated revenue model for my business.",
      "I understand the unit economics of my business.",
      "I have a clear go-to-market strategy.",
      "I regularly gather and act on customer feedback.",
      "I understand the regulatory environment of my industry.",
      "I can identify market trends that affect my business.",
      "I have a sustainable competitive advantage.",
      "I understand the sales cycle and customer acquisition costs.",
    ],
  },
  {
    title: "Execution Capability", weight: 20,
    questions: [
      "I consistently meet deadlines and deliver on commitments.",
      "I prioritize effectively and focus on high-impact activities.",
      "I break large goals into actionable milestones.",
      "I am comfortable working with limited resources.",
      "I adapt quickly when circumstances change.",
      "I actively experiment and iterate based on results.",
      "I learn from failures and apply those lessons.",
      "I can work productively without external accountability.",
      "I have a track record of completing what I start.",
      "I manage my time and energy effectively.",
    ],
  },
  {
    title: "Innovation", weight: 10,
    questions: [
      "I regularly generate creative solutions to problems.",
      "My product or service is significantly different from existing solutions.",
      "I deeply understand my users' needs and experiences.",
      "I can envision how my industry will evolve in the next 5 years.",
      "I actively seek inspiration from other industries.",
      "I am willing to challenge conventional wisdom in my field.",
      "I prototype and test ideas quickly rather than over-planning.",
      "I see opportunities where others see obstacles.",
    ],
  },
  {
    title: "Financial Literacy", weight: 10,
    questions: [
      "I can create and maintain a basic business budget.",
      "I understand the difference between revenue, profit, and cash flow.",
      "I know my current burn rate and runway.",
      "I understand the key financial metrics for my business.",
      "I can project revenue and expenses for the next 12 months.",
      "I understand what investors look for in financial projections.",
      "I am disciplined about tracking income and expenses.",
      "I understand different funding options available to startups.",
    ],
  },
  {
    title: "Coachability", weight: 10,
    questions: [
      "I actively seek feedback on my ideas and performance.",
      "When given feedback, I implement it rather than defend against it.",
      "I acknowledge when I do not know something.",
      "I learn from people with more experience than me.",
      "I am open to changing my approach based on new information.",
      "I ask thoughtful questions and listen to understand.",
      "I can accept criticism without becoming defensive.",
      "I view mentorship as essential to my growth.",
    ],
  },
  {
    title: "Commitment", weight: 5,
    questions: [
      "I work on my startup full-time or am transitioning to full-time.",
      "I have made significant personal sacrifices for my startup.",
      "I am committed to this venture for the long term (5+ years).",
      "I continue working on my startup despite facing rejection.",
      "I am willing to take calculated risks to grow my business.",
      "I invest my own resources (time, money) into the venture.",
      "I have turned down other opportunities to focus on this startup.",
      "My commitment to this venture is unwavering.",
    ],
  },
];

export async function POST() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    // ── Upsert Collection ──
    const collRes = await db.execute({
      sql: `INSERT INTO platform_collections (name, slug, description, status, visibility, tags, category, color, created_by)
            VALUES ('Founder Assessments', 'founder-assessments', 'Standardized founder evaluation assessments for incubation and acceleration programs', 'active', 'internal', ARRAY['assessment','founder','scoring','evaluation'], 'Assessment', '#FF6600', 'system')
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, updated_at = NOW()
            RETURNING id`,
      args: [],
    });
    const collectionId = collRes.rows[0].id;

    // ── Build scoring config ──
    const scoringSections = {};
    for (const sec of SCORED_SECTIONS) {
      scoringSections[sec.title] = { weight: sec.weight, field_labels: sec.questions };
    }

    const formSettings = {
      scoring: {
        enabled: true,
        sections: scoringSections,
        rankings: [
          { min: 90, max: 100, label: "Outstanding", color: "#10b981" },
          { min: 80, max: 89, label: "High Potential", color: "#3b82f6" },
          { min: 70, max: 79, label: "Promising", color: "#f59e0b" },
          { min: 60, max: 69, label: "Needs Development", color: "#f97316" },
          { min: 0, max: 59, label: "Not Yet Ready", color: "#ef4444" },
        ],
      },
    };

    // ── Upsert Form ──
    const existing = await db.execute({
      sql: "SELECT id FROM platform_forms WHERE name = 'Founder Fit Score Assessment'",
      args: [],
    });

    let formId;
    if (existing.rows.length > 0) {
      formId = existing.rows[0].id;
      await db.execute({ sql: "DELETE FROM platform_form_fields WHERE form_id = ?", args: [formId] });
      await db.execute({ sql: "DELETE FROM platform_form_sections WHERE form_id = ?", args: [formId] });
      await db.execute({
        sql: `UPDATE platform_forms SET description = ?, collection_id = ?, visibility = ?, tags = ?, owner_id = 'system', owner_name = 'Platform', settings = ?, status = 'draft', version = 1, updated_at = NOW() WHERE id = ?`,
        args: ["Intelligent assessment designed to evaluate whether an entrepreneur or founder is suitable for a startup incubation or acceleration program.", collectionId, "internal", ["founder", "assessment", "scoring", "incubation"], JSON.stringify(formSettings), formId],
      });
    } else {
      const formRes = await db.execute({
        sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
              VALUES ('Founder Fit Score Assessment', 'Intelligent assessment designed to evaluate whether an entrepreneur or founder is suitable for a startup incubation or acceleration program.', ?, 'draft', 'internal', 1, ARRAY['founder','assessment','scoring','incubation'], 'system', 'Platform', ?, 'system')
              RETURNING id`,
        args: [collectionId, JSON.stringify(formSettings)],
      });
      formId = formRes.rows[0].id;
    }

    // ── Build sections ──
    let sortOrder = 0;

    // Section 1: Founder Profile
    const profileFields = [
      { field_type: "text", label: "Full Name", required: true, sort_order: 0 },
      { field_type: "email", label: "Email Address", required: true, sort_order: 1 },
      { field_type: "phone", label: "Phone Number", required: true, sort_order: 2 },
      { field_type: "select", label: "Gender", required: true, sort_order: 3, options: [{ label: "Male", value: "Male" }, { label: "Female", value: "Female" }, { label: "Non-binary", value: "Non-binary" }, { label: "Prefer not to say", value: "Prefer not to say" }] },
      { field_type: "select", label: "Age Range", required: true, sort_order: 4, options: [{ label: "18-24", value: "18-24" }, { label: "25-34", value: "25-34" }, { label: "35-44", value: "35-44" }, { label: "45-54", value: "45-54" }, { label: "55+", value: "55+" }] },
      { field_type: "text", label: "Country", required: true, sort_order: 5 },
      { field_type: "text", label: "City", required: true, sort_order: 6 },
      { field_type: "select", label: "Highest Education", required: true, sort_order: 7, options: [{ label: "High School", value: "High School" }, { label: "Bachelor's Degree", value: "Bachelor's Degree" }, { label: "Master's Degree", value: "Master's Degree" }, { label: "Doctorate", value: "Doctorate" }, { label: "Self-taught", value: "Self-taught" }] },
      { field_type: "text", label: "Startup Name", required: true, sort_order: 8 },
      { field_type: "select", label: "Startup Industry", required: true, sort_order: 9, options: [{ label: "FinTech", value: "FinTech" }, { label: "HealthTech", value: "HealthTech" }, { label: "EdTech", value: "EdTech" }, { label: "AgriTech", value: "AgriTech" }, { label: "CleanTech", value: "CleanTech" }, { label: "SaaS", value: "SaaS" }, { label: "E-commerce", value: "E-commerce" }, { label: "AI/ML", value: "AI/ML" }, { label: "Blockchain", value: "Blockchain" }, { label: "Other", value: "Other" }] },
      { field_type: "select", label: "Stage of Business", required: true, sort_order: 10, options: [{ label: "Idea Stage", value: "Idea Stage" }, { label: "MVP Development", value: "MVP Development" }, { label: "Beta Testing", value: "Beta Testing" }, { label: "Launched", value: "Launched" }, { label: "Revenue Generating", value: "Revenue Generating" }, { label: "Scaling", value: "Scaling" }] },
      { field_type: "textarea", label: "Describe your idea validation approach", required: true, sort_order: 11, validation: { minLength: 30 }, conditional_logic: { field_id: null, operator: "equals", value: "Idea Stage" } },
      { field_type: "select", label: "Have you conducted any customer interviews?", required: true, sort_order: 12, options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }, { label: "In Progress", value: "In Progress" }], conditional_logic: { field_id: null, operator: "equals", value: "Idea Stage" } },
      { field_type: "currency", label: "Monthly Recurring Revenue (USD)", required: true, sort_order: 13, validation: { min: 0 }, conditional_logic: null },
      { field_type: "number", label: "Number of Paying Customers", required: true, sort_order: 14, validation: { min: 0 }, conditional_logic: null },
      { field_type: "url", label: "Website", required: false, sort_order: 15 },
      { field_type: "url", label: "LinkedIn", required: false, sort_order: 16 },
      { field_type: "number", label: "Team Size", required: true, sort_order: 17, validation: { min: 1 } },
      { field_type: "textarea", label: "How do you manage and coordinate your team?", required: true, sort_order: 18, conditional_logic: { field_id: null, operator: "greater_than", value: "1" } },
      { field_type: "number", label: "Years Working on Startup", required: true, sort_order: 19 },
      { field_type: "file", label: "Pitch Deck", required: false, sort_order: 20, validation: { acceptedFiles: ".pdf,.ppt,.pptx", maxSize: 20 } },
      { field_type: "file", label: "Business Plan", required: false, sort_order: 21, validation: { acceptedFiles: ".pdf,.doc,.docx", maxSize: 20 } },
      { field_type: "file", label: "Financial Projection", required: false, sort_order: 22, validation: { acceptedFiles: ".pdf,.xls,.xlsx", maxSize: 10 } },
      { field_type: "file", label: "Company Registration", required: false, sort_order: 23, validation: { acceptedFiles: ".pdf,.jpg,.png", maxSize: 10 } },
      { field_type: "file", label: "Prototype / Product Images", required: false, sort_order: 24, validation: { acceptedFiles: ".jpg,.png,.mp4", maxSize: 50 } },
    ];

    const profileSec = await db.execute({
      sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, 'Founder Profile', 'Basic founder and startup information', ?) RETURNING id",
      args: [formId, sortOrder++],
    });
    const profileSecId = profileSec.rows[0].id;

    let stageOfBusinessFieldId = null;
    let teamSizeFieldId = null;

    for (const f of profileFields) {
      const res = await db.execute({
        sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, validation, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [formId, profileSecId, f.field_type, f.label, f.required, f.options ? JSON.stringify(f.options) : null, f.validation ? JSON.stringify(f.validation) : null, f.sort_order],
      });
      if (f.label === "Stage of Business") stageOfBusinessFieldId = res.rows[0].id;
      if (f.label === "Team Size") teamSizeFieldId = res.rows[0].id;
    }

    // ── Scored sections ──
    const isRevenueField = (label) => label === "Monthly Recurring Revenue (USD)" || label === "Number of Paying Customers";
    const isIdeaField = (label) => label === "Describe your idea validation approach" || label === "Have you conducted any customer interviews?";

    for (const sec of SCORED_SECTIONS) {
      const secRes = await db.execute({
        sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, ?, ?) RETURNING id",
        args: [formId, sec.title, sortOrder++],
      });
      const secId = secRes.rows[0].id;

      for (let i = 0; i < sec.questions.length; i++) {
        await db.execute({
          sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, settings, sort_order)
                VALUES (?, ?, 'rating', ?, true, ?, ?, ?)`,
          args: [formId, secId, sec.questions[i], JSON.stringify(RATING_OPTIONS), JSON.stringify({ scored: true }), i],
        });
      }
    }

    // ── Open Response section ──
    const openQuestions = [
      "What motivates you most as a founder?",
      "What has been your biggest entrepreneurial failure and what did you learn?",
      "What makes your startup unique compared to competitors?",
      "What specific support are you expecting from this program?",
      "Describe your startup's biggest achievement to date.",
      "Where do you see yourself and your startup in 5 years?",
    ];

    const openSec = await db.execute({
      sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, 'Open Response', ?) RETURNING id",
      args: [formId, sortOrder++],
    });
    const openSecId = openSec.rows[0].id;

    for (let i = 0; i < openQuestions.length; i++) {
      await db.execute({
        sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, validation, sort_order)
              VALUES (?, ?, 'textarea', ?, true, ?, ?)`,
        args: [formId, openSecId, openQuestions[i], JSON.stringify({ minLength: 50 }), i],
      });
    }

    // ── Apply conditional logic ──
    if (stageOfBusinessFieldId) {
      // Idea Stage
      await db.execute({
        sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Describe your idea validation approach'`,
        args: [JSON.stringify({ field_id: stageOfBusinessFieldId, operator: "equals", value: "Idea Stage" }), formId],
      });
      await db.execute({
        sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Have you conducted any customer interviews?'`,
        args: [JSON.stringify({ field_id: stageOfBusinessFieldId, operator: "equals", value: "Idea Stage" }), formId],
      });

      // Revenue Generating or Scaling
      const revenueLogic = [
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Revenue Generating" },
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Scaling" },
      ];
      await db.execute({
        sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Monthly Recurring Revenue (USD)'`,
        args: [JSON.stringify(revenueLogic), formId],
      });
      await db.execute({
        sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Number of Paying Customers'`,
        args: [JSON.stringify(revenueLogic), formId],
      });
    }

    if (teamSizeFieldId) {
      await db.execute({
        sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'How do you manage and coordinate your team?'`,
        args: [JSON.stringify({ field_id: teamSizeFieldId, operator: "greater_than", value: "1" }), formId],
      });
    }

    // ── Publish ──
    const sectionsRows = await db.execute({
      sql: "SELECT * FROM platform_form_sections WHERE form_id = ? ORDER BY sort_order",
      args: [formId],
    });
    const fieldsRows = await db.execute({
      sql: "SELECT * FROM platform_form_fields WHERE form_id = ? ORDER BY sort_order",
      args: [formId],
    });
    const formRow = await db.execute({
      sql: "SELECT * FROM platform_forms WHERE id = ?",
      args: [formId],
    });

    const snapshot = {
      sections: sectionsRows.rows,
      fields: fieldsRows.rows,
      settings: formRow.rows[0].settings,
      publishedAt: new Date().toISOString(),
    };

    await db.execute({
      sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by)
            VALUES (?, 1, ?, NOW(), 'system')
            ON CONFLICT (form_id, version) DO UPDATE SET snapshot = EXCLUDED.snapshot, published_at = NOW()`,
      args: [formId, JSON.stringify(snapshot)],
    });

    await db.execute({
      sql: "UPDATE platform_forms SET status = 'published', version = 1, updated_at = NOW() WHERE id = ?",
      args: [formId],
    });

    return NextResponse.json({
      success: true,
      message: "Founder Fit Score Assessment seeded successfully",
      form_id: formId,
      collection_id: collectionId,
      sections: sectionsRows.rows.length,
      fields: fieldsRows.rows.length,
      status: "published",
      url: `/platform/forms`,
    });
  } catch (error) {
    console.error("[Seed Founder Assessment] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
