import { Goal } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class GoalRepository extends BaseRepository<Goal> {
  constructor() {
    super(prisma.goal);
  }

  async findByUserId(userId: string): Promise<Goal[]> {
    return this.modelDelegate.findMany({
      where: { userId },
      orderBy: {
        targetDate: 'asc',
      },
    });
  }

  async updateBalance(goalId: string, amount: number): Promise<Goal> {
    return this.modelDelegate.update({
      where: { id: goalId },
      data: {
        currentAmount: amount,
      },
    });
  }
}

export default new GoalRepository();
