import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import validate from '../middleware/validate';
import {
  create,
  findAll,
  findById,
  update,
  remove,
  contribute,
} from '../controllers/goalController';
import {
  createGoalSchema,
  updateGoalSchema,
  contributeGoalSchema,
} from '../validators/goal';

const router = Router();

// Apply auth middleware globally to all savings goals routes
router.use(authenticateUser);

router.post('/', validate(createGoalSchema), create);
router.get('/', findAll);
router.get('/:id', findById);
router.put('/:id', validate(updateGoalSchema), update);
router.delete('/:id', remove);
router.post('/:id/contribute', validate(contributeGoalSchema), contribute);

export default router;
