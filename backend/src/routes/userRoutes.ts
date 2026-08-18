import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticateUser } from '../middleware/auth';
import { sensitiveActionLimiter } from '../middleware/rateLimiter';
import { 
  updateProfile, 
  changePassword, 
  logoutAllDevices, 
  deleteAccount, 
  exportData 
} from '../controllers/userController';
import { updateProfileSchema, changePasswordSchema, deleteAccountSchema } from '../validators/user';

const router = Router();

router.use(authenticateUser);

router.put('/profile', validate(updateProfileSchema), updateProfile);
// Both of these verify `currentPassword`, so both are brute-force targets.
router.post(
  '/change-password',
  sensitiveActionLimiter,
  validate(changePasswordSchema),
  changePassword
);
router.post('/logout-all', logoutAllDevices);
router.get('/export', exportData);
// Requires currentPassword in the body — see deleteAccountSchema.
router.delete(
  '/account',
  sensitiveActionLimiter,
  validate(deleteAccountSchema),
  deleteAccount
);

export default router;
