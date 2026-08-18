import { Goal, Prisma } from '@prisma/client';
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

  /**
   * Applies a contribution atomically.
   *
   * The previous implementation read `currentAmount`, added to it in
   * JavaScript, and wrote the result back. Two contributions that overlapped
   * both read the same starting balance and the second write silently
   * discarded the first — real money vanishing with no error anywhere. It also
   * routed the amount through a float, so cents drifted.
   *
   * `increment` compiles to `SET "currentAmount" = "currentAmount" + $1` in
   * Postgres. The row is locked for the duration of the update, so concurrent
   * contributions serialise and every one of them lands, and the arithmetic is
   * done in NUMERIC rather than IEEE-754.
   */
  async incrementBalance(goalId: string, amount: Prisma.Decimal): Promise<Goal> {
    return this.modelDelegate.update({
      where: { id: goalId },
      data: {
        currentAmount: { increment: amount },
      },
    });
  }
}

export default new GoalRepository();
