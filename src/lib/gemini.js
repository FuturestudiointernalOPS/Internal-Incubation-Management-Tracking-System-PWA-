import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_AI_STUDIO_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;

if (!GOOGLE_AI_STUDIO_API_KEY) {
  console.warn('[Gemini] GOOGLE_AI_STUDIO_API_KEY is not set. AI features will be unavailable.');
}

const genAI = GOOGLE_AI_STUDIO_API_KEY
  ? new GoogleGenerativeAI(GOOGLE_AI_STUDIO_API_KEY)
  : null;

// Default model — swap to 'gemini-1.5-pro' or 'gemini-1.5-flash' as needed
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Helper: get a configured model instance.
 */
function getModel(modelName = DEFAULT_MODEL) {
  if (!genAI) throw new Error('[Gemini] Client not initialised — missing API key.');
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Google Gemini AI Layer — mirrors the aiIntelligence API from deepseek.js
 * so you can swap providers without changing call-sites.
 */
export const geminiIntelligence = {
  /**
   * Parse mentor recordings into structured feedback templates.
   * @param {string} transcription
   */
  parseMentorFeedback: async (transcription) => {
    try {
      const model = getModel();
      const prompt = `You are an incubation program assistant. Parse the following transcription into a structured feedback template with categories: Strengths, Weaknesses, Next Steps, and Product Maturity Level.\n\nTranscription:\n${transcription}`;
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[Gemini] Feedback Parsing Error:', error);
      throw error;
    }
  },

  /**
   * Analyze operational data for trends and risks.
   * @param {object} cohortData
   */
  generateProgramInsights: async (cohortData) => {
    try {
      const model = getModel();
      const prompt = `You are a data analyst. Analyze the following cohort performance data and provide insights on startup readiness and potential risks.\n\nData:\n${JSON.stringify(cohortData, null, 2)}`;
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[Gemini] Analysis Error:', error);
      throw error;
    }
  },

  /**
   * Generate an investor-ready summary for a startup.
   * @param {object} startupMetrics
   */
  generateInvestorReport: async (startupMetrics) => {
    try {
      const model = getModel();
      const prompt = `You are a venture capital consultant. Generate a concise, professional investor report based on these metrics.\n\nMetrics:\n${JSON.stringify(startupMetrics, null, 2)}`;
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[Gemini] Report Error:', error);
      throw error;
    }
  },

  /**
   * Generic chat completion — send any prompt, get a text response.
   * @param {string} prompt
   * @param {string} [modelName]
   */
  chat: async (prompt, modelName = DEFAULT_MODEL) => {
    try {
      const model = getModel(modelName);
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[Gemini] Chat Error:', error);
      throw error;
    }
  },
};

export default geminiIntelligence;
