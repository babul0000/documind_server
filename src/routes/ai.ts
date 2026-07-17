import { Router } from 'express';
import { 
  analyzeDocument, 
  classifyDocument, 
  chatWithAgent, 
  recommendNextSteps 
} from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all Agentic AI endpoints
router.use(authenticateToken as any);

router.post('/analyze', analyzeDocument as any);
router.post('/classify', classifyDocument as any);
router.post('/chat', chatWithAgent as any);
router.post('/recommend', recommendNextSteps as any);

export default router;
