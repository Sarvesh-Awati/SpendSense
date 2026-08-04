import { Router } from 'express';
import authenticateUser from '../middleware/auth';
import { receiptUpload } from '../middleware/upload';
import {
  upload,
  findAll,
  findById,
  remove,
} from '../controllers/receiptController';

const router = Router();

// Apply auth middleware globally to all receipt routes
router.use(authenticateUser);

// Upload receipt image for AI extraction
router.post('/upload', receiptUpload.single('receipt'), upload);

// Fetch all receipts for the authenticated user
router.get('/', findAll);

// Fetch a single receipt by ID
router.get('/:id', findById);

// Delete a receipt by ID
router.delete('/:id', remove);

export default router;
