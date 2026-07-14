import { Notification } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super(prisma.notification);
  }

  async findByUserId(userId: string, isRead?: boolean): Promise<Notification[]> {
    return this.modelDelegate.findMany({
      where: {
        userId,
        isRead: isRead !== undefined ? isRead : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.modelDelegate.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return this.modelDelegate.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}

export default new NotificationRepository();
