import receiptRepository from '../repositories/ReceiptRepository';
import aiService, { ReceiptExtractionResult } from './aiService';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import { Receipt, Prisma } from '@prisma/client';

/**
 * Response shape for receipt uploads — includes both the DB record and AI extraction.
 */
export interface ReceiptWithExtraction {
  receipt: Receipt;
  extraction: ReceiptExtractionResult;
}

/**
 * List-view projection of a receipt: everything except the base64 image and
 * the raw model response. See `getReceipts`.
 */
export interface ReceiptSummary {
  id: string;
  extractedMerchant: string | null;
  extractedAmount: Prisma.Decimal | null;
  extractedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Present when this receipt has been turned into a transaction. */
  transaction: { id: string } | null;
}

/**
 * Receipt Service — orchestrates file upload, AI extraction, and DB storage.
 *
 * Design Decision: The upload endpoint stores the receipt image as a base64
 * data URL in the database (imageUrl field). In production, this would be
 * replaced with cloud storage (S3/GCS) to avoid bloating the database.
 * For development, base64 storage avoids external cloud dependencies.
 */
export class ReceiptService {
  /**
   * Upload a receipt image, run AI extraction, and persist both to the database.
   * Returns the created receipt record alongside the structured extraction result.
   */
  async uploadAndExtract(
    userId: string,
    file: Express.Multer.File
  ): Promise<ReceiptWithExtraction> {
    if (!file || !file.buffer) {
      throw new BadRequestError('No file uploaded');
    }

    // 1. Run AI extraction on the image buffer
    const extraction = await aiService.extractReceiptData(file.buffer, file.mimetype);

    // 2. Create a data URL for storage (dev environment — production would use cloud storage)
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    /**
     * 3. Persist receipt with extracted fields.
     *
     * `extraction.date` and `extraction.amount` have already been validated in
     * aiService — the date is a real YYYY-MM-DD and the amount fits the money
     * column. Before that, a model reply of `"date": "unknown"` produced an
     * Invalid Date here and Prisma rejected the whole upload with a 500.
     */
    const receipt = await receiptRepository.create({
      imageUrl: base64Image,
      rawText: JSON.stringify(extraction),
      extractedMerchant: extraction.merchant,
      extractedAmount: extraction.amount != null ? new Prisma.Decimal(extraction.amount) : null,
      extractedDate: extraction.date ? new Date(`${extraction.date}T00:00:00.000Z`) : null,
      userId,
    });

    return { receipt, extraction };
  }

  /**
   * Fetch all receipts belonging to a user, ordered by most recent.
   *
   * `imageUrl` and `rawText` are deliberately omitted. Images are stored as
   * base64 data URLs, so a list of twenty receipts was a multi-megabyte JSON
   * response in which every byte of every image was serialised to render a
   * list of dates and merchant names. The full record — image included —
   * remains available from `GET /receipts/:id`.
   */
  async getReceipts(userId: string): Promise<ReceiptSummary[]> {
    return receiptRepository.findSummariesByUserId(userId);
  }

  /**
   * Fetch a single receipt with strict tenant isolation.
   */
  async getReceiptById(userId: string, id: string): Promise<Receipt> {
    const receipt = await receiptRepository.findById(id);
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundError('Receipt not found');
    }
    return receipt;
  }

  /**
   * Delete a receipt with strict tenant isolation.
   */
  async deleteReceipt(userId: string, id: string): Promise<Receipt> {
    const receipt = await receiptRepository.findById(id);
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundError('Receipt not found');
    }
    return receiptRepository.delete(id);
  }
}

export default new ReceiptService();
