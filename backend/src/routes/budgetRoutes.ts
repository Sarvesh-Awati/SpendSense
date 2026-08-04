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

const router = Router();

// Apply auth middleware globally to all budget endpoints
router.use(authenticateUser);

router.post('/', validate(createBudgetSchema), create);
router.get('/', findAll);
router.get('/:id', findById);
router.put('/:id', validate(updateBudgetSchema), update);
router.delete('/:id', remove);

export default router;
