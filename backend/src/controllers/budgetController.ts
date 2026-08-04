import { Request, Response } from 'express';
import budgetService from '../services/budgetService';
import catchAsync from '../utils/catchAsync';

export const create = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const budget = await budgetService.create(userId, req.body);

  res.status(201).json({
    status: 'success',
    data: { budget },
  });
});

export const findAll = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const budgets = await budgetService.findAll(userId);

  res.status(200).json({
    status: 'success',
    data: { budgets },
  });
});

export const findById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const budget = await budgetService.findById(userId, id);

  res.status(200).json({
    status: 'success',
    data: { budget },
  });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const budget = await budgetService.update(userId, id, req.body);

  res.status(200).json({
    status: 'success',
    data: { budget },
  });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  await budgetService.delete(userId, id);

  res.status(200).json({
    status: 'success',
    message: 'Budget deleted successfully',
  });
});
