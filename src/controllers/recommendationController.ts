import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { Recommendation } from '../models/Recommendation';
import { runRecommendationEngine } from '../ai/agents/recommendationEngineAgent';

/**
 * Fetch the latest recommendation for the active user.
 * Automatically runs the engine if no recommendation exists.
 */
export const getLatestRecommendation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user.userId;

    // Try finding the most recent recommendation
    const latest = await Recommendation.findOne({ userId }).sort({ createdAt: -1 });

    if (latest) {
      res.status(200).json({ recommendation: latest });
      return;
    }

    // If none exists, compile and generate initial recommendations
    const documents = await Document.find({ userId });
    
    if (documents.length === 0) {
      res.status(200).json({ recommendation: null, message: 'Upload documents to activate recommendation services.' });
      return;
    }

    const conversations = await Conversation.find({ userId });
    const userQueries = conversations.flatMap(
      (c) => c.messages?.filter((m) => m.sender === 'user').map((m) => m.text) || []
    );

    const formattedDocs = documents.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      category: d.category,
      tags: d.tags || [],
      summary: d.summary || '',
    }));

    const result = await runRecommendationEngine(formattedDocs, userQueries);

    const newRecommendation = new Recommendation({
      userId,
      userRefinement: '',
      recommendations: result,
      rawAIResponse: JSON.stringify(result),
    });

    await newRecommendation.save();
    res.status(201).json({ recommendation: newRecommendation });

  } catch (error) {
    next(error);
  }
};

/**
 * Refine recommendations based on user feedback.
 * Generates a new recommendation instance to preserve history.
 */
export const refineRecommendations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { refinement } = req.body;
    if (!refinement) {
      res.status(400).json({ error: 'Refinement instruction is required.' });
      return;
    }

    const userId = req.user.userId;
    const documents = await Document.find({ userId });

    if (documents.length === 0) {
      res.status(400).json({ error: 'No documents uploaded yet to recommend.' });
      return;
    }

    const conversations = await Conversation.find({ userId });
    const userQueries = conversations.flatMap(
      (c) => c.messages?.filter((m) => m.sender === 'user').map((m) => m.text) || []
    );

    const formattedDocs = documents.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      category: d.category,
      tags: d.tags || [],
      summary: d.summary || '',
    }));

    const result = await runRecommendationEngine(formattedDocs, userQueries, refinement);

    const newRecommendation = new Recommendation({
      userId,
      userRefinement: refinement,
      recommendations: result,
      rawAIResponse: JSON.stringify(result),
    });

    await newRecommendation.save();
    res.status(201).json({ recommendation: newRecommendation });

  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve recommendation history logs.
 */
export const getRecommendationHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const history = await Recommendation.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.status(200).json({ history });
  } catch (error) {
    next(error);
  }
};
