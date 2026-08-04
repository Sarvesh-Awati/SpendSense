import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../database/prisma';
import { AppError } from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import { comparePassword, hashPassword } from '../utils/password';

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { 
    firstName, lastName, email, password, profilePictureUrl, preferredCurrency,
    language, dateFormat, timeFormat, theme,
    budgetAlerts, savingsReminders, subscriptionRenewals, receiptScanNotifications, emailNotifications
  } = req.body;

  // Check if email is being updated and if it already exists
  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== userId) {
      throw new AppError('Email is already in use', 400);
    }
  }

  const updateData: any = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;
  if (preferredCurrency !== undefined) updateData.preferredCurrency = preferredCurrency;
  if (language !== undefined) updateData.language = language;
  if (dateFormat !== undefined) updateData.dateFormat = dateFormat;
  if (timeFormat !== undefined) updateData.timeFormat = timeFormat;
  if (theme !== undefined) updateData.theme = theme;
  if (budgetAlerts !== undefined) updateData.budgetAlerts = budgetAlerts;
  if (savingsReminders !== undefined) updateData.savingsReminders = savingsReminders;
  if (subscriptionRenewals !== undefined) updateData.subscriptionRenewals = subscriptionRenewals;
  if (receiptScanNotifications !== undefined) updateData.receiptScanNotifications = receiptScanNotifications;
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

  if (profilePictureUrl !== undefined) {
    updateData.profilePictureUrl = profilePictureUrl === '' ? null : profilePictureUrl;
  }

  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      preferredCurrency: true,
      language: true,
      dateFormat: true,
      timeFormat: true,
      theme: true,
      budgetAlerts: true,
      savingsReminders: true,
      subscriptionRenewals: true,
      receiptScanNotifications: true,
      emailNotifications: true,
      createdAt: true,
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await comparePassword(currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError('Incorrect current password', 401);

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword },
  });

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

export const logoutAllDevices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out from all devices',
  });
});

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  // Due to onDelete: Cascade on user relations, deleting user will delete their data
  await prisma.user.delete({
    where: { id: userId },
  });

  res.status(200).json({
    status: 'success',
    message: 'Account permanently deleted',
  });
});

export const exportData = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      categories: true,
      transactions: true,
      budgets: true,
      goals: true,
      subscriptions: true,
    },
  });

  if (!user) throw new AppError('User not found', 404);

  // Exclude sensitive data
  const { passwordHash, ...userData } = user;

  res.status(200).json({
    status: 'success',
    data: userData,
  });
});
