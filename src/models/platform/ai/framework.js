/**
 * AI Evaluation Framework Generator
 *
 * Generates evaluation frameworks from uploaded rubrics, assessment guides,
 * selection policies, or evaluation documents.
 *
 * Uses DeepSeek to analyze the document and produce an evaluation framework
 * with dimensions, criteria, prompts, weights, and rankings.
 */

import { deepseekIntelligence } from "@/lib/deepseek";

const FRAMEWORK_PROMPT = `You are an evaluation design expert for a startup incubation and assessment platform.

Given an evaluation rubric, assessment guide, or selection policy document,
generate an evaluation framework as JSON.

The framework should define:
- Dimensions: the qualities being evaluated
- Criteria: specific indicators within each dimension
- AI prompts: instructions for how AI should evaluate each dimension
- Weights: relative importance of each dimension (must sum to 100)
- Rankings: how overall scores map to decision labels

Return ONLY valid JSON. No markdown, no extra text. Format:

{
  "dimensions": [
    {
      "name": "Dimension name (e.g., Communication Ability)",
      "weight": 15,
      "criteria": ["Specific criterion 1", "Specific criterion 2", "Specific criterion 3"],
      "ai_prompt": "Detailed instructions for AI evaluation of this dimension. Reference the criteria. Explain what constitutes a high vs low score."
    }
  ],
  "rankings": [
    {"min": 90, "max": 100, "label": "Outstanding", "color": "#10b981"},
    {"min": 80, "max": 89, "label": "High Potential", "color": "#3b82f6"},
    {"min": 70, "max": 79, "label": "Promising", "color": "#f59e0b"},
    {"min": 60, "max": 69, "label": "Needs Development", "color": "#f97316"},
    {"min": 0, "max": 59, "label": "Not Yet Ready", "color": "#ef4444"}
  ],
  "global_prompt": "Overall evaluation context. Describe the evaluator's role and what they should look for holistically."
}

Rules:
- Weights MUST sum to exactly 100
- Have 5-10 dimensions (not too few, not too many)
- Each dimension should have 2-4 specific criteria
- AI prompts should be actionable and specific
- Rankings should use sensible thresholds
- Default rankings are shown above — adjust if the document specifies different tiers`;

/**
 * Generate an evaluation framework from a rubric document.
 *
 * @param {string} documentText - The content of the uploaded rubric/guide/policy
 * @returns {Promise<Object|null>} Evaluation framework or null on failure
 */
export async function generateFramework(documentText) {
  try {
    const prompt = `${FRAMEWORK_PROMPT}\n\nRUBRIC DOCUMENT:\n${documentText.substring(0, 10000)}`;
    const raw = await deepseekIntelligence.chat(prompt, undefined, 8192);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!Array.isArray(parsed.dimensions) || parsed.dimensions.length === 0) return null;

    // Normalize weights to sum to 100
    const totalWeight = parsed.dimensions.reduce((s, d) => s + (d.weight || 0), 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      parsed.dimensions = parsed.dimensions.map((d) => ({
        ...d,
        weight: Math.round(((d.weight || 0) / totalWeight) * 100),
      }));
      // Fix rounding: adjust last dimension
      const newTotal = parsed.dimensions.reduce((s, d) => s + d.weight, 0);
      if (newTotal !== 100 && parsed.dimensions.length > 0) {
        parsed.dimensions[parsed.dimensions.length - 1].weight += (100 - newTotal);
      }
    }

    // Ensure defaults
    if (!parsed.rankings || parsed.rankings.length === 0) {
      parsed.rankings = [
        { min: 90, max: 100, label: "Outstanding", color: "#10b981" },
        { min: 80, max: 89, label: "High Potential", color: "#3b82f6" },
        { min: 70, max: 79, label: "Promising", color: "#f59e0b" },
        { min: 60, max: 69, label: "Needs Development", color: "#f97316" },
        { min: 0, max: 59, label: "Not Yet Ready", color: "#ef4444" },
      ];
    }

    if (!parsed.global_prompt) {
      parsed.global_prompt = "You are an experienced startup evaluator. Evaluate this application holistically based on the defined dimensions. Provide specific, evidence-based assessments for each criterion.";
    }

    return parsed;
  } catch (e) {
    console.error("[AI Framework] Generation failed:", e.message);
    return null;
  }
}

export default { generateFramework };
