import type { ExtractionItem, Capture } from '../types.js';

export interface LlmProvider {
  /**
   * Extracts structured items from raw text or media capture using an LLM.
   * @param capture The capture object (TEXT, IMAGE, PDF) from the user.
   * @param currentDate The current date in the user's timezone (Africa/Accra) for relative date resolution.
   */
  extractItems(capture: Capture, currentDate: string): Promise<ExtractionItem[]>;
}
