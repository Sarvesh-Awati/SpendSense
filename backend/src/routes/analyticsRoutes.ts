import express from 'express';
import { getAnalytics, getInsights } from '../controllers/analyticsController';
import authenticateUser from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.use(authenticateUser);

router.get('/', getAnalytics);

// Rate limited: every call spends Gemini quota. See aiLimiter.
router.get('/insights', aiLimiter, getInsights);

export default router;
