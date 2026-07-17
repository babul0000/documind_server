/**
 * Prompts templates for DocuMind AI Agents.
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
