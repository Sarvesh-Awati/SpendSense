import { PrismaClient, CategoryType } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  { name: 'Food', type: CategoryType.EXPENSE, icon: 'Utensils', color: '#f43f5e' },
  { name: 'Travel', type: CategoryType.EXPENSE, icon: 'Compass', color: '#3b82f6' },
  { name: 'Bills', type: CategoryType.EXPENSE, icon: 'FileText', color: '#f59e0b' },
  { name: 'Entertainment', type: CategoryType.EXPENSE, icon: 'Film', color: '#8b5cf6' },
  { name: 'Health', type: CategoryType.EXPENSE, icon: 'HeartPulse', color: '#10b981' },
  { name: 'Shopping', type: CategoryType.EXPENSE, icon: 'ShoppingBag', color: '#ec4899' },
  { name: 'Education', type: CategoryType.EXPENSE, icon: 'GraduationCap', color: '#06b6d4' },
  { name: 'Investment', type: CategoryType.EXPENSE, icon: 'TrendingUp', color: '#14b8a6' },
  { name: 'Salary', type: CategoryType.INCOME, icon: 'Briefcase', color: '#10b981' },
  { name: 'Others', type: CategoryType.EXPENSE, icon: 'Tag', color: '#64748b' },
];

async function main() {
  console.log('🌱 Starting category seeding...');

  for (const category of defaultCategories) {
    // Check if category already exists as a default system category (where userId is null)
    const existing = await prisma.category.findFirst({
      where: {
        name: category.name,
        userId: null,
      },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          userId: null,
        },
      });
      console.log(`✅ Created system category: ${category.name} (${category.type})`);
    } else {
      console.log(`ℹ️ System category already exists: ${category.name}`);
    }
  }

  console.log('🌱 Seeding process complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
