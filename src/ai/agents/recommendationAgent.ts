import { genAI } from '../../config/ai';
import { recommendationPromptTemplate } from '../prompts/templates';

export interface RecommendationResult {
  relatedDocuments: { id: string; title: string; reason: string }[];
  learningResources: { title: string; description: string }[];
  nextActions: { action: string; priority: string; reason: string }[];
}

/**
 * Agent 4: Recommendation Agent.
 * Recommends related documents, next actions, and learning paths.
 * Falls back to content-aware smart mocks if GEMINI_API_KEY is not defined.
 */
export const generateRecommendations = async (
  docTitle: string,
  docSummary: string,
  category: string,
  tags: string[],
  otherDocs: { id: string; title: string; category: string; tags: string[] }[]
): Promise<RecommendationResult> => {
  if (!genAI) {
    const related = otherDocs
      .filter((d) => d.category === category || d.tags.some((t) => tags.includes(t)))
      .slice(0, 2)
      .map((d) => ({
        id: d.id,
        title: d.title,
        reason: `Shares matching tags or category '${category}' with this document.`
      }));

    return {
      relatedDocuments: related,
      learningResources: [
        { title: `${category} Best Practices Guide`, description: `Review standard procedures and resources regarding ${category} document handling.` },
        { title: `Introduction to ${tags[0] || 'Metadata'} Structures`, description: `Explore core concepts and tutorials on ${tags[0] || 'document classification'}.` },
        { title: 'Executive Overview Review', description: 'Study standard structural layout styles to read papers or contracts faster.' }
      ],
      nextActions: [
        { action: 'Process compliance check list', priority: 'High', reason: 'Review the critical action items extracted by the analyzer.' },
        { action: 'Double-check keywords matching', priority: 'Medium', reason: 'Verify suggested tags align with corporate filing rules.' },
        { action: 'Distribute summary report', priority: 'Low', reason: 'Forward the AI Executive Summary overview to your teammates.' }
      ]
    };
  }

  const fallback: RecommendationResult = {
    relatedDocuments: [],
    learningResources: [
      { title: 'General Concept Review', description: 'Review basic concepts and terminology discussed in this document.' },
      { title: 'Contextual Research', description: 'Search academic or industry databases for similar case studies or reports.' }
    ],
    nextActions: [
      { action: 'Review key sections', priority: 'Medium', reason: 'Review sections highlighted by the analyzer.' }
    ],
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = recommendationPromptTemplate(docTitle, docSummary, category, tags, otherDocs);
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
      relatedDocuments: Array.isArray(parsed.relatedDocuments) ? parsed.relatedDocuments : fallback.relatedDocuments,
      learningResources: Array.isArray(parsed.learningResources) ? parsed.learningResources : fallback.learningResources,
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : fallback.nextActions,
    };
  } catch (error) {
    console.error('Recommendation Agent Error:', error);
    const related = otherDocs
      .filter((d) => d.category === category || d.tags.some((t) => tags.includes(t)))
      .slice(0, 2)
      .map((d) => ({
        id: d.id,
        title: d.title,
        reason: `Shares matching tags or category '${category}' with this document.`
      }));

    return {
      relatedDocuments: related,
      learningResources: [
        { title: `${category} Best Practices Guide`, description: `Review standard procedures and resources regarding ${category} document handling.` },
        { title: `Introduction to ${tags[0] || 'Metadata'} Structures`, description: `Explore core concepts and tutorials on ${tags[0] || 'document classification'}.` },
        { title: 'Executive Overview Review', description: 'Study standard structural layout styles to read papers or contracts faster.' }
      ],
      nextActions: [
        { action: 'Process compliance check list', priority: 'High', reason: 'Review the critical action items extracted by the analyzer.' },
        { action: 'Double-check keywords matching', priority: 'Medium', reason: 'Verify suggested tags align with corporate filing rules.' },
        { action: 'Distribute summary report', priority: 'Low', reason: 'Forward the AI Executive Summary overview to your teammates.' }
      ]
    };
  }
};
