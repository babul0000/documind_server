import { genAI, isAIConfigured } from '../../config/ai';
import { analyzerPromptTemplate } from '../prompts/templates';
import { getMockAnalysis } from './mockHelper';

export interface AnalyzerResult {
  summary: string;
  keyPoints: string[];
  importantSections: { sectionTitle: string; significance: string }[];
  actionItems: string[];
}

/**
 * Agent 1: Document Analyzer Agent.
 * Runs in-depth deep text analyses and outputs structured summaries/action tasks.
 * Falls back to content-aware smart mocks if GEMINI_API_KEY is not defined.
 */
export const analyzeDocumentText = async (text: string): Promise<AnalyzerResult> => {
  if (!isAIConfigured()) {
    const mock = getMockAnalysis(text);
    return {
      summary: mock.summary,
      keyPoints: mock.keyPoints,
      importantSections: mock.importantSections,
      actionItems: mock.actionItems,
    };
  }

  const fallback: AnalyzerResult = {
    summary: 'Analysis summary unavailable.',
    keyPoints: [],
    importantSections: [],
    actionItems: [],
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const prompt = analyzerPromptTemplate(text);
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
      summary: parsed.summary || fallback.summary,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : fallback.keyPoints,
      importantSections: Array.isArray(parsed.importantSections) ? parsed.importantSections : fallback.importantSections,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : fallback.actionItems,
    };
  } catch (error) {
    console.error('Analyzer Agent Error:', error);
    const mock = getMockAnalysis(text);
    return {
      summary: mock.summary,
      keyPoints: mock.keyPoints,
      importantSections: mock.importantSections,
      actionItems: mock.actionItems,
    };
  }
};
