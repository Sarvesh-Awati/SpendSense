import { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import authService from '../services/authService';
import { comparePassword, hashPassword } from '../utils/password';

/**
 * Updates non-credential profile fields.
 *
 * SECURITY: this endpoint must never change `password` or `email`.
 * Both were previously accepted here with no re-authentication, which turned
 * any stolen access token into permanent account takeover. `updateProfileSchema`
 * no longer accepts either field, and neither is read below.
 */
export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const {
    firstName, lastName, profilePictureUrl, preferredCurrency,
    language, dateFormat, timeFormat, theme,
    budgetAlerts, savingsReminders, subscriptionRenewals, receiptScanNotifications, emailNotifications
  } = req.body;

  const updateData: any = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
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

/**
 * The only path by which a password may be changed.
 * Requires the current password, enforces the shared complexity policy via
 * `changePasswordSchema`, revokes every existing session, and hands the
 * caller a fresh token pair so their own session survives.
 */
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

  // Changing a password is the standard response to suspected compromise, so
  // every previously issued refresh token must stop working.
  await authService.revokeAllSessions(userId);

  // Re-issue a session for the caller so they are not logged out of the
  // device they just used to change the password.
  const tokens = await authService.issueSessionForUser(userId);

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
    data: { tokens },
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

/**
 * Permanently deletes the account and all cascading financial records.
 *
 * SECURITY: irreversible and destructive, so it requires re-authentication.
 * A bearer token alone is not sufficient, and the frontend confirmation
 * dialog is not a control an API caller has to pass through.
 */
export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { currentPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await comparePassword(currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError('Incorrect current password', 401);

  // Revoke sessions explicitly before deletion. The cascade would remove the
  // rows anyway, but doing it first means a failure part-way through leaves
  // no usable sessions behind.
  await authService.revokeAllSessions(userId);

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
