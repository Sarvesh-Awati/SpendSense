import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import validate from '../middleware/validate';
import {
  create,
  findAll,
  findById,
  update,
  remove,
} from '../controllers/budgetController';
import {
  createBudgetSchema,
  updateBudgetSchema,
} from '../validators/budget';
import { idParamSchema } from '../validators/common';

const router = Router();

// Apply auth middleware globally to all budget endpoints
router.use(authenticateUser);

router.post('/', validate(createBudgetSchema), create);
router.get('/', findAll);
router.get('/:id', validate(idParamSchema), findById);
router.put('/:id', validate(idParamSchema), validate(updateBudgetSchema), update);
router.delete('/:id', validate(idParamSchema), remove);

export default router;
