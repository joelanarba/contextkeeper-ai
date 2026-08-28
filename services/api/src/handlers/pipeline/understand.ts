import { repo } from '../../db/repo.js';
import { OpenAIProvider } from '../../llm/OpenAIProvider.js';
import crypto from 'node:crypto';
import type { Item } from '@contextkeeper/core';

export const handler = async (event: any): Promise<any> => {
  if (event.skipProcessing) return event;

  const { userId, captureId, createdAt, rawText, s3Key, mediaType } = event;
  
  // We need to fetch capture to pass to OpenAIProvider
  // OR we just construct a fake Capture object since we have the rawText
  const captureObj = {
    id: captureId,
    userId,
    type: mediaType,
    status: 'UNDERSTANDING' as any,
    rawText,
    s3Key,
    createdAt,
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  };

  await repo.updateCaptureStatus(userId, createdAt, captureId, 'UNDERSTANDING');

  const currentDateString = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
  const extracted = await OpenAIProvider.extractItems(captureObj, currentDateString);

  const now = new Date().toISOString();
  const itemsToSave: Item[] = extracted.map((ext) => {
    const status = (ext.confidence !== undefined && ext.confidence < 0.7) ? 'NEEDS_REVIEW' : 'OPEN';
    return {
      id: crypto.randomUUID(),
      userId,
      type: ext.type,
      title: ext.title,
      person: ext.person || undefined,
      personDisplay: ext.person || undefined,
      dueDate: ext.dueDate || undefined,
      project: ext.project || undefined,
      priority: ext.priority,
      status: status,
      confidence: ext.confidence,
      sourceCaptureId: captureId,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
  });

  return {
    ...event,
    extractedItems: itemsToSave,
    textToEmbed: rawText || JSON.stringify(extracted),
  };
};
