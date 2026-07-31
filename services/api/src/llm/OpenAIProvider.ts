import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ExtractionResponseSchema, type LlmProvider, type ExtractionItem, getExtractionUserPrompt, SYSTEM_PROMPT } from '@contextkeeper/core';

const ssm = new SSMClient({});
let openAiClient: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  if (openAiClient) return openAiClient;

  // Fetch API key from SSM Parameter Store, caching outside handler scope.
  const param = await ssm.send(new GetParameterCommand({
    Name: '/contextkeeper/openai-api-key',
    WithDecryption: true,
  }));

  const apiKey = param.Parameter?.Value;
  if (!apiKey) throw new Error('OpenAI API key not found in SSM');

  openAiClient = new OpenAI({ apiKey });
  return openAiClient;
}

export const OpenAIProvider: LlmProvider = {
  async extractItems(rawText: string, currentDate: string): Promise<ExtractionItem[]> {
    const client = await getClient();
    const userPrompt = getExtractionUserPrompt(rawText, currentDate);

    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(ExtractionResponseSchema, 'extraction_response'),
      temperature: 0.1, // Low temp for more deterministic extraction
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error('Failed to parse extraction response from OpenAI');
    }

    return parsed.items;
  }
};
