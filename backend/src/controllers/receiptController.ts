import { Request, Response } from 'express';
import receiptService from '../services/receiptService';
import catchAsync from '../utils/catchAsync';

export const upload = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const file = req.file;

  if (!file) {
    res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'No receipt image uploaded. Please select a JPG, PNG, or WEBP file.',
    });
    return;
  }

  const result = await receiptService.uploadAndExtract(userId, file);

  res.status(201).json({
    status: 'success',
    data: {
      receipt: {
        id: result.receipt.id,
        createdAt: result.receipt.createdAt,
      },
      extraction: result.extraction,
    },
  });
});

export const findAll = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const receipts = await receiptService.getReceipts(userId);

  res.status(200).json({
    status: 'success',
    data: { receipts },
  });
});

export const findById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const receipt = await receiptService.getReceiptById(userId, id);

  res.status(200).json({
    status: 'success',
    data: { receipt },
  });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  await receiptService.deleteReceipt(userId, id);

  res.status(200).json({
    status: 'success',
    message: 'Receipt deleted successfully',
  });
});
