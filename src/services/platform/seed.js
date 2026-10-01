/**
 * PLATFORM FORM SEEDS (Founder Fit Score Assessment, Investor Application) —
 * decisions, extracted from the controllers.
 *
 * `src/app/api/platform/seed/founder-assessment/route.js` and
 * `src/app/api/platform/seed/investor-application/route.js` mixed their
 * controller (auth, response shaping) with the whole idempotent seed
 * pipeline: upsert-or-create form/collection/run, build sections/fields,
 * apply conditional logic, publish. Moved here VERBATIM — no HTTP. Auth
 * (`requireAuth`/`requireSameOrigin`) stays in the controllers, where the
 * authorization boundary belongs.
 *
 * See docs/GUIDE_DECOUPAGE_COUCHES.md for the method.
 */

import {
  deleteFounderFormFields,
  deleteFounderFormSections,
  findFounderAssessmentForm,
  getFormFieldsForSnapshot,
  getFormForSnapshot,
  getFormSectionsForSnapshot,
  insertFounderAssessmentForm,
  insertFounderProfileField,
  insertFounderProfileSection,
  insertOpenResponseField,
  insertOpenResponseSection,
  insertScoredAssessmentSection,
  insertScoredRatingField,
  publishFounderAssessmentForm,
  resetFounderAssessmentForm,
  setCustomerInterviewsLogic,
  setIdeaValidationApproachLogic,
  setMonthlyRecurringRevenueLogic,
  setPayingCustomersLogic,
  setTeamManagementLogic,
  upsertFounderAssessmentCollection,
  upsertFounderAssessmentVersion,
} from "@/models/platformAi";
import {
  createInvestorApplicationForm,
  createInvestorApplicationRun,
  findActiveInvestorRun,
  findInvestorApplicationFormByName,
  flagFormAsInvestorApplication,
  getFormByIdForInvestorSeed,
  getInvestorRunById,
  insertInvestorApplicationField,
  insertInvestorApplicationSection,
  insertInvestorApplicationSnapshot,
} from "@/models/investorApplication";

// ─── Founder Fit Score Assessment ────────────────────────────────────────────

const RATING_OPTIONS = [
  { label: "1 - Strongly Disagree", value: "1" },
  { label: "2 - Disagree", value: "2" },
  { label: "3 - Neutral", value: "3" },
  { label: "4 - Agree", value: "4" },
  { label: "5 - Strongly Agree", value: "5" },
];

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

export async function seedFounderAssessment() {
  try {
    // ── Upsert Collection ──
    const collRes = await upsertFounderAssessmentCollection();
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
    const existing = await findFounderAssessmentForm();

    let formId;
    if (existing.rows.length > 0) {
      formId = existing.rows[0].id;
      await deleteFounderFormFields(formId);
      await deleteFounderFormSections(formId);
      await resetFounderAssessmentForm(
        "Intelligent assessment designed to evaluate whether an entrepreneur or founder is suitable for a startup incubation or acceleration program.",
        collectionId,
        "internal",
        ["founder", "assessment", "scoring", "incubation"],
        formSettings,
        formId
      );
    } else {
      const formRes = await insertFounderAssessmentForm(collectionId, formSettings);
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

    const profileSection = await insertFounderProfileSection(formId, sortOrder++);
    const profileSectionId = profileSection.rows[0].id;

    let stageOfBusinessFieldId = null;
    let teamSizeFieldId = null;

    for (const field of profileFields) {
      const insertResult = await insertFounderProfileField(formId, profileSectionId, field);
      if (field.label === "Stage of Business") stageOfBusinessFieldId = insertResult.rows[0].id;
      if (field.label === "Team Size") teamSizeFieldId = insertResult.rows[0].id;
    }

    // ── Scored sections ──

    for (const section of SCORED_SECTIONS) {
      const sectionResult = await insertScoredAssessmentSection(formId, section.title, sortOrder++);
      const sectionId = sectionResult.rows[0].id;

      for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
        await insertScoredRatingField(formId, sectionId, section.questions[questionIndex], RATING_OPTIONS, questionIndex);
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

    const openSection = await insertOpenResponseSection(formId, sortOrder++);
    const openSectionId = openSection.rows[0].id;

    for (let questionIndex = 0; questionIndex < openQuestions.length; questionIndex++) {
      await insertOpenResponseField(formId, openSectionId, openQuestions[questionIndex], questionIndex);
    }

    // ── Apply conditional logic ──
    if (stageOfBusinessFieldId) {
      // Idea Stage
      await setIdeaValidationApproachLogic(
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Idea Stage" },
        formId
      );
      await setCustomerInterviewsLogic(
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Idea Stage" },
        formId
      );

      // Revenue Generating or Scaling
      const revenueLogic = [
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Revenue Generating" },
        { field_id: stageOfBusinessFieldId, operator: "equals", value: "Scaling" },
      ];
      await setMonthlyRecurringRevenueLogic(revenueLogic, formId);
      await setPayingCustomersLogic(revenueLogic, formId);
    }

    if (teamSizeFieldId) {
      await setTeamManagementLogic(
        { field_id: teamSizeFieldId, operator: "greater_than", value: "1" },
        formId
      );
    }

    // ── Publish ──
    const sectionsRows = await getFormSectionsForSnapshot(formId);
    const fieldsRows = await getFormFieldsForSnapshot(formId);
    const formRow = await getFormForSnapshot(formId);

    const snapshot = {
      sections: sectionsRows.rows,
      fields: fieldsRows.rows,
      settings: formRow.rows[0].settings,
      publishedAt: new Date().toISOString(),
    };

    await upsertFounderAssessmentVersion(formId, snapshot);

    await publishFounderAssessmentForm(formId);

    return {
      ok: true,
      message: "Founder Fit Score Assessment seeded successfully",
      form_id: formId,
      collection_id: collectionId,
      sections: sectionsRows.rows.length,
      fields: fieldsRows.rows.length,
      status: "published",
      url: `/platform/forms`,
    };
  } catch (error) {
    console.error("[Seed Founder Assessment] Error:", error);
    return { ok: false, statusCode: 500, error: error.message };
  }
}

// ─── Investor Application ────────────────────────────────────────────────────

const FORM_NAME = "Investor Application";
const RUN_NAME = "Investor Application";

const INDUSTRIES = ["EdTech", "AI/ML", "FinTech", "HealthTech", "AgriTech", "CleanTech", "Logistics", "E-Commerce", "SaaS", "Renewable Energy"];
const COUNTRIES = ["CD", "KE", "NG", "ZA", "GH", "RW", "UG", "TZ", "EG", "MA", "SN", "CI", "CM"];
const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Growth"];

const FORM_SECTIONS = [
  {
    title: "Account",
    fields: [
      { type: "text", label: "Full Name", required: true, key: "name" },
      { type: "email", label: "Email Address", required: true, key: "email" },
    ],
  },
  {
    title: "Organization",
    fields: [
      { type: "text", label: "Organization Name", required: true, key: "organization_name" },
      { type: "textarea", label: "Biography", required: false, key: "biography" },
      { type: "url", label: "Website", required: false, key: "website" },
      { type: "url", label: "LinkedIn Profile", required: false, key: "linkedin" },
    ],
  },
  {
    title: "Investment Preferences",
    fields: [
      { type: "multiselect", label: "Industries", required: true, key: "industries", options: INDUSTRIES.map((value) => ({ label: value, value })) },
      { type: "multiselect", label: "Countries", required: true, key: "countries", options: COUNTRIES.map((value) => ({ label: value, value })) },
      { type: "multiselect", label: "Startup Stages", required: false, key: "startup_stages", options: STAGES.map((value) => ({ label: value, value })) },
      { type: "number", label: "Minimum Ticket Size (USD)", required: false, key: "ticket_size_min" },
      { type: "number", label: "Maximum Ticket Size (USD)", required: false, key: "ticket_size_max" },
    ],
  },
  {
    title: "Experience",
    fields: [
      { type: "textarea", label: "Investment Experience", required: false, key: "investment_experience" },
      { type: "textarea", label: "Prior Investments", required: false, key: "prior_investments" },
    ],
  },
];

const FORM_SETTINGS = {
  investor_application: true,
  automation: {
    on_submit: { send_acknowledgement: true },
    on_approve: {
      create_platform_user: true,
      send_activation_email: true,
      enroll_in_program: false,
      assign_to_group: false,
    },
    on_reject: { send_rejection_email: true },
    auto_approve: false,
    redirect_after_submit: "",
    success_message: "Your investor application has been received and is pending review.",
  },
};

function randomSlug() {
  return "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export async function seedInvestorApplication() {
  try {
    // ── 1. Find or create the Investor Application form ──
    let formResult = await findInvestorApplicationFormByName(FORM_NAME);
    let form = formResult.rows[0];

    // ── 1b. Single-active Investor intake guard ──
    // The seed may only act as the intake when no OTHER form holds the flag. If
    // this form exists but lost its flag (and no other form owns it), re-flag it
    // idempotently.
    const { assertSingleInvestorForm, ensureSingleInvestorFormIndex } = await import("@/models/investorIntake");
    if (form) {
      const selfFlagged =
        form.settings?.investor_application === true ||
        form.settings?.investor_application === "true";
      const guard = selfFlagged ? { ok: true } : await assertSingleInvestorForm(form.id);
      if (!guard.ok) {
        return {
          ok: false,
          statusCode: 409,
          code: "SINGLE_INVESTOR_FORM",
          error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it before seeding a replacement.`,
        };
      }
      if (!selfFlagged) {
        await flagFormAsInvestorApplication(form.id);
      }
    } else {
      const guard = await assertSingleInvestorForm(null);
      if (!guard.ok) {
        return {
          ok: false,
          statusCode: 409,
          code: "SINGLE_INVESTOR_FORM",
          error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it before seeding a replacement.`,
        };
      }
    }
    await ensureSingleInvestorFormIndex();

    if (!form) {
      const created = await createInvestorApplicationForm(
        FORM_NAME,
        "The single Investor intake form. Approval of a submission creates the investor account.",
        FORM_SETTINGS,
      );
      const formId = created.rows[0].id;

      // ── 2. Sections + fields (settings.key drives the approval mapping) ──
      for (let sectionIndex = 0; sectionIndex < FORM_SECTIONS.length; sectionIndex++) {
        const section = FORM_SECTIONS[sectionIndex];
        const sort = sectionIndex + 1;
        const sectionResult = await insertInvestorApplicationSection(formId, section.title, sort);
        const sectionId = sectionResult.rows[0].id;
        for (const field of section.fields) {
          await insertInvestorApplicationField(formId, sectionId, field, sort);
        }
      }

      // ── 3. Version snapshot ──
      await insertInvestorApplicationSnapshot(formId, { name: FORM_NAME, version: 1 });

      formResult = await getFormByIdForInvestorSeed(formId);
      form = formResult.rows[0];
    }

    // ── 4. Find or create the active Investor Run ──
    let runResult = await findActiveInvestorRun(form.id);
    let run = runResult.rows[0];

    if (!run) {
      const createdRun = await createInvestorApplicationRun(
        form.id,
        form.version,
        RUN_NAME,
        "The single Investor intake run. Approval of a submission creates the investor account.",
        randomSlug(),
      );
      runResult = await getInvestorRunById(createdRun.rows[0].id);
      run = runResult.rows[0];
    }

    const appUrl = (await import("@/lib/appUrl")).resolveAppUrl();

    return {
      ok: true,
      form_id: form.id,
      run_id: run.id,
      slug: run.public_slug,
      url: `${appUrl}/s/${run.public_slug}`,
    };
  } catch (error) {
    console.error("Investor application seed error:", error);
    return { ok: false, statusCode: 500, error: error.message || "Seed failed." };
  }
}
