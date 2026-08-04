import express from 'express';
import { getAnalytics } from '../controllers/analyticsController';
import authenticateUser from '../middleware/auth';

const router = express.Router();

router.use(authenticateUser);
router.get('/', getAnalytics);

export default router;
