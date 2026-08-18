import subscriptionRepository from '../repositories/SubscriptionRepository';
import categoryRepository from '../repositories/CategoryRepository';
import { Subscription, SubscriptionFrequency, Currency } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import { Decimal } from '@prisma/client/runtime/library';
import userRepository from '../repositories/UserRepository';
import currencyService from './currencyService';

export interface SubscriptionStats {
  /** Monthly equivalent expressed in the account base currency, or null when
   *  no current rate is available. Callers MUST handle null rather than
   *  treating a foreign amount as a base-currency amount. */
  monthlyEquivalentInBase: number | null;
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
    const start = new Date(startDate);

    // If the start date is in the future, it IS the next renewal
    if (start > referenceDate) {
      return start;
    }

    if (frequency === SubscriptionFrequency.WEEKLY) {
      const nextDate = new Date(start);
      while (nextDate <= referenceDate) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      return nextDate;
    }

    /**
     * Monthly and yearly renewals are anchored to the START date's day of the
     * month, not to the previous renewal.
     *
     * Stepping with `setMonth(+1)` from a 31st overflows: Jan 31 becomes Mar 3,
     * and every subsequent step compounds from the wrong day, so a plan bought
     * on the 31st permanently drifts into the middle of the month. The same
     * flaw moved a Feb 29 yearly renewal to Mar 1 for the next three years.
     *
     * Anchoring instead re-derives each candidate from (year, month, anchorDay)
     * and clamps the day to that month's length, so Jan 31 renews Feb 28/29,
     * then Mar 31 — the behaviour every subscription provider actually uses.
     */
    const anchorDay = start.getDate();
    const step = frequency === SubscriptionFrequency.YEARLY ? 12 : 1;

    // Absolute month index keeps arithmetic free of year-boundary special cases.
    let monthIndex = start.getFullYear() * 12 + start.getMonth();

    // Bounded loop: 12,000 steps is a thousand years of monthly renewals, far
    // beyond any real start date, and guarantees this can never spin forever.
    for (let i = 0; i < 12_000; i++) {
      monthIndex += step;
      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const candidate = new Date(start);
      candidate.setFullYear(year, month, Math.min(anchorDay, daysInMonth));

      if (candidate > referenceDate) return candidate;
    }

    return start;
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
  private async processSubscription(
    sub: Subscription & { category?: { name: string; icon: string | null; color: string | null } | null },
    baseCurrency?: Currency
  ): Promise<SubscriptionStats> {
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

    /**
     * Signed, deliberately.
     *
     * This used to take `Math.abs()` of the difference, so a renewal that had
     * already passed — which happens on any inactive subscription, since those
     * are never rolled forward — read as that many days *until* renewal. A
     * plan cancelled 60 days ago reported "renews in 60 days" and could be
     * picked up by the dashboard's upcoming-renewals filter.
     */
    const daysUntilRenewal = Math.ceil(
      (nextRenewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Forward-looking cost: use TODAY's rate, not one frozen at creation.
    // Null (never a raw foreign amount) when a rate cannot be obtained.
    let monthlyEquivalentInBase: number | null = null;
    if (!baseCurrency || sub.currency === baseCurrency) {
      monthlyEquivalentInBase = Number(monthlyCost.toFixed(2));
    } else {
      try {
        const rate = await currencyService.getRate(sub.currency, baseCurrency, new Date());
        monthlyEquivalentInBase = Number(Number(rate.mul(monthlyCost).toFixed(2)));
      } catch {
        monthlyEquivalentInBase = null;
      }
    }

    return {
      id: sub.id,
      name: sub.name,
      monthlyEquivalentInBase,
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
  /**
   * Rejects a category the caller does not own.
   *
   * Category ids are UUIDs, so this is not a guessing attack — but ids leak
   * through shared exports and screenshots, and every other resource in the
   * application already enforces this. Subscriptions were the one gap: any
   * user could attach their subscription to another user's private category
   * and read its name, icon and colour back out of the response.
   *
   * System categories (`userId === null`) are shared by design and allowed.
   */
  private async assertCategoryAccessible(userId: string, categoryId: string): Promise<void> {
    const category = await categoryRepository.findById(categoryId);
    if (!category || (category.userId && category.userId !== userId)) {
      throw new NotFoundError('Category not found');
    }
  }

  async createSubscription(userId: string, data: CreateSubscriptionDTO): Promise<SubscriptionStats> {
    const startDate = new Date(data.startDate);

    if (data.categoryId) {
      await this.assertCategoryAccessible(userId, data.categoryId);
    }

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

    return this.processSubscription(subscription, await this.baseCurrencyFor(userId));
  }

  /**
   * Fetch all subscriptions for a user, processing stats
   */
  async getSubscriptions(userId: string): Promise<SubscriptionStats[]> {
    const subs = await subscriptionRepository.findByUserId(userId);
    const baseCurrency = await this.baseCurrencyFor(userId);
    return Promise.all(subs.map(sub => this.processSubscription(sub, baseCurrency)));
  }

  /**
   * Fetch a single subscription, ensuring tenant isolation
   */
  async getSubscriptionById(userId: string, id: string): Promise<SubscriptionStats> {
    const subscription = await subscriptionRepository.findById(id);
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundError('Subscription not found');
    }
    
    const subWithCategory = await subscriptionRepository.findByIdWithCategory(id);
    return this.processSubscription(subWithCategory ?? subscription, await this.baseCurrencyFor(userId));
  }

  /** The account's reporting currency, used to price forward-looking costs. */
  private async baseCurrencyFor(userId: string): Promise<Currency | undefined> {
    const user = await userRepository.findById(userId);
    return (user?.baseCurrency ?? user?.preferredCurrency) as Currency | undefined;
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(userId: string, id: string, data: UpdateSubscriptionDTO): Promise<SubscriptionStats> {
    const existing = await subscriptionRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Subscription not found');
    }

    if (data.categoryId) {
      await this.assertCategoryAccessible(userId, data.categoryId);
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
    const subWithCategory = await subscriptionRepository.findByIdWithCategory(id);

    return this.processSubscription(subWithCategory ?? updated, await this.baseCurrencyFor(userId));
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
