import { Router } from 'express';
import { 
  getLatestRecommendation, refineRecommendations, getRecommendationHistory 
} from '../controllers/recommendationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all recommendation endpoints
router.use(authenticateToken as any);

router.get('/', getLatestRecommendation as any);
router.post('/refine', refineRecommendations as any);
router.get('/history', getRecommendationHistory as any);

export default router;
