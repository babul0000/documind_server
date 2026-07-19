import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import { AIReport } from '../models/AIReport';
import { Review } from '../models/Review';
import { parseDocument } from '../services/documentParser';
import { geminiService } from '../services/geminiService';
import { genAI, isAIConfigured } from '../config/ai';
import { chatPromptTemplate } from '../ai/prompts/templates';

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

    // Prevent duplicate uploads by checking if a file with the same name and size exists
    const duplicate = await Document.findOne({
      userId: req.user.userId,
      originalName: originalname,
      size,
    });

    if (duplicate) {
      res.status(409).json({ error: 'Duplicate document detected. A file with this name and size already exists in your library.' });
      return;
    }

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
 * List all completed public documents in the system.
 */
export const listPublicDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const documents = await Document.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .select('-textContent');

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
        tags: doc.tags || [],
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
      $or: [
        { userId: req.user.userId },
        { status: 'completed' }
      ]
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
    const reviews = await Review.find({ documentId: req.params.id } as any).sort({ createdAt: -1 });
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

/**
 * Public document contextual chat with Server-Sent Events (SSE) streaming.
 */
export const chatWithAgentPublicStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const formattedHistory = (history || []).map((m: any) => ({
      sender: m.role === 'user' ? 'user' : 'ai',
      text: m.text,
    }));

    const mockResponseText = `Based on the public document context, this file is identified as a "${document.category}". I have parsed its topics. You asked: "${text}".\n\nI can help you review compliance lists, write summaries, or identify other key action items. Let me know what you need!`;

    const followUps = [
      `Summarize the key takeaways of this ${document.category}`,
      'Show me the action items checklist',
      'List the main topics discussed'
    ];

    try {
      if (!isAIConfigured()) {
        throw new Error('Invalid Gemini Key. Use fallback mock.');
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const prompt = chatPromptTemplate(document.textContent, formattedHistory, text);
      const resultStream = await model.generateContentStream(prompt);

      for await (const chunk of resultStream.stream) {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        suggestedFollowUp: followUps
      })}\n\n`);
      res.end();
    } catch (apiErr) {
      console.warn('Gemini details chat stream call failed, running mock streaming fallback:', apiErr);
      
      const words = mockResponseText.split(' ');
      let index = 0;

      const interval = setInterval(async () => {
        if (index < words.length) {
          const chunk = words[index] + ' ';
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
          index++;
        } else {
          clearInterval(interval);
          res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            suggestedFollowUp: followUps
          })}\n\n`);
          res.end();
        }
      }, 50);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to dynamically generate rich organic responses for local verification / placeholder key modes.
 */
const generateDynamicMockResponse = (text: string, userDocsContext: string, isGuest: boolean): string => {
  const query = text.toLowerCase();
  
  if (query.includes('upload') || query.includes('add file') || query.includes('how to submit')) {
    return `To upload a document in DocuMind, navigate to the dashboard workspace at /documents/add (or /items/add). You can upload PDF, DOCX, or TXT files up to 10MB. Once submitted, the system automatically triggers our AI analysis pipelines to extract executive summaries, key topics, and action item lists.`;
  }
  
  if (query.includes('feature') || query.includes('what does') || query.includes('capabilities') || query.includes('do for me')) {
    return `DocuMind AI is a modern AI Knowledge Intelligence Platform similar to Notion AI and ChatGPT. It provides:
1. RAG-Powered Contextual AI Chat beside each document.
2. AI Document Summarization (Executive Summaries, Core Points, and Action Items).
3. Entity Extractor (Important Dates, People, and Organizations).
4. Interactive Reviews & Ratings.
5. Analytical Dashboard graphs showing file sizes and categories.`;
  }
  
  if (query.includes('summar') || query.includes('txt') || query.includes('pdf') || query.includes('docx') || query.includes('format')) {
    return `Yes! DocuMind supports PDF, Microsoft Word (DOCX), and plain text (TXT) files up to 10MB. The AI processes these formats to extract structured text notes, summary sheets, and custom tagging classifications dynamically.`;
  }
  
  if (query.includes('document') || query.includes('file') || query.includes('what do i have') || query.includes('list')) {
    return `Checking the active MongoDB state...\n\n${userDocsContext}\n\nYou can explore these documents directly on the Explore Documents page or manage them from your dashboard workspace.`;
  }
  
  if (query.includes('quota') || query.includes('storage') || query.includes('space') || query.includes('limit')) {
    return `Every registered member gets a storage quota of up to 10MB. You can check your active storage consumption dials and verify badges on your My Profile page (/profile).`;
  }
  
  // General chat assistant response echoing query keywords
  return `Hello! I am your DocuMind AI virtual assistant. I analyzed your query: "${text}".
DocuMind is designed to turn your static files into an interactive knowledge base. 
You can:
- Upload files at /documents/add
- Manage your library at /documents/manage
- Inspect detailed summaries on any document's details page
- Chat contextually with a specific file

How can I help you further with your workspace?`;
};

/**
 * Generic global AI chat assistant with SSE streaming.
 * Checks active Better Auth sessions and user documents, feeding actual database state into Gemini.
 */
export const generalChatStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text, history } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Message query is required' });
      return;
    }

    // Attempt to identify active user session from cookies or headers
    let userContext: any = null;
    const authHeader = req.headers['authorization'];
    let token: string | undefined = authHeader && authHeader.split(' ')[1];

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (token) {
      const db = mongoose.connection.db;
      if (db) {
        const session = await db.collection('session').findOne({ token });
        if (session) {
          const userObj = await db.collection('user').findOne({ _id: session.userId });
          if (userObj) {
            userContext = {
              userId: userObj._id.toString(),
              name: userObj.name,
              email: userObj.email,
            };
          }
        }
      }
    }

    // Build real-time database context of uploaded documents
    let userDocumentsContext = '';
    if (userContext) {
      const userDocs = await Document.find({ userId: userContext.userId })
        .select('title category tags fileType createdAt size description')
        .limit(10);

      if (userDocs.length === 0) {
        userDocumentsContext = `The user is logged in as "${userContext.name}" (${userContext.email}), but they have not uploaded any documents yet. They can upload documents at /documents/add.`;
      } else {
        userDocumentsContext = `The user is logged in as "${userContext.name}" (${userContext.email}). They have uploaded the following documents in their personal library:\n` +
          userDocs.map((d, i) => `${i+1}. Title: "${d.title}" | Category: "${d.category}" | Format: "${d.fileType}" | Size: ${(d.size/1024).toFixed(1)} KB | Tags: ${d.tags.join(', ')} | Description: "${d.description || 'None'}"`).join('\n');
      }
    } else {
      const publicDocs = await Document.find({}).limit(5).select('title category description');
      userDocumentsContext = `The user is a guest (not logged in). The platform contains the following public documents in the registry:\n` +
        publicDocs.map((d, i) => `${i+1}. Title: "${d.title}" | Category: "${d.category}" | Description: "${d.description || 'None'}"`).join('\n');
    }

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const formattedHistory = (history || []).map((m: any) => ({
      sender: m.role === 'user' ? 'user' : 'ai',
      text: m.text,
    }));

    const mockResponseText = generateDynamicMockResponse(text, userDocumentsContext, !userContext);

    const followUps = [
      'What documents do I have?',
      'How do I upload a document?',
      'Can you explain my storage quota?'
    ];

    try {
      if (!isAIConfigured()) {
        throw new Error('Invalid Gemini Key. Use fallback mock.');
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      
      const systemInstruction = `You are DocuMind AI, the official virtual assistant for DocuMind AI - the AI Knowledge Intelligence Platform.
DocuMind lets users upload PDFs, Word files (DOCX), and text notes (TXT) up to 10MB.
You have access to the user's active database documents list provided in "Active Database State Context".
Answer user questions organically based on this database state. Do not invent files. If they ask what files they have, list them.
Be concise, professional, and helpful.`;

      const prompt = `${systemInstruction}\n\nActive Database State Context:\n${userDocumentsContext}\n\nChat History:\n${formattedHistory.map((h: any) => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}\n\nUser: ${text}\nAssistant:`;
      const resultStream = await model.generateContentStream(prompt);

      for await (const chunk of resultStream.stream) {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        suggestedFollowUp: followUps
      })}\n\n`);
      res.end();
    } catch (apiErr) {
      console.warn('Gemini general assistant stream call failed, running mock streaming fallback:', apiErr);
      
      const words = mockResponseText.split(' ');
      let index = 0;

      const interval = setInterval(async () => {
        if (index < words.length) {
          const chunk = words[index] + ' ';
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
          index++;
        } else {
          clearInterval(interval);
          res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            suggestedFollowUp: followUps
          })}\n\n`);
          res.end();
        }
      }, 50);
    }

  } catch (error) {
    next(error);
  }
};


