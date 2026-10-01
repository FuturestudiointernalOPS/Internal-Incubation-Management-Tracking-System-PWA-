/**
 * Platform — AI form authoring from a document (SERVICE layer).
 *
 * The domain work behind `/api/platform/ai/generate-all`: the design prompt, the
 * response normalisation (field defaults, rating options, sequential numbering,
 * evaluation weights) and the three-step persist (form → sections/fields →
 * evaluation framework) with an orphan cleanup when a later step fails.
 *
 * The CONTROLLER keeps `initDb`, the `forms.create` capability, the required-text
 * check and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import { deepseekIntelligence } from "@/lib/deepseek";
import {
  createAiGeneratedForm,
  deleteFormById,
  insertAiGeneratedField,
  insertAiGeneratedSection,
  upsertAiEvaluationFramework,
} from "@/models/platformAi";

// ── Normalisation ───────────────────────────────────────────────────────────

const DEFAULT_RATING_OPTIONS = [
  { label: "1 - Strongly Disagree", value: "1" },
  { label: "2 - Disagree", value: "2" },
  { label: "3 - Neutral", value: "3" },
  { label: "4 - Agree", value: "4" },
  { label: "5 - Strongly Agree", value: "5" },
];

const DEFAULT_RANKINGS = [
  { min: 90, max: 100, label: "Outstanding", color: "#10b981" },
  { min: 80, max: 89, label: "High Potential", color: "#3b82f6" },
  { min: 70, max: 79, label: "Promising", color: "#f59e0b" },
  { min: 60, max: 69, label: "Needs Development", color: "#f97316" },
  { min: 0, max: 59, label: "Not Yet Ready", color: "#ef4444" },
];

/** Fill in field defaults, ensure rating options and number every question. */
export function normalizeGeneratedSections(sections) {
  for (const section of sections) {
    if (!Array.isArray(section.fields)) section.fields = [];
    for (const field of section.fields) {
      if (!field.field_type) field.field_type = "text";
      if (field.required === undefined) field.required = false;
      // Ensure rating fields have proper options
      if (
        field.field_type === "rating" &&
        (!field.options || !Array.isArray(field.options) || field.options.length === 0)
      ) {
        field.options = DEFAULT_RATING_OPTIONS.map((option) => ({ ...option }));
      }
    }
  }

  // Add sequential numbering to field labels across ALL sections
  let qNumber = 1;
  for (const section of sections) {
    for (const field of section.fields) {
      if (!/^\d+[.)]\s/.test(field.label)) {
        field.label = `${qNumber}. ${field.label}`;
      }
      qNumber++;
    }
  }

  return sections;
}

/** Normalise an evaluation's weights to 100 and default its rankings. */
export function normalizeGeneratedEvaluation(evaluation) {
  if (!evaluation?.dimensions) return evaluation;
  const dims = evaluation.dimensions;
  const total = dims.reduce((sum, dimension) => sum + (dimension.weight || 0), 0);
  if (total > 0 && total !== 100) dims[dims.length - 1].weight += 100 - total;
  if (!evaluation.rankings) evaluation.rankings = DEFAULT_RANKINGS.map((ranking) => ({ ...ranking }));
  return evaluation;
}

function buildPrompt(text) {
  return `You are an expert form designer and evaluation specialist. Analyze this document and generate a complete form structure. If the document describes an assessment, evaluation, or selection process, also generate an evaluation framework.

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
}

/**
 * Generate BOTH a form structure and its evaluation framework from a document,
 * and persist them atomically (an orphaned form is removed if a later step
 * fails).
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function generateFormWithFramework({ text, collection_id }) {
  let formId = null;
  try {
    console.log(`[AI GenerateAll] Generating from ${text.length} chars`);

    const raw = await deepseekIntelligence.chat(buildPrompt(text), undefined, 8192);
    console.log(`[AI GenerateAll] Response: ${raw.length} chars`);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { status: 500, body: { success: false, error: "AI returned invalid response" } };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title || !Array.isArray(parsed.sections)) {
      return { status: 500, body: { success: false, error: "AI response missing title or sections" } };
    }

    // Normalize fields + evaluation weights
    normalizeGeneratedSections(parsed.sections);
    normalizeGeneratedEvaluation(parsed.evaluation);

    // ── Step 1: Create the form ──
    console.log("[AI GenerateAll] Creating form...");
    const formResult = await createAiGeneratedForm(parsed.title, parsed.description, collection_id);
    formId = formResult.rows[0].id;
    const formRecord = formResult.rows[0];
    console.log(`[AI GenerateAll] ✓ Form created — id=${formId}`);

    // ── Step 2: Create sections and fields ──
    let sectionCount = 0;
    let fieldCount = 0;
    for (let sectionIndex = 0; sectionIndex < parsed.sections.length; sectionIndex++) {
      const section = parsed.sections[sectionIndex];
      const sectionResult = await insertAiGeneratedSection(formId, section.title, section.description, sectionIndex);
      const sectionId = sectionResult.rows[0].id;
      sectionCount++;
      console.log(`[AI GenerateAll] ✓ Section "${section.title}" (id=${sectionId})`);

      for (let fieldIndex = 0; fieldIndex < section.fields.length; fieldIndex++) {
        const field = section.fields[fieldIndex];
        await insertAiGeneratedField(formId, sectionId, field, fieldIndex);
        fieldCount++;
      }
      console.log(`[AI GenerateAll] ✓ ${section.fields.length} fields for "${section.title}"`);
    }

    // ── Step 3: Save evaluation framework if generated ──
    let evalCount = 0;
    if (parsed.evaluation) {
      await upsertAiEvaluationFramework(formId, parsed.evaluation, text);
      evalCount = parsed.evaluation?.dimensions?.length || 0;
      console.log(`[AI GenerateAll] ✓ Evaluation framework saved — ${evalCount} dimensions`);
    }

    console.log(
      `[AI GenerateAll] Complete — form ${formId}: ${sectionCount} sections, ${fieldCount} fields, ${evalCount} eval dims`
    );

    return {
      status: 200,
      body: {
        success: true,
        form: formRecord,
        form_id: formId,
        title: parsed.title,
        sections: sectionCount,
        fields: fieldCount,
        evaluation_dimensions: evalCount,
        has_evaluation: !!parsed.evaluation,
      },
    };
  } catch (error) {
    console.error("[AI GenerateAll] Error:", error.message);
    // Clean up orphaned form record if it was created before the error
    if (formId) {
      try {
        await deleteFormById(formId);
        console.warn(`[AI GenerateAll] Cleaned up orphaned form ${formId}`);
      } catch (_) {}
    }
    return { status: 500, body: { success: false, error: `Generation failed: ${error.message}` } };
  }
}
