import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import { getMetrics } from '../controllers/dashboardController';

const router = Router();

router.use(authenticateUser);

router.get('/', getMetrics);

export default router;
