/**
 * POST /api/platform/seed/venture-application
 *
 * Seeds the canonical "Venture Application" form + run INSIDE the existing
 * platform forms engine (no new form system), then records the run as the
 * configured Venture Run (system_settings.venture_run_id).
 *
 * Idempotent: re-running reuses the existing form/run and only ensures the
 * configuration points at it. Super admin only (same gate as the
 * founder-assessment seed).
 */

import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { updateSetting } from "@/lib/ventures";

const FORM_NAME = "Venture Application";
const RUN_NAME = "Venture Application";

function randomSlug() {
  const chars = "0123456789abcdef";
  let s = "r";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

export async function POST() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

  try {
    // ── 1. Find or create the Venture Application form ──
    let formRes = await db.execute({
      sql: "SELECT * FROM platform_forms WHERE name = ?",
      args: [FORM_NAME],
    });
    let form = formRes.rows[0];

    // ── 1b. Single-active Venture intake guard ──
    // The seed may only act as the intake when no OTHER form holds the
    // Venture flag. If this form exists but lost its flag (and no other form
    // owns it), re-flag it idempotently.
    const { assertSingleVentureForm, ensureSingleVentureFormIndex } = await import("@/lib/ventureIntake");
    if (form) {
      const selfFlagged =
        form.settings?.venture_application === true ||
        form.settings?.venture_application === "true";
      const guard = selfFlagged ? { ok: true } : await assertSingleVentureForm(form.id);
      if (!guard.ok) {
        return NextResponse.json(
          { success: false, code: "SINGLE_VENTURE_FORM", error: `Venture registration is already assigned to form "${guard.owner.name}". Deactivate it before seeding a replacement.` },
          { status: 409 },
        );
      }
      if (!selfFlagged) {
        await db.execute({
          sql: `UPDATE platform_forms
                SET settings = settings || '{"venture_application": true}'::jsonb,
                    updated_at = NOW()
                WHERE id = ?`,
          args: [form.id],
        });
      }
    } else {
      const guard = await assertSingleVentureForm(null);
      if (!guard.ok) {
        return NextResponse.json(
          { success: false, code: "SINGLE_VENTURE_FORM", error: `Venture registration is already assigned to form "${guard.owner.name}". Deactivate it before seeding a replacement.` },
          { status: 409 },
        );
      }
    }
    await ensureSingleVentureFormIndex();

    if (!form) {
      const created = await db.execute({
        sql: `INSERT INTO platform_forms (name, description, status, visibility, version, settings, created_by, owner_id, owner_name, created_at, updated_at)
              VALUES (?, ?, 'published', 'internal', 1, ?::jsonb, 'system', 'system', 'Platform', NOW(), NOW())
              RETURNING id`,
        args: [
          FORM_NAME,
          "The single Venture intake form. Approval of a submission creates the Venture.",
          JSON.stringify({
            venture_application: true,
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
              success_message: "Your Venture request has been received and is currently under processing.",
            },
          }),
        ],
      });
      const formId = created.rows[0].id;

      // ── 2. Sections + fields (settings.key drives venture creation mapping) ──
      const sections = [
        {
          title: "Company Information",
          sort: 1,
          fields: [
            { type: "text", label: "Venture / Company Name", required: true, key: "company_name" },
            { type: "select", label: "Industry", required: true, key: "industry", options: ["Fintech", "Healthtech", "Edtech", "Cleantech", "SaaS", "E-commerce", "Agritech", "Logistics", "AI / ML", "Blockchain", "Media & Entertainment", "Real Estate", "Other"] },
            { type: "select", label: "Business Stage", required: true, key: "business_stage", options: ["idea", "validation", "mvp", "growth", "scale"] },
            { type: "url", label: "Website", required: false, key: "website" },
            { type: "text", label: "Country", required: false, key: "country" },
            { type: "select", label: "Registration Status", required: false, key: "registration_status", options: ["Not registered", "Registered", "Pending registration"] },
          ],
        },
        {
          title: "Business Information",
          sort: 2,
          fields: [
            { type: "textarea", label: "Mission", required: false, key: "mission" },
            { type: "textarea", label: "Vision", required: false, key: "vision" },
            { type: "textarea", label: "Problem", required: false, key: "problem" },
            { type: "textarea", label: "Solution", required: false, key: "solution" },
            { type: "textarea", label: "Target Market", required: false, key: "target_market" },
            { type: "textarea", label: "Business Model", required: false, key: "business_model" },
            { type: "textarea", label: "Value Proposition", required: false, key: "value_proposition" },
            { type: "textarea", label: "Description", required: false, key: "description" },
          ],
        },
        {
          title: "Founder",
          sort: 3,
          fields: [
            { type: "text", label: "Founder Full Name", required: true, key: "founder_name" },
            { type: "email", label: "Founder Email", required: true, key: "founder_email" },
            { type: "phone", label: "Founder Phone", required: false, key: "founder_phone" },
          ],
        },
        {
          title: "Team",
          sort: 4,
          fields: [
            { type: "textarea", label: "Co-Founder Emails (one per line)", required: false, key: "co_founder_emails" },
            { type: "textarea", label: "Team Member Emails (one per line)", required: false, key: "team_member_emails" },
          ],
        },
      ];

      for (const section of sections) {
        const secRes = await db.execute({
          sql: `INSERT INTO platform_form_sections (form_id, title, sort_order, created_at)
                VALUES (?, ?, ?, NOW()) RETURNING id`,
          args: [formId, section.title, section.sort],
        });
        const sectionId = secRes.rows[0].id;
        for (const f of section.fields) {
          await db.execute({
            sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, settings, sort_order, created_at)
                  VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, NOW())`,
            args: [
              formId, sectionId, f.type, f.label, f.required ? true : false,
              JSON.stringify(f.options || []),
              JSON.stringify({ key: f.key }),
              section.sort,
            ],
          });
        }
      }

      // ── 3. Version snapshot ──
      await db.execute({
        sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by, created_at)
              VALUES (?, 1, ?::jsonb, NOW(), 'system', NOW())`,
        args: [formId, JSON.stringify({ name: FORM_NAME, version: 1 })],
      });

      formRes = await db.execute({
        sql: "SELECT * FROM platform_forms WHERE id = ?",
        args: [formId],
      });
      form = formRes.rows[0];
    }

    // ── 4. Find or create the active Venture Run ──
    let runRes = await db.execute({
      sql: `SELECT * FROM platform_form_runs
            WHERE form_id = ? AND status = 'active' AND public_slug IS NOT NULL
            ORDER BY created_at DESC LIMIT 1`,
      args: [form.id],
    });
    let run = runRes.rows[0];

    if (!run) {
      const slug = randomSlug();
      const createdRun = await db.execute({
        sql: `INSERT INTO platform_form_runs (form_id, form_version, name, description, status, settings, owner_id, created_by, public_slug, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'active', ?::jsonb, 'system', 'system', ?, NOW(), NOW())
              RETURNING id`,
        args: [
          form.id,
          form.version || 1,
          RUN_NAME,
          "The single Venture intake run. Approval of a submission creates the Venture.",
          JSON.stringify({}),
          slug,
        ],
      });
      const runId = createdRun.rows[0].id;
      runRes = await db.execute({
        sql: "SELECT * FROM platform_form_runs WHERE id = ?",
        args: [runId],
      });
      run = runRes.rows[0];
    }

    // ── 5. Record the configured Venture Run ──
    await updateSetting("venture_run_id", String(run.id), "system");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    return NextResponse.json({
      success: true,
      form_id: form.id,
      run_id: run.id,
      slug: run.public_slug,
      url: `${appUrl}/s/${run.public_slug}`,
      message: `Venture Application form + run ready. Public URL: /s/${run.public_slug}`,
    });
  } catch (error) {
    console.error("Venture application seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Seed failed." },
      { status: 500 },
    );
  }
}
