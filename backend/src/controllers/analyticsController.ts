import { Request, Response } from 'express';
import analyticsService from '../services/analyticsService';
import { catchAsync } from '../utils/catchAsync';

export const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = await analyticsService.getAnalytics(userId);
  
  res.status(200).json({
    status: 'success',
    data,
  });
});
