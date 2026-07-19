import { genAI, isAIConfigured } from '../../config/ai';
import { chatPromptTemplate, chatWithFollowUpsPromptTemplate } from '../prompts/templates';
import { getMockAnalysis } from './mockHelper';

export interface ChatAgentResult {
  response: string;
  suggestedFollowUp: string[];
}

/**
 * Chat agent mock helper to provide realistic grounded conversations.
 */
const getMockChatResponse = (text: string, currentQuestion: string): ChatAgentResult => {
  const q = currentQuestion.toLowerCase();
  const mock = getMockAnalysis(text);
  
  if (q.includes('summary') || q.includes('about') || q.includes('topic') || q.includes('main')) {
    return {
      response: `Based on the document context, this file is identified as a "${mock.documentType}". Here is the executive overview:\n\n${mock.summary.replace('OVERVIEW:\n', '')}`,
      suggestedFollowUp: [
        'What are the key takeaways?',
        'Show me the action items checklist',
        'Which sections are most important?'
      ]
    };
  }
  
  if (q.includes('point') || q.includes('takeaway') || q.includes('important') || q.includes('insight')) {
    return {
      response: `Here are the core takeaways and key points extracted from "${mock.suggestedTitle}":\n\n${mock.keyPoints.map(p => `• ${p}`).join('\n')}`,
      suggestedFollowUp: [
        'What is the document category?',
        'Who are the named entities mentioned?',
        'Are there any specific deadlines?'
      ]
    };
  }

  if (q.includes('action') || q.includes('task') || q.includes('deadline') || q.includes('todo') || q.includes('work')) {
    if (mock.actionItems.length === 0) {
      return {
        response: `No specific tasks or deadlines were detected in this document.`,
        suggestedFollowUp: [
          'What is the overview summary?',
          'What are the main key points?',
          'Extract named entities'
        ]
      };
    }
    return {
      response: `Here is the list of actionable items and tasks detected in the text:\n\n${mock.actionItems.map(a => `• ${a}`).join('\n')}`,
      suggestedFollowUp: [
        'Who is responsible for these actions?',
        'What are the key dates mentioned?',
        'Can you show me the document overview?'
      ]
    };
  }

  return {
    response: `I have analyzed the document text (a ${mock.documentType} titled "${mock.suggestedTitle}"). You asked: "${currentQuestion}".\n\nBased on the text, this file discusses topics related to ${mock.tags.join(', ')}. Please let me know if you would like me to summarize the overview or extract key action items!`,
    suggestedFollowUp: [
      'Show me the document summary',
      'What are the key points?',
      'Suggest related learning resources'
    ]
  };
};

/**
 * AI Agent for handling contextual QA conversations about a document.
 * Returns raw string response.
 */
export const askDocumentQuestion = async (
  text: string,
  history: { sender: string; text: string }[],
  currentQuestion: string
): Promise<string> => {
  if (!isAIConfigured()) {
    const mock = getMockChatResponse(text, currentQuestion);
    return mock.response;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = chatPromptTemplate(text, history, currentQuestion);
    const result = await model.generateContent(prompt);
    return result.response.text() || 'I was unable to formulate an answer.';
  } catch (error: any) {
    console.error('Chat Agent Error:', error);
    const mock = getMockChatResponse(text, currentQuestion);
    return mock.response;
  }
};

/**
 * Agent 3: AI Chat Assistant Agent (with suggested follow-up questions).
 * Returns structured JSON containing the grounded answer and 3 follow-up questions.
 */
export const askDocumentQuestionWithFollowUps = async (
  text: string,
  history: { sender: string; text: string }[],
  currentQuestion: string
): Promise<ChatAgentResult> => {
  if (!isAIConfigured()) {
    return getMockChatResponse(text, currentQuestion);
  }

  const fallback: ChatAgentResult = {
    response: 'Unable to formulate an answer.',
    suggestedFollowUp: [
      'What is the main topic of the document?',
      'Can you list the key points discussed?',
      'Are there any deadlines or next actions?'
    ]
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = chatWithFollowUpsPromptTemplate(text, history, currentQuestion);
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
      response: parsed.response || fallback.response,
      suggestedFollowUp: Array.isArray(parsed.suggestedFollowUp) ? parsed.suggestedFollowUp : fallback.suggestedFollowUp,
    };
  } catch (error) {
    console.error('Chat Agent with FollowUps Error:', error);
    return getMockChatResponse(text, currentQuestion);
  }
};
