import type { ExtractionItem } from '../types.js';

export interface LlmProvider {
  /**
   * Extracts structured items from raw text using an LLM.
   * @param rawText The raw text captured from the user.
   * @param currentDate The current date in the user's timezone (Africa/Accra) for relative date resolution.
   */
  extractItems(rawText: string, currentDate: string): Promise<ExtractionItem[]>;
}
