import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { AIReport } from '../models/AIReport';
import { Review } from '../models/Review';
import { parseDocument } from '../services/documentParser';
import { geminiService } from '../services/geminiService';

/**
 * Background worker to run AI analysis (summary & metadata extraction)
 * without blocking the HTTP response.
 */
const runBackgroundAIAnalysis = async (documentId: string, rawText: string) => {
  try {
    // Run summary and extractor in parallel using Promise.all
    const [summary, keyInfo] = await Promise.all([
      geminiService.generateSummary(rawText),
      geminiService.extractMetadata(rawText),
    ]);

    const doc = await Document.findById(documentId);
    
    // Respect user-selected category if it is not default 'Document'
    const category = doc && doc.category !== 'Document'
      ? doc.category
      : (keyInfo.documentType || 'Document');
      
    const tags = keyInfo.keyTopics || [];

    await Document.findByIdAndUpdate(documentId, {
      summary,
      keyInfo,
      category,
      tags,
      status: 'completed',
    });

    // Create a new AIReport document
    await AIReport.create({
      documentId,
      analysis: summary,
      insights: keyInfo,
    });
  } catch (error: any) {
    console.error(`AI Analysis worker failed for document ${documentId}:`, error);
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      error: error.message || 'AI analysis failed',
    });
  }
};

/**
 * Upload and parse document. Starts background AI summaries.
 * Accepts optional title, description, and category from multipart form fields.
 */
export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized request' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const { title, description, category, shortDescription, imageUrl } = req.body;

    // 1. Extract raw text from buffer based on file type
    let extractedText = '';
    try {
      extractedText = await parseDocument(buffer, mimetype);
    } catch (err: any) {
      console.error('❌ FILE EXTRACTION FAILED DETAILS:', err);
      res.status(422).json({ error: `File extraction failed: ${err.message}` });
      return;
    }

    if (!extractedText.trim()) {
      res.status(400).json({ error: 'Document appears to be empty or has no readable text.' });
      return;
    }

    // 2. Generate a unique name for database storage
    const uniqueFilename = `${req.user.userId}_${Date.now()}_${originalname}`;

    // 3. Create document record in database
    const document = new Document({
      userId: req.user.userId,
      title: title || originalname,
      description: description || '',
      shortDescription: shortDescription || '',
      imageUrl: imageUrl || '',
      category: category || 'Document',
      fileUrl: `uploads/${uniqueFilename}`,
      fileType: mimetype,
      filename: uniqueFilename,
      originalName: originalname,
      mimeType: mimetype,
      size: size,
      textContent: extractedText,
      status: 'processing',
    });

    await document.save();

    // 4. Trigger AI agents in the background
    runBackgroundAIAnalysis(document._id.toString(), extractedText);

    // Return the processing document representation
    res.status(202).json({
      message: 'File uploaded and is being analyzed with AI in the background',
      document: {
        id: document._id,
        title: document.title,
        description: document.description,
        category: document.category,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all documents uploaded by user.
 */
export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const documents = await Document.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .select('-textContent'); // Exclude heavy text content for general listing

    res.status(200).json({
      documents: documents.map((doc) => ({
        id: doc._id,
        title: doc.title,
        description: doc.description,
        shortDescription: doc.shortDescription || '',
        imageUrl: doc.imageUrl || '',
        fileUrl: doc.fileUrl,
        fileType: doc.fileType,
        category: doc.category,
        tags: doc.tags,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        status: doc.status,
        summary: doc.summary,
        keyInfo: doc.keyInfo,
        error: doc.error,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed document by ID.
 */
export const getDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(200).json({
      document: {
        id: document._id,
        title: document.title,
        description: document.description,
        shortDescription: document.shortDescription || '',
        imageUrl: document.imageUrl || '',
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        category: document.category,
        tags: document.tags || [],
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        status: document.status,
        textContent: document.textContent,
        summary: document.summary,
        keyInfo: document.keyInfo,
        error: document.error,
        createdAt: document.createdAt,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete a document, and purge all related conversations/messages.
 */
export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Pure cleanup: Delete conversations associated with this document
    await Conversation.deleteMany({ documentId: document._id });
    
    // Purge AIReports associated with this document
    try {
      await AIReport.deleteMany({ documentId: document._id });
    } catch (err) {
      // Gracefully handle if AIReport collections don't exist yet
    }

    res.status(200).json({
      message: 'Document, report, and associated conversations deleted successfully',
      deletedId: document._id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update document properties (title, category, tags).
 * Used for dynamic user-edits and saving smart classifications.
 */
export const updateDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, category, tags } = req.body;
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;

    const document = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: updateData },
      { new: true }
    );

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(200).json({
      message: 'Document updated successfully',
      document: {
        id: document._id.toString(),
        title: document.title,
        category: document.category,
        tags: document.tags,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a document publicly by ID (excluding textContent for privacy/bandwidth).
 */
export const getPublicDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const document = await Document.findById(req.params.id)
      .select('-textContent');

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(200).json({ document });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve related documents from MongoDB in the same category.
 */
export const getPublicRelatedDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const related = await Document.find({
      category: document.category,
      _id: { $ne: document._id },
    })
      .select('title category tags fileType createdAt description size status')
      .limit(4);

    res.status(200).json({ documents: related });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reviews list for a document.
 */
export const getReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await Review.find({ documentId: req.params.id }).sort({ createdAt: -1 });
    res.status(200).json({ reviews });
  } catch (error) {
    next(error);
  }
};

/**
 * Add review to document.
 */
export const addReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, rating, comment } = req.body;

    if (!name || !rating || !comment) {
      res.status(400).json({ error: 'All fields (name, rating, comment) are required.' });
      return;
    }

    const review = new Review({
      documentId: req.params.id,
      name,
      rating: Number(rating),
      comment,
    });

    await review.save();
    res.status(201).json({ message: 'Review added successfully', review });
  } catch (error) {
    next(error);
  }
};

/**
 * Public document contextual chat (AI Chat Panel).
 */
export const chatWithAgentPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text, history } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Message query is required' });
      return;
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const result = await geminiService.askDocumentQuestionWithFollowUps(
      document.textContent,
      history || [],
      text
    );

    res.status(200).json({
      documentId: document._id.toString(),
      response: result.response,
      suggestedFollowUp: result.suggestedFollowUp,
    });
  } catch (error) {
    next(error);
  }
};


