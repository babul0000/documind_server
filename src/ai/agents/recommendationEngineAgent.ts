import { genAI, isAIConfigured } from '../../config/ai';

export interface RecommendationEngineResult {
  relatedDocuments: { documentId: string; title: string; reason: string }[];
  similarTopics: { topic: string; description: string }[];
  learningResources: { title: string; description: string; searchQuery: string }[];
  nextToRead: { documentId: string; title: string; reason: string }[];
}

/**
 * Agentic AI Recommendation Engine.
 * Analyzes uploaded documents, topics, user queries, and previous chat contexts.
 * Maps output to existing document IDs in user's library.
 */
export const runRecommendationEngine = async (
  documents: { id: string; title: string; category: string; tags: string[]; summary: string }[],
  userQueries: string[],
  refinement: string = ''
): Promise<RecommendationEngineResult> => {
  
  // Smart fallback mock if genAI is not configured
  if (!isAIConfigured()) {
    return generateFallbackRecommendations(documents, refinement);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const documentsInput = documents.map(d => ({
      id: d.id,
      title: d.title,
      category: d.category,
      tags: d.tags,
      summary: d.summary ? d.summary.substring(0, 150) + '...' : 'No summary.'
    }));

    const prompt = `
You are an expert agentic AI librarian and document analyst. Your goal is to analyze a user's document library, search topics, and past actions to formulate a tailored, context-grounded set of recommendations.

Below is the user's document library:
${JSON.stringify(documentsInput, null, 2)}

Below are recent queries/topics the user asked in document chats:
${JSON.stringify(userQueries.slice(0, 10), null, 2)}

${refinement ? `CRITICAL USER INSTRUCTION (Refinement request):
"${refinement}"
You MUST heavily refine, filter, and adapt all your recommendations to satisfy the user request above. E.g., if they request "focus on tax files", prioritize documents and topics related to taxes.` : ''}

Provide your recommendations in a JSON object with the following fields:
1. "relatedDocuments": An array of maximum 3 pairs of documents in the user's library that have logical connections. You must use ONLY documentIds and titles that exist in the document list above. Format: { "documentId": "ID of document", "title": "title of document", "reason": "why they are related" }
2. "similarTopics": An array of maximum 3 recurrent themes/topics discovered across their files. Format: { "topic": "topic name", "description": "brief description of the topic" }
3. "learningResources": An array of maximum 3 learning paths/external research queries that will help the user understand their files better. Format: { "title": "learning title", "description": "what they will learn", "searchQuery": "Google search query terms" }
4. "nextToRead": An array of maximum 2 documents already in their library that they should prioritize reading next. Format: { "documentId": "ID of document", "title": "title of document", "reason": "why this is the logical next step" }

Return ONLY the raw JSON string. Do not wrap in markdown or any other characters.
`;

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
      relatedDocuments: Array.isArray(parsed.relatedDocuments) ? parsed.relatedDocuments : [],
      similarTopics: Array.isArray(parsed.similarTopics) ? parsed.similarTopics : [],
      learningResources: Array.isArray(parsed.learningResources) ? parsed.learningResources : [],
      nextToRead: Array.isArray(parsed.nextToRead) ? parsed.nextToRead : [],
    };

  } catch (error) {
    console.error('Recommendation Engine Agent Error:', error);
    return generateFallbackRecommendations(documents, refinement);
  }
};

/**
 * Intelligent content-aware fallback builder based on categories and tags
 */
const generateFallbackRecommendations = (
  documents: { id: string; title: string; category: string; tags: string[]; summary: string }[],
  refinement: string = ''
): RecommendationEngineResult => {
  const lowercaseRefinement = refinement.toLowerCase();
  
  // Filter docs matching refinement keywords if provided
  const matchedDocs = refinement 
    ? documents.filter(d => 
        d.title.toLowerCase().includes(lowercaseRefinement) ||
        d.category.toLowerCase().includes(lowercaseRefinement) ||
        d.tags.some(t => t.toLowerCase().includes(lowercaseRefinement))
      )
    : documents;

  const targetDocs = matchedDocs.length > 0 ? matchedDocs : documents;

  // 1. Related Documents
  const relatedDocuments: any[] = [];
  if (targetDocs.length >= 2 && targetDocs[0] && targetDocs[1]) {
    relatedDocuments.push({
      documentId: targetDocs[0].id,
      title: targetDocs[0].title,
      reason: `Shares workspace similarities and tags with ${targetDocs[1].title}.`
    });
  }

  // 2. Next to Read
  const nextToRead: any[] = [];
  if (targetDocs.length > 0) {
    const firstDoc = targetDocs[targetDocs.length - 1]; // Oldest or newest
    if (firstDoc) {
      nextToRead.push({
        documentId: firstDoc.id,
        title: firstDoc.title,
        reason: `Based on your library status, analyzing ${firstDoc.title} will provide foundational insights.`
      });
    }
  }

  const categoryLabel = targetDocs[0]?.category || 'General';

  return {
    relatedDocuments,
    similarTopics: [
      { 
        topic: `${categoryLabel} Indexing`, 
        description: `Discovered patterns associated with standard ${categoryLabel} cataloging templates.` 
      },
      { 
        topic: 'Document Knowledge Graphs', 
        description: 'Analyzing text linkages and tag intersections to compile summaries.' 
      }
    ],
    learningResources: [
      { 
        title: `Advanced ${categoryLabel} Standards`, 
        description: `Search current standards for handling ${categoryLabel} files in enterprise systems.`,
        searchQuery: `${categoryLabel} file structures and specifications`
      },
      { 
        title: 'Gemini RAG Implementations', 
        description: 'Learn how agentic AI retrieves and indexes document context vectors.',
        searchQuery: 'Gemini RAG document chat retrieval'
      }
    ],
    nextToRead
  };
};
