import { Request, Response } from 'express';
import categoryService from '../services/categoryService';
import catchAsync from '../utils/catchAsync';

export const getAvailable = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const categories = await categoryService.getAvailable(userId);

  res.status(200).json({
    status: 'success',
    data: { categories },
  });
});
