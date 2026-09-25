/**
 * POST /api/platform/seed/investor-application
 *
 * Seeds the canonical "Investor Application" form + run INSIDE the existing
 * platform forms engine (no new form system), then returns the run's public
 * link. The link is what a super admin hands to a prospective investor: filling
 * it creates a submission, and approving it creates the investor account
 * (profile + activation email) — see the platform automation rule.
 *
 * Idempotent: re-running reuses the existing form/run and only ensures the
 * configuration points at it. Super admin only.
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
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

export async function POST() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

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
        return NextResponse.json(
          { success: false, code: "SINGLE_INVESTOR_FORM", error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it before seeding a replacement.` },
          { status: 409 },
        );
      }
      if (!selfFlagged) {
        await flagFormAsInvestorApplication(form.id);
      }
    } else {
      const guard = await assertSingleInvestorForm(null);
      if (!guard.ok) {
        return NextResponse.json(
          { success: false, code: "SINGLE_INVESTOR_FORM", error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it before seeding a replacement.` },
          { status: 409 },
        );
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

    return NextResponse.json({
      success: true,
      form_id: form.id,
      run_id: run.id,
      slug: run.public_slug,
      url: `${appUrl}/s/${run.public_slug}`,
    });
  } catch (error) {
    console.error("Investor application seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Seed failed." },
      { status: 500 },
    );
  }
}
