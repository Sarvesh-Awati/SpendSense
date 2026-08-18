import { Request, Response } from 'express';
import analyticsService from '../services/analyticsService';
import { catchAsync } from '../utils/catchAsync';

export const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  /**
   * `includeInsights=false` opts out of the blocking Gemini call.
   *
   * Default `true` preserves the original contract for any client that does
   * not know about the flag; the SpendSense UI opts out and fetches
   * `/analytics/insights` alongside, so charts are not held behind the model.
   */
  const includeInsights = req.query.includeInsights !== 'false';

  const data = await analyticsService.getAnalytics(userId, includeInsights);

  res.status(200).json({
    status: 'success',
    data,
  });
});

/**
 * AI insights in isolation.
 *
 * Separate endpoint so the advisor panel has its own loading, error and retry
 * state instead of being able to stall the entire analytics page.
 */
export const getInsights = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const aiInsights = await analyticsService.getInsights(userId);

  res.status(200).json({
    status: 'success',
    data: { aiInsights },
  });
});
