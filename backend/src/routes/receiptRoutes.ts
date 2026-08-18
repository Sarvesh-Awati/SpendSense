import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import validate from '../middleware/validate';
import { receiptUpload } from '../middleware/upload';
import { aiLimiter } from '../middleware/rateLimiter';
import { idParamSchema } from '../validators/common';
import {
  upload,
  findAll,
  findById,
  remove,
} from '../controllers/receiptController';

const router = Router();

// Apply auth middleware globally to all receipt routes
router.use(authenticateUser);

/**
 * Upload receipt image for AI extraction.
 *
 * Rate limited separately from the rest of the API: every call spends a
 * Gemini quota unit and holds a request open for seconds, so an authenticated
 * client looping here is both a cost and an availability problem.
 */
router.post('/upload', aiLimiter, receiptUpload.single('receipt'), upload);

// Fetch all receipts for the authenticated user
router.get('/', findAll);

// Fetch a single receipt by ID
router.get('/:id', validate(idParamSchema), findById);

// Delete a receipt by ID
router.delete('/:id', validate(idParamSchema), remove);

export default router;
