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

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      return this.parseAIResponse(text);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('🤖 AI Extraction Error:', error.message);
      } else {
        console.error('🤖 AI Extraction Error:', String(error));
      }
      // Return empty extraction on AI failure — the user can still manually fill the form
      return this.getEmptyExtraction();
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

      return {
        merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null,
        amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        currency: typeof parsed.currency === 'string' ? parsed.currency : null,
        suggestedCategory: typeof parsed.suggestedCategory === 'string' ? parsed.suggestedCategory : null,
        description: typeof parsed.description === 'string' ? parsed.description : null,
        confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : null,
      };
    } catch (parseError) {
      console.error('🤖 AI Response Parse Error — malformed JSON:', text.substring(0, 200));
      return this.getEmptyExtraction();
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
      const result = await this.model.generateContent(prompt);
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
  private getEmptyExtraction(): ReceiptExtractionResult {
    return {
      merchant: null,
      amount: null,
      date: null,
      currency: null,
      suggestedCategory: null,
      description: null,
      confidence: null,
    };
  }
}

export default new AIService();
