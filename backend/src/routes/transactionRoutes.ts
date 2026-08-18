import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import validate from '../middleware/validate';
import {
  create,
  findAll,
  findById,
  update,
  remove,
} from '../controllers/transactionController';
import {
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionsQuerySchema,
} from '../validators/transaction';
import { idParamSchema } from '../validators/common';

const router = Router();

// Apply auth guard globally to all transaction routes
router.use(authenticateUser);

router.post('/', validate(createTransactionSchema), create);
router.get('/', validate(getTransactionsQuerySchema), findAll);
router.get('/:id', validate(idParamSchema), findById);
router.put('/:id', validate(idParamSchema), validate(updateTransactionSchema), update);
router.delete('/:id', validate(idParamSchema), remove);

export default router;
