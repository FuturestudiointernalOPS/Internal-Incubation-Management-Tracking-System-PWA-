import axios from 'axios';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1'; // Placeholder URL, update as needed
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const deepseekClient = axios.create({
  baseURL: DEEPSEEK_API_URL,
  headers: {
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * DeepSeek AI Layer Logic
 */
export const aiIntelligence = {
  /**
   * Parse mentor recordings into structured feedback templates.
   */
  parseMentorFeedback: async (transcription) => {
    try {
      const response = await deepseekClient.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an incubation program assistant. Parse the following transcription into a structured feedback template with categories: Strengths, Weaknesses, Next Steps, and Product Maturity Level.' },
          { role: 'user', content: transcription }
        ],
      });
      return response.data;
    } catch (error) {
      console.error('DeepSeek Feedback Parsing Error:', error);
      throw error;
    }
  },

  /**
   * Analyze operational data for trends and risks.
   */
  generateProgramInsights: async (cohortData) => {
    try {
      const response = await deepseekClient.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a data analyst. Analyze the following cohort performance data and provide insights on startup readiness and potential risks.' },
          { role: 'user', content: JSON.stringify(cohortData) }
        ],
      });
      return response.data;
    } catch (error) {
      console.error('DeepSeek Analysis Error:', error);
      throw error;
    }
  },

  /**
   * Generate an investor-ready summary for a startup.
   */
  generateInvestorReport: async (startupMetrics) => {
    try {
      const response = await deepseekClient.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a venture capital consultant. Generate a concise, professional investor report based on these metrics.' },
          { role: 'user', content: JSON.stringify(startupMetrics) }
        ],
      });
      return response.data;
    } catch (error) {
      console.error('DeepSeek Report Error:', error);
      throw error;
    }
  }
};
