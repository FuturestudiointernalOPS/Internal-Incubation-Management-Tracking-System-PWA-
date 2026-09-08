// =============================================================================
// Seed Founder Fit Score Assessment
// Run: node scripts/seed_founder_fit_assessment.js
//
// Creates the complete Founder Fit Score Assessment form with:
//   - Collection "Founder Assessments"
//   - 10 sections with ~100+ fields across dimensions
//   - Rating (Likert), text, select, file upload, and textarea fields
//   - Conditional logic on Stage of Business and Team Size
//   - Scoring config for 8 evaluation dimensions
//   - Version snapshot and publication
// =============================================================================

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// ─── DB Connection ───────────────────────────────────────────────────────────

function getPool() {
  const envPath = path.resolve(__dirname, "../.env.local");
  let DATABASE_URL;

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (!match) {
      console.error("❌ DATABASE_URL not found in .env.local");
      process.exit(1);
    }
    DATABASE_URL = match[1].trim();
  } else {
    DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      console.error("❌ DATABASE_URL not found in .env.local or environment");
      process.exit(1);
    }
  }

  return new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

function toPgSql(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
}

async function dbQuery(pool, sql, args = []) {
  const result = await pool.query(toPgSql(sql), args);
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ratingOptions() {
  return [
    { label: "1 - Strongly Disagree", value: "1" },
    { label: "2 - Disagree", value: "2" },
    { label: "3 - Neutral", value: "3" },
    { label: "4 - Agree", value: "4" },
    { label: "5 - Strongly Agree", value: "5" },
  ];
}

function ratingField(label, sortOrder) {
  return {
    field_type: "rating",
    label,
    required: true,
    options: ratingOptions(),
    settings: { scored: true },
    sort_order: sortOrder,
  };
}

// ─── Data Definitions ────────────────────────────────────────────────────────

const COLLECTION = {
  name: "Founder Assessments",
  slug: "founder-assessments",
  description:
    "Standardized founder evaluation assessments for incubation and acceleration programs",
  status: "active",
  visibility: "internal",
  category: "Assessment",
  color: "#FF6600",
  tags: ["assessment", "founder", "scoring", "evaluation"],
};

const FORM = {
  name: "Founder Fit Score Assessment",
  description:
    "Intelligent assessment designed to evaluate whether an entrepreneur or founder is suitable for a startup incubation or acceleration program. Generates a standardized Founder Fit Score across 10 evaluation dimensions.",
  status: "draft",
  visibility: "internal",
  version: 1,
  tags: ["founder", "assessment", "scoring", "incubation"],
  owner_id: "system",
  owner_name: "Platform",
  settings: {
    scoring: {
      enabled: true,
      sections: {
        "Founder Motivation": { weight: 10, field_labels: [] },
        "Leadership": { weight: 15, field_labels: [] },
        "Business Understanding": { weight: 20, field_labels: [] },
        "Execution Capability": { weight: 20, field_labels: [] },
        "Innovation": { weight: 10, field_labels: [] },
        "Financial Literacy": { weight: 10, field_labels: [] },
        "Coachability": { weight: 10, field_labels: [] },
        "Commitment": { weight: 5, field_labels: [] },
      },
      rankings: [
        { min: 90, max: 100, label: "Outstanding", color: "#10b981" },
        { min: 80, max: 89, label: "High Potential", color: "#3b82f6" },
        { min: 70, max: 79, label: "Promising", color: "#f59e0b" },
        { min: 60, max: 69, label: "Needs Development", color: "#f97316" },
        { min: 0, max: 59, label: "Not Yet Ready", color: "#ef4444" },
      ],
    },
  },
};

// Field definitions → { sectionTitle, fields: [{...fieldDef}] }
function buildSections() {
  const sections = [];

  // ── Section 1: Founder Profile ──────────────────────────────────────────────
  {
    const sec1Fields = [
      { field_type: "text", label: "Full Name", required: true, sort_order: 0 },
      { field_type: "email", label: "Email Address", required: true, sort_order: 1 },
      { field_type: "phone", label: "Phone Number", required: true, sort_order: 2 },
      {
        field_type: "select",
        label: "Gender",
        required: true,
        sort_order: 3,
        options: [
          { label: "Male", value: "Male" },
          { label: "Female", value: "Female" },
          { label: "Non-binary", value: "Non-binary" },
          { label: "Prefer not to say", value: "Prefer not to say" },
        ],
      },
      {
        field_type: "select",
        label: "Age Range",
        required: true,
        sort_order: 4,
        options: [
          { label: "18-24", value: "18-24" },
          { label: "25-34", value: "25-34" },
          { label: "35-44", value: "35-44" },
          { label: "45-54", value: "45-54" },
          { label: "55+", value: "55+" },
        ],
      },
      { field_type: "text", label: "Country", required: true, sort_order: 5 },
      { field_type: "text", label: "City", required: true, sort_order: 6 },
      {
        field_type: "select",
        label: "Highest Education",
        required: true,
        sort_order: 7,
        options: [
          { label: "High School", value: "High School" },
          { label: "Bachelor's Degree", value: "Bachelor's Degree" },
          { label: "Master's Degree", value: "Master's Degree" },
          { label: "Doctorate", value: "Doctorate" },
          { label: "Self-taught", value: "Self-taught" },
        ],
      },
      { field_type: "text", label: "Startup Name", required: true, sort_order: 8 },
      {
        field_type: "select",
        label: "Startup Industry",
        required: true,
        sort_order: 9,
        options: [
          { label: "FinTech", value: "FinTech" },
          { label: "HealthTech", value: "HealthTech" },
          { label: "EdTech", value: "EdTech" },
          { label: "AgriTech", value: "AgriTech" },
          { label: "CleanTech", value: "CleanTech" },
          { label: "SaaS", value: "SaaS" },
          { label: "E-commerce", value: "E-commerce" },
          { label: "AI/ML", value: "AI/ML" },
          { label: "Blockchain", value: "Blockchain" },
          { label: "Other", value: "Other" },
        ],
      },
      {
        field_type: "select",
        label: "Stage of Business",
        required: true,
        sort_order: 10,
        options: [
          { label: "Idea Stage", value: "Idea Stage" },
          { label: "MVP Development", value: "MVP Development" },
          { label: "Beta Testing", value: "Beta Testing" },
          { label: "Launched", value: "Launched" },
          { label: "Revenue Generating", value: "Revenue Generating" },
          { label: "Scaling", value: "Scaling" },
        ],
      },
      // Conditional: Idea Stage
      {
        field_type: "textarea",
        label: "Describe your idea validation approach",
        required: true,
        sort_order: 11,
        validation: { minLength: 30 },
        conditional_logic: null, // Will be set after we know the Stage of Business field ID
      },
      {
        field_type: "select",
        label: "Have you conducted any customer interviews?",
        required: true,
        sort_order: 12,
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" },
          { label: "In Progress", value: "In Progress" },
        ],
        conditional_logic: null,
      },
      // Conditional: Revenue Generating / Scaling
      {
        field_type: "currency",
        label: "Monthly Recurring Revenue (USD)",
        required: true,
        sort_order: 13,
        conditional_logic: null,
      },
      {
        field_type: "number",
        label: "Number of Paying Customers",
        required: true,
        sort_order: 14,
        conditional_logic: null,
      },
      // Website & LinkedIn (not required)
      {
        field_type: "url",
        label: "Website",
        required: false,
        sort_order: 15,
      },
      {
        field_type: "url",
        label: "LinkedIn",
        required: false,
        sort_order: 16,
      },
      // Team Size
      {
        field_type: "number",
        label: "Team Size",
        required: true,
        sort_order: 17,
        validation: { min: 1 },
      },
      // Conditional: Team Size > 1
      {
        field_type: "textarea",
        label: "How do you manage and coordinate your team?",
        required: false,
        sort_order: 18,
        conditional_logic: null,
      },
      // Years working on startup
      {
        field_type: "number",
        label: "Years Working on Startup",
        required: true,
        sort_order: 19,
      },
      // File upload fields (optional)
      {
        field_type: "file",
        label: "Pitch Deck",
        required: false,
        sort_order: 20,
        validation: { acceptedFiles: ".pdf,.ppt,.pptx", maxSize: 20 },
      },
      {
        field_type: "file",
        label: "Business Plan",
        required: false,
        sort_order: 21,
        validation: { acceptedFiles: ".pdf,.doc,.docx", maxSize: 20 },
      },
      {
        field_type: "file",
        label: "Financial Projection",
        required: false,
        sort_order: 22,
        validation: { acceptedFiles: ".pdf,.xls,.xlsx", maxSize: 10 },
      },
      {
        field_type: "file",
        label: "Company Registration",
        required: false,
        sort_order: 23,
        validation: { acceptedFiles: ".pdf,.jpg,.png", maxSize: 10 },
      },
      {
        field_type: "file",
        label: "Prototype / Product Images",
        required: false,
        sort_order: 24,
        validation: { acceptedFiles: ".jpg,.png,.mp4", maxSize: 50 },
      },
    ];

    sections.push({
      title: "Founder Profile",
      description: "Basic information about the founder and their startup",
      sort_order: 0,
      fields: sec1Fields,
    });
  }

  // ── Section 2: Founder Motivation ──────────────────────────────────────────
  {
    const questions = [
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
    ];

    sections.push({
      title: "Founder Motivation",
      description: "Evaluate the founder's drive, passion, and purpose",
      sort_order: 1,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 3: Leadership ──────────────────────────────────────────────────
  {
    const questions = [
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
    ];

    sections.push({
      title: "Leadership",
      description: "Assess the founder's ability to lead, inspire, and manage a team",
      sort_order: 2,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 4: Business Understanding ──────────────────────────────────────
  {
    const questions = [
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
    ];

    sections.push({
      title: "Business Understanding",
      description: "Evaluate the founder's market knowledge, strategy, and business acumen",
      sort_order: 3,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 5: Execution Capability ────────────────────────────────────────
  {
    const questions = [
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
    ];

    sections.push({
      title: "Execution Capability",
      description: "Assess the founder's ability to execute, adapt, and deliver results",
      sort_order: 4,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 6: Innovation ──────────────────────────────────────────────────
  {
    const questions = [
      "I regularly generate creative solutions to problems.",
      "My product or service is significantly different from existing solutions.",
      "I deeply understand my users' needs and experiences.",
      "I can envision how my industry will evolve in the next 5 years.",
      "I actively seek inspiration from other industries.",
      "I am willing to challenge conventional wisdom in my field.",
      "I prototype and test ideas quickly rather than over-planning.",
      "I see opportunities where others see obstacles.",
    ];

    sections.push({
      title: "Innovation",
      description: "Evaluate the founder's creativity, vision, and innovative thinking",
      sort_order: 5,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 7: Financial Literacy ──────────────────────────────────────────
  {
    const questions = [
      "I can create and maintain a basic business budget.",
      "I understand the difference between revenue, profit, and cash flow.",
      "I know my current burn rate and runway.",
      "I understand the key financial metrics for my business.",
      "I can project revenue and expenses for the next 12 months.",
      "I understand what investors look for in financial projections.",
      "I am disciplined about tracking income and expenses.",
      "I understand different funding options available to startups.",
    ];

    sections.push({
      title: "Financial Literacy",
      description: "Assess the founder's understanding of financial management and metrics",
      sort_order: 6,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 8: Coachability ────────────────────────────────────────────────
  {
    const questions = [
      "I actively seek feedback on my ideas and performance.",
      "When given feedback, I implement it rather than defend against it.",
      "I acknowledge when I do not know something.",
      "I learn from people with more experience than me.",
      "I am open to changing my approach based on new information.",
      "I ask thoughtful questions and listen to understand.",
      "I can accept criticism without becoming defensive.",
      "I view mentorship as essential to my growth.",
    ];

    sections.push({
      title: "Coachability",
      description: "Evaluate the founder's openness to feedback, learning, and mentorship",
      sort_order: 7,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 9: Commitment ──────────────────────────────────────────────────
  {
    const questions = [
      "I work on my startup full-time or am transitioning to full-time.",
      "I have made significant personal sacrifices for my startup.",
      "I am committed to this venture for the long term (5+ years).",
      "I continue working on my startup despite facing rejection.",
      "I am willing to take calculated risks to grow my business.",
      "I invest my own resources (time, money) into the venture.",
      "I have turned down other opportunities to focus on this startup.",
      "My commitment to this venture is unwavering.",
    ];

    sections.push({
      title: "Commitment",
      description: "Evaluate the founder's dedication, sacrifice, and long-term commitment",
      sort_order: 8,
      fields: questions.map((q, i) => ratingField(q, i)),
    });
  }

  // ── Section 10: Open Response ──────────────────────────────────────────────
  {
    const questions = [
      {
        label: "What motivates you most as a founder?",
        minLength: 50,
      },
      {
        label: "What has been your biggest entrepreneurial failure and what did you learn?",
        minLength: 50,
      },
      {
        label: "What makes your startup unique compared to competitors?",
        minLength: 50,
      },
      {
        label: "What specific support are you expecting from this program?",
        minLength: 30,
      },
      {
        label: "Describe your startup's biggest achievement to date.",
        minLength: 30,
      },
      {
        label: "Where do you see yourself and your startup in 5 years?",
        minLength: 30,
      },
    ];

    sections.push({
      title: "Open Response",
      description: "In-depth written responses to understand the founder's perspective",
      sort_order: 9,
      fields: questions.map((q, i) => ({
        field_type: "textarea",
        label: q.label,
        required: true,
        sort_order: i,
        validation: { minLength: q.minLength },
      })),
    });
  }

  return sections;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔧 Connecting to database...");
  const pool = getPool();
  console.log("✅ Connected.\n");

  try {
    // ── Step 1: Upsert Collection ────────────────────────────────────────────
    console.log("📁 Step 1: Creating / upserting collection...");
    const collRes = await dbQuery(
      pool,
      `INSERT INTO platform_collections (name, slug, description, status, visibility, tags, category, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'system')
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         visibility = EXCLUDED.visibility,
         tags = EXCLUDED.tags,
         category = EXCLUDED.category,
         color = EXCLUDED.color,
         updated_at = NOW()
       RETURNING id, name, slug`,
      [
        COLLECTION.name,
        COLLECTION.slug,
        COLLECTION.description,
        COLLECTION.status,
        COLLECTION.visibility,
        COLLECTION.tags,
        COLLECTION.category,
        COLLECTION.color,
      ],
    );
    const collectionId = collRes.rows[0].id;
    console.log(`   ✅ Collection: "${COLLECTION.name}" (id: ${collectionId})\n`);

    // ── Step 2: Upsert Form ──────────────────────────────────────────────────
    console.log("📝 Step 2: Creating / upserting form...");

    // Delete existing fields & sections if re-seeding the same form
    const existingForm = await dbQuery(
      pool,
      "SELECT id FROM platform_forms WHERE name = $1",
      [FORM.name],
    );

    let formId;
    if (existingForm.rows.length > 0) {
      formId = existingForm.rows[0].id;
      console.log(`   ⚠️  Form already exists (id: ${formId}), clearing existing fields & sections...`);
      await dbQuery(pool, "DELETE FROM platform_form_fields WHERE form_id = $1", [formId]);
      await dbQuery(pool, "DELETE FROM platform_form_sections WHERE form_id = $1", [formId]);
      // Update metadata
      await dbQuery(
        pool,
        `UPDATE platform_forms SET
           description = $2,
           collection_id = $3,
           visibility = $4,
           tags = $5,
           owner_id = $6,
           owner_name = $7,
           settings = $8,
           status = 'draft',
           version = 1,
           updated_at = NOW()
         WHERE id = $1`,
        [
          formId,
          FORM.description,
          collectionId,
          FORM.visibility,
          FORM.tags,
          FORM.owner_id,
          FORM.owner_name,
          JSON.stringify(FORM.settings),
        ],
      );
    } else {
      const formRes = await dbQuery(
        pool,
        `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'system')
         RETURNING id`,
        [
          FORM.name,
          FORM.description,
          collectionId,
          FORM.status,
          FORM.visibility,
          FORM.version,
          FORM.tags,
          FORM.owner_id,
          FORM.owner_name,
          JSON.stringify(FORM.settings),
        ],
      );
      formId = formRes.rows[0].id;
    }
    console.log(`   ✅ Form: "${FORM.name}" (id: ${formId})\n`);

    // ── Step 3: Create Sections & Fields ─────────────────────────────────────
    console.log("📋 Step 3: Creating sections and fields...");

    const sections = buildSections();
    // Maps to resolve conditional logic after all fields are created
    const fieldLabelToId = {};
    let stageOfBusinessFieldId = null;
    let teamSizeFieldId = null;

    for (const sec of sections) {
      // Insert section
      const secRes = await dbQuery(
        pool,
        `INSERT INTO platform_form_sections (form_id, title, description, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [formId, sec.title, sec.description || null, sec.sort_order],
      );
      const sectionId = secRes.rows[0].id;
      console.log(`   📑 Section "${sec.title}" (id: ${sectionId}, ${sec.fields.length} fields)`);

      // Insert fields
      for (const fld of sec.fields) {
        const fldRes = await dbQuery(
          pool,
          `INSERT INTO platform_form_fields
           (form_id, section_id, field_type, label, placeholder, help_text, required,
            options, validation, conditional_logic, sort_order, settings)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            formId,
            sectionId,
            fld.field_type || "text",
            fld.label,
            fld.placeholder || null,
            fld.help_text || null,
            fld.required ? true : false,
            fld.options ? JSON.stringify(fld.options) : null,
            fld.validation ? JSON.stringify(fld.validation) : null,
            fld.conditional_logic ? JSON.stringify(fld.conditional_logic) : null,
            fld.sort_order || 0,
            JSON.stringify(fld.settings || {}),
          ],
        );
        const fieldId = fldRes.rows[0].id;
        fieldLabelToId[fld.label] = fieldId;

        // Track reference fields for conditional logic
        if (fld.label === "Stage of Business") {
          stageOfBusinessFieldId = fieldId;
        }
        if (fld.label === "Team Size") {
          teamSizeFieldId = fieldId;
        }
      }
    }

    console.log(`\n   ✅ Total fields created: ${Object.keys(fieldLabelToId).length}\n`);

    // ── Step 4: Apply Conditional Logic ──────────────────────────────────────
    console.log("🔗 Step 4: Applying conditional logic...");

    const conditionalUpdates = [];

    // Idea Stage conditionals
    if (stageOfBusinessFieldId) {
      const ideaCondition = {
        field_id: stageOfBusinessFieldId,
        operator: "equals",
        value: "Idea Stage",
      };

      conditionalUpdates.push({
        label: "Describe your idea validation approach",
        logic: ideaCondition,
      });
      conditionalUpdates.push({
        label: "Have you conducted any customer interviews?",
        logic: ideaCondition,
      });

      // Revenue Generating or Scaling conditionals
      const revenueCondition = [
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Revenue Generating" },
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Scaling" },
      ];

      conditionalUpdates.push({
        label: "Monthly Recurring Revenue (USD)",
        logic: revenueCondition,
      });
      conditionalUpdates.push({
        label: "Number of Paying Customers",
        logic: revenueCondition,
      });
    }

    // Team Size > 1 conditional
    if (teamSizeFieldId) {
      conditionalUpdates.push({
        label: "How do you manage and coordinate your team?",
        logic: {
          field_id: teamSizeFieldId,
          operator: "greater_than",
          value: "1",
        },
      });
    }

    for (const update of conditionalUpdates) {
      const fieldId = fieldLabelToId[update.label];
      if (fieldId) {
        await dbQuery(
          pool,
          "UPDATE platform_form_fields SET conditional_logic = $2, updated_at = NOW() WHERE id = $1",
          [fieldId, JSON.stringify(update.logic)],
        );
        console.log(`   🔗 "${update.label}" → conditional logic set`);
      } else {
        console.log(`   ⚠️  Field "${update.label}" not found — skipping conditional logic`);
      }
    }

    console.log(`   ✅ Conditional logic applied.\n`);

    // ── Step 5: Publish the Form ─────────────────────────────────────────────
    console.log("🚀 Step 5: Publishing the form...");

    // Gather sections and fields for snapshot
    const sectionsRows = await dbQuery(
      pool,
      "SELECT * FROM platform_form_sections WHERE form_id = $1 ORDER BY sort_order",
      [formId],
    );
    const fieldsRows = await dbQuery(
      pool,
      "SELECT * FROM platform_form_fields WHERE form_id = $1 ORDER BY sort_order",
      [formId],
    );

    // Get current form for settings
    const formRow = await dbQuery(pool, "SELECT * FROM platform_forms WHERE id = $1", [formId]);

    const snapshot = {
      sections: sectionsRows.rows,
      fields: fieldsRows.rows,
      settings: formRow.rows[0].settings,
      publishedAt: new Date().toISOString(),
    };

    // Insert version snapshot
    await dbQuery(
      pool,
      `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by)
       VALUES ($1, $2, $3, NOW(), 'system')
       ON CONFLICT (form_id, version) DO UPDATE SET snapshot = EXCLUDED.snapshot, published_at = NOW()`,
      [formId, 1, JSON.stringify(snapshot)],
    );

    // Update form status to published
    await dbQuery(
      pool,
      `UPDATE platform_forms SET status = 'published', version = 1, updated_at = NOW() WHERE id = $1`,
      [formId],
    );

    console.log(`   ✅ Version snapshot saved (version 1)`);
    console.log(`   ✅ Form published!\n`);

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🎉 Founder Fit Score Assessment seeded successfully!");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`   Collection ID:  ${collectionId}`);
    console.log(`   Form ID:        ${formId}`);
    console.log(`   Form URL:       /platform/forms/builder?id=${formId}`);
    console.log(`   Sections:       ${sectionsRows.rows.length}`);
    console.log(`   Fields:         ${fieldsRows.rows.length}`);
    console.log(`   Status:         published`);
    console.log(`   Version:        1`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  }
}

main();
