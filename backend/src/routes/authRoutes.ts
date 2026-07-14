import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticateUser } from '../middleware/auth';
import {
  register,
  login,
  refresh,
  logout,
  me,
} from '../controllers/authController';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from '../validators/auth';

const router = Router();

// Public auth endpoints with rate limiting
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);

// Session endpoints (no auth guard required on server refresh since the expired access token is not passed,
// and the refresh token validates identity; but we do validation check on body)
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(refreshSchema), logout);

// Protected endpoints
router.get('/me', authenticateUser, me);

export default router;
