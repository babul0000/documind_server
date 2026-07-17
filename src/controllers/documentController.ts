import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { AIReport } from '../models/AIReport';
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
    const { title, description, category } = req.body;

    // 1. Extract raw text from buffer based on file type
    let extractedText = '';
    try {
      extractedText = await parseDocument(buffer, mimetype);
    } catch (err: any) {
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
