import type { SQSEvent } from 'aws-lambda';
import { repo } from '../db/repo.js';
import { OpenAIProvider } from '../llm/OpenAIProvider.js';
import crypto from 'node:crypto';
import type { Item } from '@contextkeeper/core';

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch {
      console.error('Failed to parse SQS message body:', record.body);
      continue;
    }

    const { userId, captureId, createdAt } = payload;
    if (!userId || !captureId || !createdAt) {
      console.error('Invalid SQS payload structure:', payload);
      continue;
    }

    try {
      const capture = await repo.getCapture(userId, createdAt, captureId);
      
      if (!capture) {
        console.error(`Capture not found for user ${userId}, id ${captureId}`);
        continue;
      }

      if (capture.status !== 'UPLOADED') {
        // Idempotency: skip if already processed
        console.log(`Skipping capture ${captureId}, status is ${capture.status}`);
        continue;
      }

      if (!capture.rawText && !capture.s3Key) {
        throw new Error('Capture must have either rawText or s3Key');
      }

      // Update status to UNDERSTANDING
      await repo.updateCaptureStatus(userId, createdAt, captureId, 'UNDERSTANDING');

      // Calculate current date in Africa/Accra for the prompt (UTC+0 equivalent basically, but let's use formatting)
      const currentDateString = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });

      // Run extraction
      const extracted = await OpenAIProvider.extractItems(capture, currentDateString);

      // Map to full Item schema
      const now = new Date().toISOString();
      const itemsToSave: Item[] = extracted.map((ext) => ({
        id: crypto.randomUUID(),
        userId,
        type: ext.type,
        title: ext.title,
        person: ext.person || undefined,
        personDisplay: ext.person || undefined,
        dueDate: ext.dueDate || undefined,
        project: ext.project || undefined,
        priority: ext.priority,
        status: 'OPEN',
        sourceCaptureId: captureId,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      }));

      // Save to DynamoDB transactionally and mark capture READY
      await repo.saveExtractedItems(userId, createdAt, captureId, itemsToSave);

      // Generate embedding and save it
      try {
        const textToEmbed = capture.rawText || JSON.stringify(extracted);
        const embedding = await OpenAIProvider.generateEmbedding(textToEmbed);
        await repo.updateCaptureEmbedding(userId, createdAt, captureId, embedding);
      } catch (embErr) {
        // We log the error but don't fail the whole pipeline if embedding fails
        console.error(`Failed to generate embedding for capture ${captureId}:`, embErr);
      }
      
      console.log(JSON.stringify({
        level: 'INFO',
        msg: 'Successfully processed capture',
        captureId,
        itemsExtracted: itemsToSave.length,
      }));

    } catch (err: unknown) {
      console.error(`Error processing capture ${captureId}:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      // Mark as FAILED in DB so UI can show a retry button
      await repo.updateCaptureStatus(userId, createdAt, captureId, 'FAILED', errorMessage).catch(e => {
         console.error('Failed to update status to FAILED', e);
      });
      // Rethrow to fail the message and send to DLQ after retries exhaust
      throw err;
    }
  }
};
