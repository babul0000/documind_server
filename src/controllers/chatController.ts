import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { geminiService } from '../services/geminiService';
import { genAI, isAIConfigured } from '../config/ai';
import { chatPromptTemplate } from '../ai/prompts/templates';

/**
 * Send a user message and generate a grounded contextual AI response.
 * Appends messages directly to the Conversation document's embedded array.
 */
export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId, text, conversationId } = req.body;

    if (!documentId || !text) {
      res.status(400).json({ error: 'documentId and text are required fields' });
      return;
    }

    // 1. Verify document exists and belongs to user
    const document = await Document.findOne({ _id: documentId, userId: req.user.userId });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // 2. Fetch or create a conversation context
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, userId: req.user.userId });
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
    } else {
      // Find latest conversation for this document or create a new one
      conversation = await Conversation.findOne({ documentId: document._id, userId: req.user.userId });
      if (!conversation) {
        conversation = new Conversation({
          userId: req.user.userId,
          documentId: document._id,
          title: `Chat with ${document.originalName}`,
          messages: [],
        });
        await conversation.save();
      }
    }

    // 3. Get recent conversation history from the array (last 15 messages)
    const rawHistory = conversation.messages.slice(-15);
    const formattedHistory = rawHistory.map((m: any) => ({
      sender: m.sender,
      text: m.text,
    }));

    // 4. Invoke Chat Agent with context + history + current query
    const aiResponseText = await geminiService.askDocumentQuestion(
      document.textContent,
      formattedHistory,
      text
    );

    // 5. Save user & AI messages directly in the conversation array
    const userMsgIndex = conversation.messages.push({
      sender: 'user',
      text: text,
    });
    
    const aiMsgIndex = conversation.messages.push({
      sender: 'ai',
      text: aiResponseText,
    });

    await conversation.save();

    const userMessage = conversation.messages[userMsgIndex - 1];
    const aiMessage = conversation.messages[aiMsgIndex - 1];

    res.status(201).json({
      conversationId: conversation._id,
      userMessage: {
        id: userMessage?._id,
        sender: userMessage?.sender,
        text: userMessage?.text,
        createdAt: (userMessage as any)?.createdAt || new Date(),
      },
      aiMessage: {
        id: aiMessage?._id,
        sender: aiMessage?.sender,
        text: aiMessage?.text,
        createdAt: (aiMessage as any)?.createdAt || new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all conversations.
 */
export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId } = req.query;
    const filter: any = { userId: req.user.userId };
    if (documentId) {
      filter.documentId = documentId;
    }

    const conversations = await Conversation.find(filter).sort({ updatedAt: -1 });

    res.status(200).json({
      conversations: conversations.map((c) => ({
        id: c._id,
        documentId: c.documentId,
        title: c.title,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages inside an embedded conversation document.
 */
export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      userId: req.user.userId,
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.status(200).json({
      messages: conversation.messages.map((m: any) => ({
        id: m._id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt || new Date(),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a user message and stream a grounded contextual AI response using Server-Sent Events (SSE).
 */
export const sendMessageStream = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId, text, conversationId } = req.body;

    if (!documentId || !text) {
      res.status(400).json({ error: 'documentId and text are required fields' });
      return;
    }

    // 1. Verify document exists and belongs to user
    const document = await Document.findOne({ _id: documentId, userId: req.user.userId });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // 2. Fetch or create a conversation context
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, userId: req.user.userId });
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
    } else {
      conversation = await Conversation.findOne({ documentId: document._id, userId: req.user.userId });
      if (!conversation) {
        conversation = new Conversation({
          userId: req.user.userId,
          documentId: document._id,
          title: `Chat with ${document.originalName}`,
          messages: [],
        });
        await conversation.save();
      }
    }

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const rawHistory = conversation.messages.slice(-15);
    const formattedHistory = rawHistory.map((m: any) => ({
      sender: m.sender,
      text: m.text,
    }));

    const mockResponseText = `Based on the document context, this file is identified as a "${document.category}". I have parsed its topics. You asked: "${text}".\n\nI can help you review compliance lists, write summaries, or identify other key action items. Let me know what you need!`;

    const followUps = [
      `Summarize the key takeaways of this ${document.category}`,
      'Show me the action items checklist',
      'List the main topics discussed'
    ];

    if (!isAIConfigured()) {
      // Simulate live streaming word by word for mock responses
      const words = mockResponseText.split(' ');
      let index = 0;

      const interval = setInterval(async () => {
        if (index < words.length) {
          const chunk = words[index] + ' ';
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
          index++;
        } else {
          clearInterval(interval);
          
          // Save in MongoDB
          conversation.messages.push({ sender: 'user', text });
          conversation.messages.push({ sender: 'ai', text: mockResponseText });
          await conversation.save();

          res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            conversationId: conversation._id,
            suggestedFollowUp: followUps
          })}\n\n`);
          res.end();
        }
      }, 50);

      return;
    }

    // 3. Setup Gemini Generative Model Stream
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = chatPromptTemplate(document.textContent, formattedHistory, text);
    const resultStream = await model.generateContentStream(prompt);

    let completeResponse = '';

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      completeResponse += chunkText;
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
    }

    // 4. Save messages in MongoDB once stream resolves
    conversation.messages.push({ sender: 'user', text });
    conversation.messages.push({ sender: 'ai', text: completeResponse });
    await conversation.save();

    res.write(`data: ${JSON.stringify({
      type: 'done',
      conversationId: conversation._id,
      suggestedFollowUp: followUps
    })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('Streaming sendMessage failed:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Stream processing failed' })}\n\n`);
    res.end();
  }
};

/**
 * Clear the entire message conversation history inside MongoDB.
 */
export const clearConversationHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { conversationId } = req.params;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId: req.user.userId },
      { $set: { messages: [] } },
      { new: true }
    );

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.status(200).json({ message: 'Conversation history cleared successfully', conversation });
  } catch (error) {
    next(error);
  }
};
