import { Category } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class CategoryRepository extends BaseRepository<Category> {
  constructor() {
    super(prisma.category);
  }

  // Fetches default categories (userId is null) AND user-defined custom categories
  async findAvailableByUser(userId: string): Promise<Category[]> {
    return this.modelDelegate.findMany({
      where: {
        OR: [
          { userId: null },
          { userId },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findByNameAndUser(name: string, userId: string | null): Promise<Category | null> {
    return this.modelDelegate.findFirst({
      where: {
        name,
        userId,
      },
    });
  }
}

export default new CategoryRepository();
