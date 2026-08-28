import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ExtractionResponseSchema, type LlmProvider, type ExtractionItem, getExtractionUserPrompt, SYSTEM_PROMPT } from '@contextkeeper/core';
import type { Capture, Item } from '@contextkeeper/core';

// We will load pdf-parse dynamically to avoid ESM/CJS bundling issues
let pdfParse: any = null;

const ssm = new SSMClient({});
const s3 = new S3Client({});
let openAiClient: OpenAI | null = null;
const BUCKET_NAME = process.env.BUCKET_NAME;

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
  async extractItems(capture: Capture, currentDate: string): Promise<ExtractionItem[]> {
    const client = await getClient();
    
    // Determine the user prompt and messages array based on media type
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (capture.type === 'TEXT') {
      messages.push({ role: 'user', content: getExtractionUserPrompt(capture.rawText || '', currentDate) });
    } else if (capture.type === 'PDF' && capture.s3Key) {
      if (!BUCKET_NAME) throw new Error('BUCKET_NAME is required for media processing');
      
      const s3Res = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: capture.s3Key,
      }));
      
      if (!s3Res.Body) throw new Error('S3 object body is empty');
      const buffer = Buffer.from(await s3Res.Body.transformToByteArray());
      
      // Extract text from PDF
        if (!pdfParse) {
          const m = await import('pdf-parse');
          pdfParse = (m as any).default || m;
        }
        const parsed = await pdfParse(buffer);
        const text = parsed.text;
      
      messages.push({ role: 'user', content: getExtractionUserPrompt(`[PDF CONTENTS]\n${text}`, currentDate) });
      
    } else if (capture.type === 'IMAGE' && capture.s3Key) {
      if (!BUCKET_NAME) throw new Error('BUCKET_NAME is required for media processing');
      
      const s3Res = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: capture.s3Key,
      }));
      
      if (!s3Res.Body) throw new Error('S3 object body is empty');
      const buffer = Buffer.from(await s3Res.Body.transformToByteArray());
      const base64Image = buffer.toString('base64');
      const mimeType = capture.s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `CURRENT_DATE (Africa/Accra): ${currentDate}\n\nPlease extract structured items from the attached image.` },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      });
    } else {
      throw new Error(`Unsupported capture type: ${capture.type}`);
    }

    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages,
      response_format: zodResponseFormat(ExtractionResponseSchema, 'extraction_response'),
      temperature: 0.1, // Low temp for more deterministic extraction
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error('Failed to parse extraction response from OpenAI');
    }

    return parsed.items;
  },

  async generateEmbedding(text: string): Promise<number[]> {
    const client = await getClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    const data = response.data[0];
    if (!data || !data.embedding) throw new Error('Failed to generate embedding');
    return data.embedding;
  },

  async answerQuestion(question: string, contextCaptures: Capture[], currentDate: string): Promise<string> {
    const client = await getClient();

    // Construct context string from captures
    const contextLines = contextCaptures.map(c => {
      const type = c.type;
      const date = new Date(c.createdAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
      return `[Capture ID: ${c.id}] (Type: ${type}, Date: ${date}):\n${c.rawText || '(Media capture with no raw text)'}`;
    });
    const contextString = contextLines.join('\n\n');

    const systemPrompt = `You are ContextKeeper, a personal memory assistant.
The user is asking a question about their past notes, tasks, ideas, and captured images/documents.
Use the provided Context Captures to answer the question.
If the answer is not in the context, say you don't know based on the provided context.
Whenever you assert a fact or reference a specific note, you MUST cite the Capture ID in brackets, e.g. [Capture ID: 1234...].

Context Captures:
${contextString}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CURRENT_DATE (Africa/Accra): ${currentDate}\n\nQuestion: ${question}` }
      ],
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || 'Sorry, I was unable to generate an answer.';
  },

  async synthesizeDigest(items: Item[], currentDate: string): Promise<string> {
    const client = await getClient();

    const systemPrompt = `You are ContextKeeper, a personal memory assistant.
Your job is to write a weekly analytical retrospective email to the user summarizing their week.
Analyze the items they captured, extract overarching themes, patterns, or bottlenecks, and provide 2-3 constructive recommendations for the upcoming week.
The output MUST be formatted in elegant HTML so it renders beautifully in an email client.
Do NOT include markdown block wrappers like \`\`\`html. Output raw HTML only.
Tone: analytical, encouraging, and professional.`;

    const userContent = `CURRENT_DATE (Africa/Accra): ${currentDate}\n\nItems to summarize:\n${JSON.stringify(items, null, 2)}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content || '';
    // Strip markdown formatting if the model still outputs it
    return content.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
  },

  async decomposeTask(task: Item): Promise<{ title: string }[]> {
    const client = await getClient();

    const systemPrompt = `You are an AI productivity coach.
The user has a task that has been stalled for several days. Break it down into 2 to 3 very small, actionable micro-tasks to help them build momentum.
Return a JSON object with a "subtasks" array containing objects with a "title" string.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task: ${task.title}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];
    
    try {
      const parsed = JSON.parse(content);
      return parsed.subtasks || [];
    } catch (e) {
      return [];
    }
  }
};
