import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import { getAvailable } from '../controllers/categoryController';

const router = Router();

router.use(authenticateUser);

router.get('/', getAvailable);

export default router;
