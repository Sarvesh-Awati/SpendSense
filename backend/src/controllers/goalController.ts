import { Request, Response } from 'express';
import goalService from '../services/goalService';
import catchAsync from '../utils/catchAsync';

export const create = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const goal = await goalService.createGoal(userId, req.body);

  res.status(201).json({
    status: 'success',
    data: { goal },
  });
});

export const findAll = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const goals = await goalService.getGoals(userId);

  res.status(200).json({
    status: 'success',
    data: { goals },
  });
});

export const findById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const goal = await goalService.getGoalById(userId, id);

  res.status(200).json({
    status: 'success',
    data: { goal },
  });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const goal = await goalService.updateGoal(userId, id, req.body);

  res.status(200).json({
    status: 'success',
    data: { goal },
  });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  await goalService.deleteGoal(userId, id);

  res.status(200).json({
    status: 'success',
    message: 'Goal deleted successfully',
  });
});

export const contribute = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { amount } = req.body;
  const goal = await goalService.contributeToGoal(userId, id, amount);

  res.status(200).json({
    status: 'success',
    data: { goal },
  });
});
