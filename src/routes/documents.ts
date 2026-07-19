import { Router } from 'express';
import { 
  uploadDocument, listDocuments, getDocument, deleteDocument, updateDocument,
  getPublicDocument, getPublicRelatedDocuments, getReviews, addReview, chatWithAgentPublic,
  listPublicDocuments, chatWithAgentPublicStream, generalChatStream
} from '../controllers/documentController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Publicly accessible endpoints
router.get('/test-public', (req, res) => {
  res.json({ success: true, message: 'Public route is fully operational!' });
});
router.get('/public-list', listPublicDocuments as any);
router.post('/public/general/chat-stream', generalChatStream as any);
router.get('/public/:id', getPublicDocument as any);
router.get('/public/:id/related', getPublicRelatedDocuments as any);
router.get('/public/:id/reviews', getReviews as any);
router.post('/public/:id/reviews', addReview as any);
router.post('/public/:id/chat', chatWithAgentPublic as any);
router.post('/public/:id/chat-stream', chatWithAgentPublicStream as any);

// Secure all document endpoints below this line
router.use(authenticateToken as any);

router.post('/upload', upload.single('file') as any, uploadDocument as any);
router.get('/', listDocuments as any);
router.get('/:id', getDocument as any);
router.put('/:id', updateDocument as any);
router.delete('/:id', deleteDocument as any);

export default router;
