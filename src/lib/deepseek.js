/**
 * DeepSeek AI Provider Adapter
 *
 * AI provider adapter — exposes a `chat(prompt)` interface
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
/** Single source of truth for the model this project talks to. */
export const DEFAULT_MODEL = "deepseek-chat";

/**
 * The same call as `chat`, but the answer keeps the two facts a caller needs
 * when the model's text cannot be used:
 *
 *   finishReason  "stop" | "length" | …
 *   truncated     true when finishReason is "length" — the answer was CUT OFF
 *   usage         token counts, when the provider reports them
 *
 * The distinction matters and was previously thrown away: an answer that stopped
 * at the length ceiling is UNFINISHED, not malformed, and the two need opposite
 * answers from whoever is waiting (split the input, versus simply retry).
 *
 * `chat` is this function minus the metadata, so every existing caller keeps
 * receiving the plain string it always has.
 */
export async function chatDetailed(prompt, modelName = DEFAULT_MODEL, maxTokens = 4096, options = {}) {
  const messages = Array.isArray(prompt)
    ? prompt
    : [{ role: "user", content: String(prompt ?? "") }];
  const promptLength = messages.reduce((totalLength, message) => totalLength + String(message?.content ?? "").length, 0);
  const temperature = typeof options.temperature === "number" ? options.temperature : 0.3;

  console.log(`[DeepSeek] Sending request — model: ${modelName}, prompt length: ${promptLength}, max_tokens: ${maxTokens}`);

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DeepSeek] API error (${res.status}):`, errorText.substring(0, 500));
    throw new Error(`DeepSeek API error (${res.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0] || {};
  const content = choice.message?.content || "";
  const finishReason = choice.finish_reason || null;
  console.log(`[DeepSeek] Response received — length: ${content.length}, finish_reason: ${finishReason}`);
  return { content, finishReason, truncated: finishReason === "length", usage: data.usage || null };
}

/**
 * Generic chat completion — send any prompt, get a text response.
 * API Reference: https://api-docs.deepseek.com/api/create-chat-completion
 *
 * `prompt` is either a plain string (a single `user` message — every existing
 * caller) or a full messages array. The array form exists so a caller can put
 * trusted platform guardrails in a `system` message and keep untrusted content
 * (an applicant's answers) in the `user` message, where it cannot promote
 * itself to an instruction.
 *
 * @param {string|Array<{role: string, content: string}>} prompt
 * @param {string} [modelName] — defaults to "deepseek-chat"
 * @param {number} [maxTokens]
 * @param {{temperature?: number}} [options]
 * @returns {Promise<string>} text response
 */
async function chat(prompt, modelName = DEFAULT_MODEL, maxTokens = 4096, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("[DeepSeek] DEEPSEEK_API_KEY is not set in environment variables.");
  }
  const { content } = await chatDetailed(prompt, modelName, maxTokens, options);
  return content;
}

/**
 * DeepSeek AI Layer — exposes the shared provider interface so the Platform
 * Integration layer can swap providers without refactoring.
 */
export const deepseekIntelligence = {
  chat,
  chatDetailed,

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
