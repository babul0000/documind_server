import { generateSummary } from '../ai/agents/summaryAgent';
import { extractMetadata, ExtractedInfo } from '../ai/agents/extractorAgent';
import { askDocumentQuestion, askDocumentQuestionWithFollowUps } from '../ai/agents/chatAgent';
import { analyzeDocumentText } from '../ai/agents/analyzerAgent';
import { classifyDocumentText } from '../ai/agents/classificationAgent';
import { generateRecommendations } from '../ai/agents/recommendationAgent';

export const geminiService = {
  generateSummary,
  extractMetadata,
  askDocumentQuestion,
  askDocumentQuestionWithFollowUps,
  analyzeDocumentText,
  classifyDocumentText,
  generateRecommendations,
};

export type { ExtractedInfo };
