import { Currency, CategoryType, Prisma } from '@prisma/client';
import transactionRepository, { TransactionFilters } from '../repositories/TransactionRepository';
import categoryRepository from '../repositories/CategoryRepository';
import receiptRepository from '../repositories/ReceiptRepository';
import userRepository from '../repositories/UserRepository';
import currencyService from './currencyService';
import { NotFoundError } from '../errors/AppError';
import {
  serializeTransaction,
  serializeTransactions,
  SerializedTransaction,
} from '../utils/serializeTransaction';
import { toDecimal } from '../utils/money';

export class TransactionService {
  /**
   * The account's canonical reporting currency.
   * `baseCurrency` is nullable only so existing rows could be backfilled;
   * falling back to preferredCurrency keeps any unbackfilled account working.
   */
  private async resolveBaseCurrency(userId: string): Promise<Currency> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return (user.baseCurrency ?? user.preferredCurrency) as Currency;
  }

  private async assertCategoryAccessible(userId: string, categoryId: string): Promise<void> {
    const category = await categoryRepository.findById(categoryId);
    if (!category || (category.userId && category.userId !== userId)) {
      throw new NotFoundError('Category not found');
    }
  }

  /**
   * Rejects a receipt the caller does not own.
   *
   * `receiptId` arrives straight from the request body and was written to the
   * transaction with no check, so any authenticated user could claim another
   * user's receipt by id — taking the unique link for themselves and leaving
   * the real owner unable to file their own scan. Categories and every other
   * foreign key already enforce this; receipts were the gap.
   */
  private async assertReceiptAccessible(userId: string, receiptId: string): Promise<void> {
    const receipt = await receiptRepository.findById(receiptId);
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundError('Receipt not found');
    }
  }

  /**
   * Creates a transaction, deriving and persisting its conversion atomically.
   *
   * Same currency as the account base => rate 1, no provider call.
   * Different currency => priced at the transaction's OWN date, so historical
   * entries convert historically. If no trustworthy rate exists the create
   * fails closed (503) rather than storing a wrong financial record.
   */
  async create(
    userId: string,
    data: {
      amount: number;
      currency?: Currency;
      description?: string | null;
      merchant?: string | null;
      date: Date;
      type: CategoryType;
      paymentMethod?: string | null;
      categoryId: string;
      isSubscription?: boolean;
      receiptId?: string | null;
    }
  ): Promise<SerializedTransaction> {
    await this.assertCategoryAccessible(userId, data.categoryId);
    if (data.receiptId) {
      await this.assertReceiptAccessible(userId, data.receiptId);
    }

    const baseCurrency = await this.resolveBaseCurrency(userId);
    const currency = (data.currency ?? baseCurrency) as Currency;

    const conversion = await currencyService.resolveConversion(
      toDecimal(data.amount),
      currency,
      baseCurrency,
      data.date
    );

    const created = await transactionRepository.create({
      ...data,
      currency,
      baseCurrency: conversion.baseCurrency,
      exchangeRate: conversion.exchangeRate,
      convertedAmount: conversion.convertedAmount,
      userId,
    });

    return serializeTransaction(created);
  }

  async findAll(
    userId: string,
    query: {
      page: number;
      limit: number;
      search?: string;
      categoryId?: string;
      type?: CategoryType;
      isSubscription?: boolean;
      startDate?: Date;
      endDate?: Date;
      minAmount?: number;
      maxAmount?: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ) {
    const { page, limit, sortBy, sortOrder, ...filters } = query;
    const skip = (page - 1) * limit;
    const take = limit;

    const { transactions, total } = await transactionRepository.findFiltered(
      userId,
      filters as TransactionFilters,
      { skip, take, sortBy, sortOrder }
    );

    return {
      transactions: serializeTransactions(transactions),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findById(userId: string, id: string): Promise<SerializedTransaction> {
    const transaction = await transactionRepository.findById(id);
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }
    return serializeTransaction(transaction);
  }

  /**
   * Updates a transaction, re-deriving conversion only when it must.
   *
   *  - amount changes, currency unchanged -> reuse the STORED rate. Never
   *    re-price history at today's rate.
   *  - currency changes -> obtain a rate for the transaction's own date.
   *  - neither changes -> conversion fields are left untouched.
   */
  async update(
    userId: string,
    id: string,
    data: Partial<{
      amount: number;
      currency: Currency;
      description: string | null;
      merchant: string | null;
      date: Date;
      type: CategoryType;
      paymentMethod: string | null;
      categoryId: string;
      isSubscription: boolean;
      receiptId: string | null;
    }>
  ): Promise<SerializedTransaction> {
    const existing = await transactionRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }

    if (data.categoryId) {
      await this.assertCategoryAccessible(userId, data.categoryId);
    }
    if (data.receiptId) {
      await this.assertReceiptAccessible(userId, data.receiptId);
    }

    const amountChanged = data.amount !== undefined;
    const currencyChanged = data.currency !== undefined && data.currency !== existing.currency;
    const effectiveDate = data.date ?? existing.date;

    let conversionPatch: {
      baseCurrency?: Currency;
      exchangeRate?: Prisma.Decimal;
      convertedAmount?: Prisma.Decimal;
    } = {};

    if (currencyChanged) {
      // Currency changed: price it at the transaction's own date.
      const baseCurrency = await this.resolveBaseCurrency(userId);
      const nextAmount = data.amount ?? existing.amount;
      const conversion = await currencyService.resolveConversion(
        toDecimal(nextAmount as any),
        data.currency as Currency,
        baseCurrency,
        effectiveDate
      );
      conversionPatch = {
        baseCurrency: conversion.baseCurrency,
        exchangeRate: conversion.exchangeRate,
        convertedAmount: conversion.convertedAmount,
      };
    } else if (amountChanged) {
      // Amount only: reuse the rate already on the record.
      if (existing.exchangeRate == null || existing.baseCurrency == null) {
        // Unconverted legacy row — derive once rather than guess.
        const baseCurrency = await this.resolveBaseCurrency(userId);
        const conversion = await currencyService.resolveConversion(
          toDecimal(data.amount as number),
          existing.currency,
          baseCurrency,
          effectiveDate
        );
        conversionPatch = {
          baseCurrency: conversion.baseCurrency,
          exchangeRate: conversion.exchangeRate,
          convertedAmount: conversion.convertedAmount,
        };
      } else {
        conversionPatch = {
          convertedAmount: currencyService.recomputeWithStoredRate(
            toDecimal(data.amount as number),
            existing.exchangeRate
          ),
        };
      }
    }

    const updated = await transactionRepository.update(id, { ...data, ...conversionPatch });
    return serializeTransaction(updated);
  }

  async delete(userId: string, id: string) {
    const transaction = await transactionRepository.findById(id);
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }
    return transactionRepository.delete(id);
  }
}

export default new TransactionService();
