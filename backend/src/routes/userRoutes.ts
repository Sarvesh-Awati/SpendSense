import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticateUser } from '../middleware/auth';
import { 
  updateProfile, 
  changePassword, 
  logoutAllDevices, 
  deleteAccount, 
  exportData 
} from '../controllers/userController';
import { updateProfileSchema, changePasswordSchema } from '../validators/user';

const router = Router();

router.use(authenticateUser);

router.put('/profile', validate(updateProfileSchema), updateProfile);
router.post('/change-password', validate(changePasswordSchema), changePassword);
router.post('/logout-all', logoutAllDevices);
router.get('/export', exportData);
router.delete('/account', deleteAccount);

export default router;
