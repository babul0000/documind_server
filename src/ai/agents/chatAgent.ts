import { genAI } from '../../config/ai';
import { chatPromptTemplate } from '../prompts/templates';

/**
 * AI Agent for handling contextual QA conversations about a document.
 */
export const askDocumentQuestion = async (
  text: string,
  history: { sender: string; text: string }[],
  currentQuestion: string
): Promise<string> => {
  if (!genAI) {
    return 'Gemini AI API key is not configured. Chat operations are offline.';
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = chatPromptTemplate(text, history, currentQuestion);
    const result = await model.generateContent(prompt);
    return result.response.text() || 'I was unable to formulate an answer.';
  } catch (error: any) {
    console.error('Chat Agent Error:', error);
    return `Error generating response: ${error.message || error}`;
  }
};
