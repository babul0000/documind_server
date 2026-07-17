import { genAI } from '../../config/ai';
import { extractorPromptTemplate } from '../prompts/templates';
import { getMockAnalysis } from './mockHelper';

export interface ExtractedInfo {
  documentType: string;
  suggestedTitle: string;
  keyTopics: string[];
  entities: string[];
  actionItems: string[];
  dates: string[];
}

/**
 * AI Agent for extracting metadata and structured takeaways from text.
 * Falls back to content-aware smart mocks if GEMINI_API_KEY is not defined.
 */
export const extractMetadata = async (text: string): Promise<ExtractedInfo> => {
  if (!genAI) {
    const mock = getMockAnalysis(text);
    return {
      documentType: mock.documentType,
      suggestedTitle: mock.suggestedTitle,
      keyTopics: mock.tags,
      entities: mock.entities,
      actionItems: mock.actionItems,
      dates: mock.dates,
    };
  }

  const fallback: ExtractedInfo = {
    documentType: 'Unknown Document',
    suggestedTitle: 'Document',
    keyTopics: [],
    entities: [],
    actionItems: [],
    dates: [],
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = extractorPromptTemplate(text);
    const result = await model.generateContent(prompt);
    let rawResponse = result.response.text() || '{}';
    
    // Process markdown code block wrappers if they appear
    rawResponse = rawResponse.trim();
    if (rawResponse.startsWith('```json')) {
      rawResponse = rawResponse.substring(7);
    } else if (rawResponse.startsWith('```')) {
      rawResponse = rawResponse.substring(3);
    }
    if (rawResponse.endsWith('```')) {
      rawResponse = rawResponse.substring(0, rawResponse.length - 3);
    }
    rawResponse = rawResponse.trim();

    const parsed = JSON.parse(rawResponse);
    return {
      documentType: parsed.documentType || fallback.documentType,
      suggestedTitle: parsed.suggestedTitle || fallback.suggestedTitle,
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : fallback.keyTopics,
      entities: Array.isArray(parsed.entities) ? parsed.entities : fallback.entities,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : fallback.actionItems,
      dates: Array.isArray(parsed.dates) ? parsed.dates : fallback.dates,
    };
  } catch (error) {
    console.error('Extractor Agent Error:', error);
    const mock = getMockAnalysis(text);
    return {
      documentType: mock.documentType,
      suggestedTitle: mock.suggestedTitle,
      keyTopics: mock.tags,
      entities: mock.entities,
      actionItems: mock.actionItems,
      dates: mock.dates,
    };
  }
};
