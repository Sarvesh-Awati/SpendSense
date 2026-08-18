import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from '../validators/subscription';
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
} from '../controllers/subscriptionController';
import { idParamSchema } from '../validators/common';

const router = Router();

// Apply auth middleware globally to all subscription routes
router.use(authenticateUser);

router.post('/', validate(createSubscriptionSchema), createSubscription);
router.get('/', getSubscriptions);
router.get('/:id', validate(idParamSchema), getSubscriptionById);
router.put('/:id', validate(idParamSchema), validate(updateSubscriptionSchema), updateSubscription);
router.delete('/:id', validate(idParamSchema), deleteSubscription);

export default router;
