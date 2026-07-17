import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { geminiService } from '../services/geminiService';

/**
 * Controller for handling advanced Agentic AI operations.
 */

/**
 * POST /ai/analyze
 * Document Analyzer Agent endpoint. Returns structured executive summary, key points, sections, and action items.
 */
export const analyzeDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId } = req.body;
    if (!documentId) {
      res.status(400).json({ error: 'documentId is required' });
      return;
    }

    const document = await Document.findOne({ _id: documentId, userId: req.user.userId });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const analysis = await geminiService.analyzeDocumentText(document.textContent);
    res.status(200).json({ documentId, analysis });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/classify
 * Classification Agent endpoint. Suggests a category, tags list, and clean title based on text content.
 */
export const classifyDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId } = req.body;
    if (!documentId) {
      res.status(400).json({ error: 'documentId is required' });
      return;
    }

    const document = await Document.findOne({ _id: documentId, userId: req.user.userId });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const classification = await geminiService.classifyDocumentText(document.textContent);
    res.status(200).json({ documentId, classification });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/chat
 * AI Chat Assistant Agent endpoint. Returns grounded answers alongside exactly 3 follow-up questions.
 */
export const chatWithAgent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId, text, history } = req.body;
    if (!documentId || !text) {
      res.status(400).json({ error: 'documentId and text are required fields' });
      return;
    }

    const document = await Document.findOne({ _id: documentId, userId: req.user.userId });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const result = await geminiService.askDocumentQuestionWithFollowUps(
      document.textContent,
      history || [],
      text
    );

    res.status(200).json({ documentId, response: result.response, suggestedFollowUp: result.suggestedFollowUp });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/recommend
 * Recommendation Agent endpoint. Suggests related files from library, study resources, and priority next tasks.
 */
export const recommendNextSteps = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId } = req.body;
    if (!documentId) {
      res.status(400).json({ error: 'documentId is required' });
      return;
    }

    // 1. Get active document
    const document = await Document.findOne({ _id: documentId, userId: req.user.userId });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // 2. Fetch other files from user library to recommend
    const otherDocsRaw = await Document.find({
      userId: req.user.userId,
      _id: { $ne: document._id },
    }).select('title category tags');

    const otherDocs = otherDocsRaw.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      category: d.category,
      tags: d.tags || [],
    }));

    const recommendations = await geminiService.generateRecommendations(
      document.title,
      document.summary || '',
      document.category,
      document.tags || [],
      otherDocs
    );

    res.status(200).json({ documentId, recommendations });
  } catch (error) {
    next(error);
  }
};
