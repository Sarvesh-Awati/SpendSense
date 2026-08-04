import { Request, Response } from 'express';
import subscriptionService from '../services/subscriptionService';
import catchAsync from '../utils/catchAsync';

export const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const subscription = await subscriptionService.createSubscription(userId, req.body);
  
  res.status(201).json({
    status: 'success',
    data: { subscription },
  });
});

export const getSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const subscriptions = await subscriptionService.getSubscriptions(userId);
  
  res.status(200).json({
    status: 'success',
    data: { subscriptions },
  });
});

export const getSubscriptionById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const subscription = await subscriptionService.getSubscriptionById(userId, id);
  
  res.status(200).json({
    status: 'success',
    data: { subscription },
  });
});

export const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const subscription = await subscriptionService.updateSubscription(userId, id, req.body);
  
  res.status(200).json({
    status: 'success',
    data: { subscription },
  });
});

export const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  await subscriptionService.deleteSubscription(userId, id);
  
  res.status(200).json({
    status: 'success',
    message: 'Subscription deleted successfully',
  });
});
