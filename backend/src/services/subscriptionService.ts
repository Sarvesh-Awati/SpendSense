import subscriptionRepository from '../repositories/SubscriptionRepository';
import { Subscription, SubscriptionFrequency, Currency } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import { Decimal } from '@prisma/client/runtime/library';

export interface SubscriptionStats {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  frequency: SubscriptionFrequency;
  startDate: Date;
  nextRenewal: Date;
  isActive: boolean;
  categoryId: string | null;
  category: { name: string; icon: string | null; color: string | null } | null;
  daysUntilRenewal: number;
  monthlyEquivalentCost: number;
  annualCost: number;
}

export interface CreateSubscriptionDTO {
  name: string;
  amount: number;
  currency?: Currency;
  frequency: SubscriptionFrequency;
  startDate: string | Date;
  isActive?: boolean;
  categoryId?: string | null;
}

export interface UpdateSubscriptionDTO {
  name?: string;
  amount?: number;
  currency?: Currency;
  frequency?: SubscriptionFrequency;
  startDate?: string | Date;
  isActive?: boolean;
  categoryId?: string | null;
}

export class SubscriptionService {
  /**
   * Helper: Calculate the exact next renewal date based on start date, frequency, and an optional reference date (defaults to now).
   */
  public calculateNextRenewal(startDate: Date, frequency: SubscriptionFrequency, referenceDate: Date = new Date()): Date {
    const nextDate = new Date(startDate);
    
    // If the start date is in the future, it IS the next renewal
    if (nextDate > referenceDate) {
      return nextDate;
    }

    // Otherwise, increment based on frequency until it's in the future
    while (nextDate <= referenceDate) {
      if (frequency === SubscriptionFrequency.WEEKLY) {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (frequency === SubscriptionFrequency.MONTHLY) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (frequency === SubscriptionFrequency.YEARLY) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    }
    
    return nextDate;
  }

  /**
   * Helper: Convert Decimal amounts to monthly equivalent costs
   */
  private calculateEquivalentCosts(amount: Decimal, frequency: SubscriptionFrequency) {
    const numericAmount = Number(amount);
    let monthlyCost = 0;
    let annualCost = 0;

    if (frequency === SubscriptionFrequency.WEEKLY) {
      monthlyCost = (numericAmount * 52) / 12;
      annualCost = numericAmount * 52;
    } else if (frequency === SubscriptionFrequency.MONTHLY) {
      monthlyCost = numericAmount;
      annualCost = numericAmount * 12;
    } else if (frequency === SubscriptionFrequency.YEARLY) {
      monthlyCost = numericAmount / 12;
      annualCost = numericAmount;
    }

    return { monthlyCost, annualCost };
  }

  /**
   * Helper: Decorate subscription with calculated stats and roll forward overdue renewals
   */
  private async processSubscription(sub: Subscription & { category?: { name: string; icon: string | null; color: string | null } | null }): Promise<SubscriptionStats> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let nextRenewal = sub.nextRenewal ? new Date(sub.nextRenewal) : new Date(sub.startDate);
    
    // Auto-roll forward if nextRenewal is in the past and the subscription is active
    if (sub.isActive && nextRenewal < now) {
      nextRenewal = this.calculateNextRenewal(new Date(sub.startDate), sub.frequency, now);
      // Persist the updated renewal date asynchronously in the background
      await subscriptionRepository.update(sub.id, { nextRenewal });
    }

    const { monthlyCost, annualCost } = this.calculateEquivalentCosts(sub.amount, sub.frequency);
    
    const diffTime = Math.abs(nextRenewal.getTime() - now.getTime());
    const daysUntilRenewal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      id: sub.id,
      name: sub.name,
      amount: Number(sub.amount),
      currency: sub.currency,
      frequency: sub.frequency,
      startDate: sub.startDate,
      nextRenewal,
      isActive: sub.isActive,
      categoryId: sub.categoryId,
      category: sub.category || null,
      daysUntilRenewal,
      monthlyEquivalentCost: Number(monthlyCost.toFixed(2)),
      annualCost: Number(annualCost.toFixed(2)),
    };
  }

  /**
   * Create a new subscription
   */
  async createSubscription(userId: string, data: CreateSubscriptionDTO): Promise<SubscriptionStats> {
    const startDate = new Date(data.startDate);
    
    // Prevent duplicate active subscriptions with the same name for this user
    const existingSubs = await subscriptionRepository.findByUserId(userId);
    const duplicate = existingSubs.find(s => s.name.toLowerCase() === data.name.toLowerCase() && s.isActive);
    if (duplicate) {
      throw new BadRequestError('An active subscription with this name already exists.');
    }

    const nextRenewal = this.calculateNextRenewal(startDate, data.frequency);

    const subscription = await subscriptionRepository.create({
      name: data.name,
      amount: new Decimal(data.amount),
      currency: data.currency,
      frequency: data.frequency,
      startDate,
      nextRenewal,
      isActive: data.isActive !== undefined ? data.isActive : true,
      categoryId: data.categoryId,
      userId,
    });

    return this.processSubscription(subscription);
  }

  /**
   * Fetch all subscriptions for a user, processing stats
   */
  async getSubscriptions(userId: string): Promise<SubscriptionStats[]> {
    const subs = await subscriptionRepository.findByUserId(userId);
    return Promise.all(subs.map(sub => this.processSubscription(sub)));
  }

  /**
   * Fetch a single subscription, ensuring tenant isolation
   */
  async getSubscriptionById(userId: string, id: string): Promise<SubscriptionStats> {
    const subscription = await subscriptionRepository.findById(id);
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundError('Subscription not found');
    }
    
    // Fetch with category details for the single view
    const subs = await subscriptionRepository.findByUserId(userId);
    const subWithCategory = subs.find(s => s.id === id);
    
    return this.processSubscription(subWithCategory || subscription);
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(userId: string, id: string, data: UpdateSubscriptionDTO): Promise<SubscriptionStats> {
    const existing = await subscriptionRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Subscription not found');
    }

    const updateData: Partial<Subscription> = {};
    if (data.name) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Recalculate next renewal if start date or frequency changes
    if (data.startDate || data.frequency) {
      const newStartDate = data.startDate ? new Date(data.startDate) : existing.startDate;
      const newFrequency = data.frequency || existing.frequency;
      updateData.startDate = newStartDate;
      updateData.frequency = newFrequency;
      updateData.nextRenewal = this.calculateNextRenewal(newStartDate, newFrequency);
    }

    const updated = await subscriptionRepository.update(id, updateData);
    
    // Fetch with category mapping for response consistency
    const subs = await subscriptionRepository.findByUserId(userId);
    const subWithCategory = subs.find(s => s.id === id);
    
    return this.processSubscription(subWithCategory || updated);
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(userId: string, id: string): Promise<void> {
    const existing = await subscriptionRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Subscription not found');
    }
    await subscriptionRepository.delete(id);
  }
}

export default new SubscriptionService();
