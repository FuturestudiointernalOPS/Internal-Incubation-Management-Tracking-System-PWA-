/**
 * DeepSeek AI Provider Adapter
 *
 * Drop-in replacement for Gemini — exposes the same `chat(prompt)` interface
 * used by the Platform Integration layer.
 *
 * Uses DeepSeek's OpenAI-compatible Chat Completions API.
 * Model: deepseek-chat (DeepSeek V4 Pro)
 *
 * Required env: DEEPSEEK_API_KEY=sk-...
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.warn("[DeepSeek] DEEPSEEK_API_KEY is not set. AI features will be unavailable.");
}

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

/**
 * Generic chat completion — send any prompt, get a text response.
 * API Reference: https://api-docs.deepseek.com/api/create-chat-completion
 *
 * @param {string} prompt
 * @param {string} [modelName] — defaults to "deepseek-chat"
 * @returns {Promise<string>} text response
 */
async function chat(prompt, modelName = DEFAULT_MODEL, maxTokens = 4096) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("[DeepSeek] DEEPSEEK_API_KEY is not set in environment variables.");
  }

  console.log(`[DeepSeek] Sending request — model: ${modelName}, prompt length: ${prompt.length}, max_tokens: ${maxTokens}`);

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[DeepSeek] API error (${res.status}):`, err.substring(0, 500));
    throw new Error(`DeepSeek API error (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  console.log(`[DeepSeek] Response received — length: ${content.length}`);
  return content;
}

/**
 * DeepSeek AI Layer — mirrors the geminiIntelligence interface
 * so the Platform Integration layer can swap providers without refactoring.
 */
export const deepseekIntelligence = {
  chat,

  /**
   * Parse mentor recordings into structured feedback templates.
   */
  parseMentorFeedback: async (transcription) => {
    const prompt = `You are an incubation program assistant. Parse the following transcription into a structured feedback template with categories: Strengths, Weaknesses, Next Steps, and Product Maturity Level.\n\nTranscription:\n${transcription}`;
    return chat(prompt);
  },

  /**
   * Analyze operational data for trends and risks.
   */
  generateProgramInsights: async (cohortData) => {
    const prompt = `You are a data analyst. Analyze the following cohort performance data and provide insights on startup readiness and potential risks.\n\nData:\n${JSON.stringify(cohortData, null, 2)}`;
    return chat(prompt);
  },

  /**
   * Generate an investor-ready summary for a startup.
   */
  generateInvestorReport: async (startupMetrics) => {
    const prompt = `You are a venture capital consultant. Generate a concise, professional investor report based on these metrics.\n\nMetrics:\n${JSON.stringify(startupMetrics, null, 2)}`;
    return chat(prompt);
  },
};

export default deepseekIntelligence;
