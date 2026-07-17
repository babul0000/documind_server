import { generateSummary } from '../ai/agents/summaryAgent';
import { extractMetadata, ExtractedInfo } from '../ai/agents/extractorAgent';
import { askDocumentQuestion } from '../ai/agents/chatAgent';

export const geminiService = {
  generateSummary,
  extractMetadata,
  askDocumentQuestion,
};

export type { ExtractedInfo };
