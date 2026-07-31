import type { ExtractionItem, Capture } from '../types.js';

export interface LlmProvider {
  /**
   * Extracts structured items from raw text or media capture using an LLM.
   * @param capture The capture object (TEXT, IMAGE, PDF) from the user.
   * @param currentDate The current date in the user's timezone (Africa/Accra) for relative date resolution.
   */
  extractItems(capture: Capture, currentDate: string): Promise<ExtractionItem[]>;

  /**
   * Generates a vector embedding for a given text.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Answers a question using the provided context captures.
   */
  answerQuestion(question: string, contextCaptures: Capture[], currentDate: string): Promise<string>;

  /**
   * Synthesize a weekly digest email from a list of open items.
   */
  synthesizeDigest(items: ExtractionItem[], currentDate: string): Promise<string>;
}
