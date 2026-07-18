import { Router } from 'express';
import { 
  sendMessage, getConversations, getMessages, sendMessageStream, clearConversationHistory 
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all chat endpoints
router.use(authenticateToken as any);

router.post('/message', sendMessage as any);
router.post('/message/stream', sendMessageStream as any);
router.get('/conversations', getConversations as any);
router.get('/conversations/:conversationId/messages', getMessages as any);
router.delete('/conversations/:conversationId', clearConversationHistory as any);

export default router;
