import { genAI, isAIConfigured } from '../../config/ai';
import { classificationPromptTemplate } from '../prompts/templates';
import { getMockAnalysis } from './mockHelper';

export interface ClassificationResult {
  category: string;
  tags: string[];
  suggestedTitle: string;
}

/**
 * Agent 2: Classification Agent.
 * Classifies document types and extracts keywords/tags dynamically.
 * Falls back to content-aware smart mocks if GEMINI_API_KEY is not defined.
 */
export const classifyDocumentText = async (text: string): Promise<ClassificationResult> => {
  if (!isAIConfigured()) {
    const mock = getMockAnalysis(text);
    return {
      category: mock.category,
      tags: mock.tags,
      suggestedTitle: mock.suggestedTitle,
    };
  }

  const fallback: ClassificationResult = {
    category: 'General',
    tags: [],
    suggestedTitle: 'Document',
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = classificationPromptTemplate(text);
    const result = await model.generateContent(prompt);
    let raw = result.response.text() || '{}';

    // Parse JSON safely
    raw = raw.trim();
    if (raw.startsWith('```json')) {
      raw = raw.substring(7);
    } else if (raw.startsWith('```')) {
      raw = raw.substring(3);
    }
    if (raw.endsWith('```')) {
      raw = raw.substring(0, raw.length - 3);
    }
    raw = raw.trim();

    const parsed = JSON.parse(raw);
    return {
      category: parsed.category || fallback.category,
      tags: Array.isArray(parsed.tags) ? parsed.tags : fallback.tags,
      suggestedTitle: parsed.suggestedTitle || fallback.suggestedTitle,
    };
  } catch (error) {
    console.error('Classification Agent Error:', error);
    const mock = getMockAnalysis(text);
    return {
      category: mock.category,
      tags: mock.tags,
      suggestedTitle: mock.suggestedTitle,
    };
  }
};
