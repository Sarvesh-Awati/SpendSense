import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import env from '../config/env';

/**
 * Structured extraction result from receipt AI analysis.
 * These fields map to the existing TransactionForm input fields.
 */
export interface ReceiptExtractionResult {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  currency: string | null;
  suggestedCategory: string | null;
  description: string | null;
  confidence: number | null;
  /**
   * Why the fields above look the way they do.
   *
   *  - `EXTRACTED` — the model answered and at least one field was readable.
   *  - `EMPTY`     — the model answered, but nothing usable was on the image.
   *  - `FAILED`    — the model could not be reached, timed out, or returned
   *                  something unparseable.
   *
   * Without this the three were indistinguishable: every one of them produced
   * an all-null result, so an outage was presented to the user as "we scanned
   * your receipt and it was blank" and they retyped everything by hand
   * instead of retrying.
   */
  extractionStatus: 'EXTRACTED' | 'EMPTY' | 'FAILED';
}

/**
 * Hard ceiling on any single model call.
 *
 * The Gemini SDK has no default timeout, so a stalled connection held the
 * request — and the user's upload — open indefinitely. Receipt extraction sits
 * on an interactive path, so it fails fast and says so.
 */
const AI_TIMEOUT_MS = 25_000;

/** Largest amount the Decimal(12,2) column can hold. */
const MAX_EXTRACTED_AMOUNT = 9_999_999_999.99;

/**
 * Rejects a model-supplied date that is not a real calendar date.
 *
 * The model is asked for YYYY-MM-DD and usually complies, but "unknown",
 * "12/03/24" and "2024-13-45" have all been observed. Any of those reached
 * `new Date(...)` and became an Invalid Date, which Prisma rejected — turning
 * a bad OCR read into a 500 on the upload endpoint.
 */
function sanitizeExtractedDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  // Round-trip guards against values Date silently rolls over, e.g. 2024-02-31.
  if (parsed.toISOString().slice(0, 10) !== trimmed) return null;

  return trimmed;
}

/**
 * Rejects an amount that is not finite, not positive, or too large for the
 * money column. An out-of-range value would otherwise fail at the database.
 */
function sanitizeExtractedAmount(raw: unknown): number | null {
  if (typeof raw !== 'number') return null;
  if (!Number.isFinite(raw) || raw <= 0 || raw > MAX_EXTRACTED_AMOUNT) return null;
  return raw;
}

/** Rejects and times out a promise that the provider may never settle. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

/**
 * Dedicated AI Service for receipt image analysis using Google Gemini.
 *
 * Design Decision: Isolated into its own service to keep AI-specific logic
 * decoupled from the Receipt CRUD service. This allows swapping AI providers
 * without modifying business logic. The service never exposes raw AI responses
 * to the client — only parsed, typed extraction results.
 */
export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  /**
   * Analyze a receipt image and extract structured transaction data.
   * Sends the image as base64 inline data to Gemini with a structured JSON prompt.
   * Gracefully handles malformed AI responses with fallback defaults.
   */
  async extractReceiptData(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<ReceiptExtractionResult> {
    const prompt = `You are a receipt parser. Analyze this receipt image and extract the following information.
Return ONLY a valid JSON object with these exact keys (no markdown, no explanation, no code fences):

{
  "merchant": "store or business name",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "currency": "INR or USD etc",
  "suggestedCategory": "one of: Food, Shopping, Transport, Entertainment, Health, Education, Utilities, Rent, Groceries, Other",
  "description": "brief 3-5 word description of the purchase",
  "confidence": 0.95
}

Rules:
- amount must be a number (no currency symbols)
- date must be in YYYY-MM-DD format
- confidence is between 0 and 1 representing how confident you are in the extraction
- If any field cannot be determined, set it to null
- Return ONLY the JSON object, nothing else`;

    try {
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      };

      const result = await withTimeout(
        this.model.generateContent([prompt, imagePart]),
        AI_TIMEOUT_MS,
        'Receipt extraction'
      );
      const response = await result.response;
      const text = response.text();

      return this.parseAIResponse(text);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('🤖 AI Extraction Error:', error.message);
      } else {
        console.error('🤖 AI Extraction Error:', String(error));
      }
      // The provider failed. The user can still fill the form by hand, but the
      // client must be able to tell this apart from a genuinely blank receipt.
      return this.getEmptyExtraction('FAILED');
    }
  }

  /**
   * Parse the raw AI text response into a typed extraction result.
   * Handles common Gemini response quirks (markdown code fences, extra whitespace).
   */
  private parseAIResponse(text: string): ReceiptExtractionResult {
    try {
      // Strip markdown code fences if Gemini wraps the JSON
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

      const merchant = typeof parsed.merchant === 'string' && parsed.merchant.trim() !== ''
        ? parsed.merchant.trim()
        : null;
      const amount = sanitizeExtractedAmount(parsed.amount);
      const date = sanitizeExtractedDate(parsed.date);

      const fields = {
        merchant,
        amount,
        date,
        currency: typeof parsed.currency === 'string' ? parsed.currency : null,
        suggestedCategory: typeof parsed.suggestedCategory === 'string' ? parsed.suggestedCategory : null,
        description: typeof parsed.description === 'string' ? parsed.description : null,
        confidence: typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? Math.min(1, Math.max(0, parsed.confidence))
          : null,
      };

      // The model answered. Whether it found anything is a separate question
      // from whether it worked — merchant, amount and date are the three
      // fields that make an extraction useful.
      const foundSomething = merchant !== null || amount !== null || date !== null;

      return { ...fields, extractionStatus: foundSomething ? 'EXTRACTED' : 'EMPTY' };
    } catch (parseError) {
      console.error('🤖 AI Response Parse Error — malformed JSON:', text.substring(0, 200));
      return this.getEmptyExtraction('FAILED');
    }
  }

  /**
   * Generates personalized financial insights using Gemini based on aggregated financial data.
   */
  async generateFinancialInsights(summaryData: any): Promise<string[]> {
    const prompt = `You are an expert personal finance assistant.
Analyze the following user financial summary and provide 5 to 7 brief, actionable, and personalized insights.
DO NOT hallucinate. Use only the provided data.
DO NOT provide generic advice unless it directly ties to their data.

Data:
${JSON.stringify(summaryData, null, 2)}

Return ONLY a valid JSON array of strings. No markdown formatting or code blocks.
Example:
["You spend more on food than 82% of your expenses.", "Consider reducing subscriptions as they make up 15% of your income."]`;

    try {
      const result = await withTimeout(
        this.model.generateContent(prompt),
        AI_TIMEOUT_MS,
        'Financial insights'
      );
      const response = await result.response;
      let text = response.text().trim();
      
      // Strip markdown code fences
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
      return [];
    } catch (error) {
      console.error('🤖 AI Insights Error:', error);
      return [];
    }
  }

  /**
   * Returns an empty extraction result when AI fails or returns garbage.
   */
  private getEmptyExtraction(
    extractionStatus: ReceiptExtractionResult['extractionStatus'] = 'FAILED'
  ): ReceiptExtractionResult {
    return {
      merchant: null,
      amount: null,
      date: null,
      currency: null,
      suggestedCategory: null,
      description: null,
      confidence: null,
      extractionStatus,
    };
  }
}

export default new AIService();
