import categoryRepository from '../repositories/CategoryRepository';
import { Category } from '@prisma/client';

export class CategoryService {
  async getAvailable(userId: string): Promise<Category[]> {
    return categoryRepository.findAvailableByUser(userId);
  }
}

export default new CategoryService();
