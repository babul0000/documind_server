import { genAI } from '../../config/ai';
import { summaryPromptTemplate } from '../prompts/templates';
import { getMockAnalysis } from './mockHelper';

/**
 * AI Agent for generating document summaries.
 * Falls back to content-aware smart mocks if GEMINI_API_KEY is not defined.
 */
export const generateSummary = async (text: string): Promise<string> => {
  if (!genAI) {
    const mock = getMockAnalysis(text);
    return mock.summary;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = summaryPromptTemplate(text);
    const result = await model.generateContent(prompt);
    return result.response.text() || 'No summary generated.';
  } catch (error: any) {
    console.error('Summary Agent Error:', error);
    // Return mock on operational error to keep workspace running
    const mock = getMockAnalysis(text);
    return mock.summary;
  }
};
