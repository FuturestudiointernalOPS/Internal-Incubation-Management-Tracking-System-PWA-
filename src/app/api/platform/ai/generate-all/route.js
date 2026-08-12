import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { deepseekIntelligence } from "@/lib/deepseek";

/**
 * POST /api/platform/ai/generate-all
 * Body: { text, collection_id? }
 *
 * Analyzes document and generates BOTH form structure and evaluation
 * framework. Creates the form in the database atomically.
 * Returns the full created form object so the UI can open it in the builder.
 */
export async function POST(req) {
  let formId = null;
  try {
    await initDb();
    console.log("[AI GenerateAll] Request received");
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { text, collection_id } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Document text is required" }, { status: 400 });
    }

    console.log(`[AI GenerateAll] Generating from ${text.length} chars`);

    const prompt = `You are an expert form designer and evaluation specialist. Analyze this document and generate a complete form structure. If the document describes an assessment, evaluation, or selection process, also generate an evaluation framework.

Return ONLY valid JSON:
{
  "title": "Form title",
  "description": "Brief description",
  "sections": [{ "title": "Section", "fields": [{ "label": "Question", "field_type": "text|textarea|email|phone|select|radio|rating|file|url|number|currency", "required": true, "placeholder": "", "help_text": "", "options": [{"label":"A","value":"a"}], "validation": {} }] }],
  "evaluation": { "dimensions": [{ "name": "Dim", "weight": 15, "criteria": ["..."], "ai_prompt": "..." }], "rankings": [{"min":90,"max":100,"label":"Outstanding","color":"#10b981"},{"min":80,"max":89,"label":"High Potential","color":"#3b82f6"},{"min":70,"max":79,"label":"Promising","color":"#f59e0b"},{"min":60,"max":69,"label":"Needs Development","color":"#f97316"},{"min":0,"max":59,"label":"Not Yet Ready","color":"#ef4444"}], "global_prompt": "..." }
}

Rules: First section = profile info. Rating questions MUST include options: [{"label":"1 - Strongly Disagree","value":"1"},{"label":"2 - Disagree","value":"2"},{"label":"3 - Neutral","value":"3"},{"label":"4 - Agree","value":"4"},{"label":"5 - Strongly Agree","value":"5"}]. Textarea for long answers. Weights MUST sum to 100. Omit "evaluation" if this is just a registration form.

DOCUMENT:
${text.substring(0, 12000)}`;

    const raw = await deepseekIntelligence.chat(prompt, undefined, 8192);
    console.log(`[AI GenerateAll] Response: ${raw.length} chars`);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ success: false, error: "AI returned invalid response" }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title || !Array.isArray(parsed.sections)) {
      return NextResponse.json({ success: false, error: "AI response missing title or sections" }, { status: 500 });
    }

    // Normalize fields
    for (const s of parsed.sections) {
      if (!Array.isArray(s.fields)) s.fields = [];
      for (const f of s.fields) {
        if (!f.field_type) f.field_type = "text";
        if (f.required === undefined) f.required = false;
        // Ensure rating fields have proper options
        if (f.field_type === "rating" && (!f.options || !Array.isArray(f.options) || f.options.length === 0)) {
          f.options = [
            { label: "1 - Strongly Disagree", value: "1" },
            { label: "2 - Disagree", value: "2" },
            { label: "3 - Neutral", value: "3" },
            { label: "4 - Agree", value: "4" },
            { label: "5 - Strongly Agree", value: "5" },
          ];
        }
      }
    }

    // Add sequential numbering to field labels across ALL sections
    let qNumber = 1;
    for (const s of parsed.sections) {
      for (const f of s.fields) {
        if (!/^\d+[.)]\s/.test(f.label)) {
          f.label = `${qNumber}. ${f.label}`;
        }
        qNumber++;
      }
    }

    // Normalize evaluation weights
    if (parsed.evaluation?.dimensions) {
      const dims = parsed.evaluation.dimensions;
      const total = dims.reduce((s, d) => s + (d.weight || 0), 0);
      if (total > 0 && total !== 100) dims[dims.length - 1].weight += (100 - total);
      if (!parsed.evaluation.rankings) parsed.evaluation.rankings = [
        { min: 90, max: 100, label: "Outstanding", color: "#10b981" },
        { min: 80, max: 89, label: "High Potential", color: "#3b82f6" },
        { min: 70, max: 79, label: "Promising", color: "#f59e0b" },
        { min: 60, max: 69, label: "Needs Development", color: "#f97316" },
        { min: 0, max: 59, label: "Not Yet Ready", color: "#ef4444" },
      ];
    }

    // ── Step 1: Create the form ───────────────────────────────────────────────
    console.log("[AI GenerateAll] Creating form...");
    const formRes = await db.execute({
      sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
            VALUES (?, ?, ?, 'draft', 'internal', 1, ARRAY['ai-generated'], 'system', 'AI', '{}', 'system') RETURNING *`,
      args: [parsed.title, parsed.description || null, collection_id ? parseInt(collection_id) : null],
    });
    formId = formRes.rows[0].id;
    const formRecord = formRes.rows[0];
    console.log(`[AI GenerateAll] ✓ Form created — id=${formId}`);

    // ── Step 2: Create sections and fields ───────────────────────────────────
    let sectionCount = 0;
    let fieldCount = 0;
    for (let si = 0; si < parsed.sections.length; si++) {
      const sec = parsed.sections[si];
      const secRes = await db.execute({
        sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?) RETURNING id",
        args: [formId, sec.title, sec.description || null, si],
      });
      const sectionId = secRes.rows[0].id;
      sectionCount++;
      console.log(`[AI GenerateAll] ✓ Section "${sec.title}" (id=${sectionId})`);

      for (let fi = 0; fi < sec.fields.length; fi++) {
        const f = sec.fields[fi];
        await db.execute({
          sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            formId,
            sectionId,
            f.field_type,
            f.label,
            f.placeholder || null,
            f.help_text || null,
            f.required,
            f.options ? JSON.stringify(f.options) : null,
            f.validation ? JSON.stringify(f.validation) : null,
            fi,
          ],
        });
        fieldCount++;
      }
      console.log(`[AI GenerateAll] ✓ ${sec.fields.length} fields for "${sec.title}"`);
    }

    // ── Step 3: Save evaluation framework if generated ────────────────────────
    let evalCount = 0;
    if (parsed.evaluation) {
      await db.execute({
        sql: `INSERT INTO platform_evaluation_frameworks (form_id, framework, source_document, created_by, updated_at)
              VALUES (?, ?, ?, 'ai', NOW())
              ON CONFLICT (form_id) DO UPDATE SET framework = EXCLUDED.framework, updated_at = NOW()`,
        args: [formId, JSON.stringify(parsed.evaluation), text.substring(0, 500)],
      });
      evalCount = parsed.evaluation?.dimensions?.length || 0;
      console.log(`[AI GenerateAll] ✓ Evaluation framework saved — ${evalCount} dimensions`);
    }

    console.log(`[AI GenerateAll] Complete — form ${formId}: ${sectionCount} sections, ${fieldCount} fields, ${evalCount} eval dims`);

    return NextResponse.json({
      success: true,
      form: formRecord,
      form_id: formId,
      title: parsed.title,
      sections: sectionCount,
      fields: fieldCount,
      evaluation_dimensions: evalCount,
      has_evaluation: !!parsed.evaluation,
    });
  } catch (error) {
    console.error("[AI GenerateAll] Error:", error.message);
    // Clean up orphaned form record if it was created before the error
    if (formId) {
      try {
        await db.execute({ sql: "DELETE FROM platform_forms WHERE id = ?", args: [formId] });
        console.warn(`[AI GenerateAll] Cleaned up orphaned form ${formId}`);
      } catch (_) {}
    }
    return NextResponse.json({ success: false, error: `Generation failed: ${error.message}` }, { status: 500 });
  }
}
