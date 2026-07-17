import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { geminiService } from '../services/geminiService';

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
