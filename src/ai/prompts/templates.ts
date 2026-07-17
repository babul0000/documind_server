/**
 * Advanced Prompt Templates for DocuMind AI Agentic Workflows.
 */

export const summaryPromptTemplate = (text: string): string => {
  return `You are DocuMind AI, an expert document summary agent.
Analyze the following document text and provide:
1. A concise, professional overview (3-4 sentences max).
2. Key takeaways as a bulleted list (5 items max).

Make sure the summary is easy to read, uses professional styling, and captures the core essence of the document.

Document Content:
"""
${text.slice(0, 40000)}
"""

Format your response exactly like this:
OVERVIEW:
[Overview paragraph]

KEY TAKEAWAYS:
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]
- [Takeaway 4]
- [Takeaway 5]
`;
};

export const extractorPromptTemplate = (text: string): string => {
  return `You are DocuMind AI, a structured metadata extractor.
Analyze the following document and extract key information in a structured JSON format.
Your output must be a valid JSON object. Do not include any markdown styling like \`\`\`json or \`\`\`. Output ONLY the JSON block.

The JSON should contain:
1. "documentType": The estimated type of document (e.g., Invoice, Resume, Contract, Tutorial, Scientific Paper, etc.)
2. "suggestedTitle": A highly descriptive title for the document.
3. "keyTopics": An array of up to 5 major topics discussed.
4. "entities": An array of key people, organizations, or products mentioned (up to 6 items).
5. "actionItems": An array of any deadlines, tasks, or actionable items found (if none, return empty array).
6. "dates": Important dates mentioned in the text (if none, return empty array).

Document Content:
"""
${text.slice(0, 40000)}
"""

JSON Response Schema:
{
  "documentType": "string",
  "suggestedTitle": "string",
  "keyTopics": ["string"],
  "entities": ["string"],
  "actionItems": ["string"],
  "dates": ["string"]
}
`;
};

/**
 * Prompt for Agent 1: Document Analyzer Agent
 */
export const analyzerPromptTemplate = (text: string): string => {
  return `You are a Document Analyzer Agent. Your task is to perform an in-depth analysis of the document text provided.
Your output must be a valid JSON object containing:
1. "summary": A detailed, executive-level summary of the entire document.
2. "keyPoints": An array of the top 6 core takeaways/points in the document.
3. "importantSections": An array of objects, each containing:
   - "sectionTitle": A descriptive title of the important section.
   - "significance": Why this section is critical to read.
4. "actionItems": An array of action items, tasks, deadlines, or recommendations detected.

Do not include any wrapping markdown like \`\`\`json. Output ONLY raw JSON.

Document Content:
"""
${text.slice(0, 40000)}
"""

JSON Response Schema:
{
  "summary": "string",
  "keyPoints": ["string"],
  "importantSections": [
    { "sectionTitle": "string", "significance": "string" }
  ],
  "actionItems": ["string"]
}
`;
};

/**
 * Prompt for Agent 2: Classification Agent
 */
export const classificationPromptTemplate = (text: string): string => {
  return `You are a Document Classification Agent.
Your task is to analyze the document and automatically suggest classifications.
Your output must be a valid JSON object containing:
1. "category": A single-word or short-phrase classification of the document's category (e.g., Finance, Tech, Legal, Invoice, Academic, etc.)
2. "tags": An array of 4 to 8 highly relevant keywords/tags to organize this document.
3. "suggestedTitle": A concise, descriptive, search-friendly title based on the document's content.

Do not include any wrapping markdown like \`\`\`json. Output ONLY raw JSON.

Document Content:
"""
${text.slice(0, 30000)}
"""

JSON Response Schema:
{
  "category": "string",
  "tags": ["string"],
  "suggestedTitle": "string"
}
`;
};

/**
 * Prompt for Agent 3: AI Chat Assistant Agent with suggested follow-up questions
 */
export const chatWithFollowUpsPromptTemplate = (text: string, history: { sender: string; text: string }[], currentQuestion: string): string => {
  const context = text.slice(0, 30000);
  
  let conversationHistory = '';
  if (history.length > 0) {
    conversationHistory = history
      .map((msg) => `${msg.sender.toUpperCase()}: ${msg.text}`)
      .join('\n');
  }

  return `You are an intelligent Document Chat Assistant Agent.
Analyze the document context and conversation history to answer the user's question.
Your output must be a valid JSON object containing:
1. "response": Your clear, helpful, grounded answer based on the document text. (If the information is not in the text, note this but try to answer using general knowledge where helpful).
2. "suggestedFollowUp": An array of exactly 3 relevant, interesting follow-up questions the user might want to ask next about the document's content.

Do not include any wrapping markdown like \`\`\`json. Output ONLY raw JSON.

Document Context:
\"\"\"
${context}
\"\"\"

${conversationHistory ? `Conversation History:\n${conversationHistory}\n` : ''}
User's Question: "${currentQuestion}"

JSON Response Schema:
{
  "response": "string",
  "suggestedFollowUp": ["string", "string", "string"]
}
`;
};

/**
 * Prompt for Agent 4: Recommendation Agent
 */
export const recommendationPromptTemplate = (docTitle: string, docSummary: string, category: string, tags: string[], otherDocs: { id: string; title: string; category: string; tags: string[] }[]): string => {
  return `You are a Recommendation Agent. Your task is to analyze the user's active document and recommend next steps, related documents, and learning resources.
You will receive metadata about the active document and a list of other documents the user has uploaded.

Active Document Title: "${docTitle}"
Active Document Category: "${category}"
Active Document Summary: "${docSummary}"
Active Document Tags: ${JSON.stringify(tags)}

Other User Documents:
${JSON.stringify(otherDocs)}

Based on this content, generate a valid JSON object containing:
1. "relatedDocuments": An array of up to 3 objects from "Other User Documents" that are related. Each must contain:
   - "id": The document ID.
   - "title": The document title.
   - "reason": Why this document is relevant.
2. "learningResources": An array of 3 realistic, high-quality online learning resources or study paths (such as tutorials, guides, or concepts to research) relevant to the active document. Each must contain:
   - "title": Title of resource/topic.
   - "description": What they will learn from it.
3. "nextActions": An array of 3 important next actions or follow-up tasks the user should perform based on the active document. Each must contain:
   - "action": Description of task.
   - "priority": "High" | "Medium" | "Low".
   - "reason": Why it is a priority.

Do not include any wrapping markdown like \`\`\`json. Output ONLY raw JSON.

JSON Response Schema:
{
  "relatedDocuments": [
    { "id": "string", "title": "string", "reason": "string" }
  ],
  "learningResources": [
    { "title": "string", "description": "string" }
  ],
  "nextActions": [
    { "action": "string", "priority": "string", "reason": "string" }
  ]
}
`;
};

export const chatPromptTemplate = (text: string, history: { sender: string; text: string }[], currentQuestion: string): string => {
  const context = text.slice(0, 30000);
  
  let conversationHistory = '';
  if (history.length > 0) {
    conversationHistory = history
      .map((msg) => `${msg.sender.toUpperCase()}: ${msg.text}`)
      .join('\n');
  }

  return `You are DocuMind AI, an intelligent document assistant.
You are chatting with a user about their uploaded document.
Use the following extracted document text context to answer the user's question.
Be extremely helpful, precise, and polite. If the information is not present in the document context, state that clearly but try to answer using general knowledge where appropriate to keep the conversation helpful.

Document Context:
\"\"\"
${context}
\"\"\"

${conversationHistory ? `Conversation History:\n${conversationHistory}\n` : ''}
User's Question: "${currentQuestion}"

Answer:`;
};

