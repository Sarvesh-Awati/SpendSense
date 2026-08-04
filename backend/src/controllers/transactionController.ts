import { Request, Response } from 'express';
import transactionService from '../services/transactionService';
import catchAsync from '../utils/catchAsync';

export const create = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const transaction = await transactionService.create(userId, req.body);

  res.status(201).json({
    status: 'success',
    data: { transaction },
  });
});

export const findAll = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  // Cast query parameters (parsed by validate getTransactionsQuerySchema)
  const result = await transactionService.findAll(userId, req.query as any);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const findById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const transaction = await transactionService.findById(userId, id);

  res.status(200).json({
    status: 'success',
    data: { transaction },
  });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const transaction = await transactionService.update(userId, id, req.body);

  res.status(200).json({
    status: 'success',
    data: { transaction },
  });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  await transactionService.delete(userId, id);

  res.status(200).json({
    status: 'success',
    message: 'Transaction deleted successfully',
  });
});
