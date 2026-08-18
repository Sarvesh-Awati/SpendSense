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
import { idParamSchema } from '../validators/common';

const router = Router();

// Apply auth middleware globally to all savings goals routes
router.use(authenticateUser);

router.post('/', validate(createGoalSchema), create);
router.get('/', findAll);
router.get('/:id', validate(idParamSchema), findById);
router.put('/:id', validate(idParamSchema), validate(updateGoalSchema), update);
router.delete('/:id', validate(idParamSchema), remove);
router.post('/:id/contribute', validate(idParamSchema), validate(contributeGoalSchema), contribute);

export default router;
