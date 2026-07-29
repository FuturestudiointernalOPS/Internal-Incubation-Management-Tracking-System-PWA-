import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { deepseekIntelligence } from "@/lib/deepseek";

/**
 * POST /api/platform/ai/generate-all
 * Body: { text, collection_id? }
 * 
 * Analyzes document and generates BOTH form structure and evaluation
 * framework. Creates the form in the database automatically.
 * Returns the created form so the UI can open it in the builder.
 */
export async function POST(req) {
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

Rules: First section = profile info. Rating questions = field_type "rating" with 1-5 scale. Textarea for long answers. Weights MUST sum to 100. Omit "evaluation" if this is just a registration form.

DOCUMENT:
${text.substring(0, 12000)}`;

    const raw = await deepseekIntelligence.chat(prompt);
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

    // Create the form in DB
    const formRes = await db.execute({
      sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
            VALUES (?, ?, ?, 'draft', 'internal', 1, ARRAY['ai-generated'], 'system', 'AI', '{}', 'system') RETURNING *`,
      args: [parsed.title, parsed.description || null, collection_id ? parseInt(collection_id) : null],
    });
    const formId = formRes.rows[0].id;

    // Create sections and fields
    const allFields = [];
    for (let si = 0; si < parsed.sections.length; si++) {
      const sec = parsed.sections[si];
      const secRes = await db.execute({
        sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?) RETURNING id",
        args: [formId, sec.title, sec.description || null, si],
      });
      for (let fi = 0; fi < sec.fields.length; fi++) {
        const f = sec.fields[fi];
        await db.execute({
          sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [formId, secRes.rows[0].id, f.field_type, f.label, f.placeholder || null, f.help_text || null, f.required, f.options ? JSON.stringify(f.options) : null, f.validation ? JSON.stringify(f.validation) : null, fi],
        });
      }
      allFields.push(...sec.fields);
    }

    // Save evaluation framework if generated
    if (parsed.evaluation) {
      await db.execute({
        sql: `INSERT INTO platform_evaluation_frameworks (form_id, framework, source_document, created_by, updated_at)
              VALUES (?, ?, ?, 'ai', NOW())
              ON CONFLICT (form_id) DO UPDATE SET framework = EXCLUDED.framework, updated_at = NOW()`,
        args: [formId, JSON.stringify(parsed.evaluation), text.substring(0, 500)],
      });
    }

    const sectionCount = parsed.sections.length;
    const fieldCount = allFields.length;
    const evalCount = parsed.evaluation?.dimensions?.length || 0;

    console.log(`[AI GenerateAll] Created form ${formId}: ${sectionCount} sections, ${fieldCount} fields, ${evalCount} eval dims`);

    return NextResponse.json({
      success: true,
      form_id: formId,
      title: parsed.title,
      sections: sectionCount,
      fields: fieldCount,
      evaluation_dimensions: evalCount,
      has_evaluation: !!parsed.evaluation,
      url: `/platform/forms`,
    });
  } catch (error) {
    console.error("[AI GenerateAll] Error:", error.message);
    return NextResponse.json({ success: false, error: `Generation failed: ${error.message}` }, { status: 500 });
  }
}
