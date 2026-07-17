import { Router } from 'express';
import { uploadDocument, listDocuments, getDocument, deleteDocument, updateDocument } from '../controllers/documentController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Secure all document endpoints
router.use(authenticateToken as any);

router.post('/upload', upload.single('file') as any, uploadDocument as any);
router.get('/', listDocuments as any);
router.get('/:id', getDocument as any);
router.put('/:id', updateDocument as any);
router.delete('/:id', deleteDocument as any);

export default router;
