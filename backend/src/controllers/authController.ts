import { Request, Response } from 'express';
import authService from '../services/authService';
import catchAsync from '../utils/catchAsync';

export const register = catchAsync(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await authService.register({ firstName, lastName, email, password });
  
  res.status(201).json({
    status: 'success',
    data: { user },
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { tokens, user } = await authService.login({ email, password });

  res.status(200).json({
    status: 'success',
    data: { tokens, user },
  });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const tokens = await authService.refresh(refreshToken);

  res.status(200).json({
    status: 'success',
    data: { tokens },
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

export const me = catchAsync(async (req: Request, res: Response) => {
  // req.user is populated by authenticateUser middleware
  const userId = req.user!.id;
  const user = await authService.getCurrentUser(userId);

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});
