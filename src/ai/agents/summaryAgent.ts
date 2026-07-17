import { genAI } from '../../config/ai';
import { summaryPromptTemplate } from '../prompts/templates';

/**
 * AI Agent for generating document summaries.
 */
export const generateSummary = async (text: string): Promise<string> => {
  if (!genAI) {
    return 'Gemini AI API key is not configured. Summary generation skipped.';
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = summaryPromptTemplate(text);
    const result = await model.generateContent(prompt);
    return result.response.text() || 'No summary generated.';
  } catch (error: any) {
    console.error('Summary Agent Error:', error);
    return `Error generating summary: ${error.message || error}`;
  }
};
