/**
 * AI Form Generator
 *
 * Generates complete form structures from uploaded documents
 * (PDF, DOCX, Markdown, Plain Text, Concept Notes, Assessment Guides).
 *
 * Uses DeepSeek to analyze the document and produce a form definition
 * with title, description, sections, questions, field types, and validation.
 */

import { deepseekIntelligence } from "@/lib/deepseek";

const GENERATION_PROMPT = `You are an expert form designer for an incubation and startup evaluation platform.

Given a document describing an assessment, application process, or evaluation criteria,
generate a complete form structure as JSON.

The form should include:
- A profile/contact information section (name, email, phone, startup details)
- Evaluation sections with Likert-scale rating questions (1-5) for assessing qualities
- Open-ended questions for qualitative responses
- File upload fields where the document mentions attachments

Return ONLY valid JSON. No markdown, no extra text. Format:

{
  "title": "Form title derived from the document",
  "description": "1-2 sentence description of the form's purpose",
  "sections": [
    {
      "title": "Section name",
      "description": "Optional section description",
      "fields": [
        {
          "label": "Question or field label",
          "field_type": "text|textarea|number|email|phone|date|select|radio|checkbox|multiselect|file|url|rating|currency",
          "required": true,
          "placeholder": "Optional placeholder",
          "help_text": "Optional help text",
          "options": [{"label": "Option 1", "value": "option-1"}],
          "validation": {"minLength": 50}
        }
      ]
    }
  ]
}

Rules:
- First section MUST collect profile information (name, email, phone, organization, industry, stage)
- Rating questions should use field_type "rating" with 1-5 scale
- Each rating section should have 5-12 questions
- Long-text questions should use field_type "textarea" with minLength validation
- Mark required fields appropriately
- Include file upload fields only if the document mentions attachments (pitch deck, business plan, etc.)
- Group related questions into logical, well-named sections
- Section and field labels should be clear and professional`;

/**
 * Generate a form from a text document.
 *
 * @param {string} documentText - The content of the uploaded document
 * @returns {Promise<Object|null>} Form definition or null on failure
 */
export async function generateForm(documentText) {
  try {
    const prompt = `${GENERATION_PROMPT}\n\nDOCUMENT:\n${documentText.substring(0, 15000)}`;
    const raw = await deepseekIntelligence.chat(prompt, undefined, 8192);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate basic structure
    if (!parsed.title || !Array.isArray(parsed.sections)) return null;

    // Ensure fields have required properties
    for (const section of parsed.sections) {
      if (!Array.isArray(section.fields)) section.fields = [];
      for (const field of section.fields) {
        if (!field.field_type) field.field_type = "text";
        if (field.required === undefined) field.required = false;
      }
    }

    // Add sequential numbering to field labels across ALL sections
    let qNumber = 1;
    for (const section of parsed.sections) {
      for (const field of section.fields) {
        // Skip if label already has a number prefix like "1." or "1)"
        if (!/^\d+[.)]\s/.test(field.label)) {
          field.label = `${qNumber}. ${field.label}`;
        }
        qNumber++;
      }
    }

    return parsed;
  } catch (e) {
    console.error("[AI Generator] Form generation failed:", e.message);
    return null;
  }
}

export default { generateForm };
