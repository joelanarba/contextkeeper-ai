// All types derived from zod schemas. Never hand-write a type that duplicates a schema.

import type { z } from 'zod';

import type {
  CaptureSchema,
  CaptureStatus,
  CaptureType,
  CreateTextCaptureInput,
  ExtractionItemSchema,
  ExtractionResponseSchema,
  ItemSchema,
  ItemStatus,
  ItemType,
  Priority,
  RecallInput,
  UpdateItemInput,
} from './schemas.js';

export type Capture = z.infer<typeof CaptureSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type ExtractionItem = z.infer<typeof ExtractionItemSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

export type CaptureStatusType = z.infer<typeof CaptureStatus>;
export type CaptureTypeType = z.infer<typeof CaptureType>;
export type ItemTypeType = z.infer<typeof ItemType>;
export type ItemStatusType = z.infer<typeof ItemStatus>;
export type PriorityType = z.infer<typeof Priority>;

export type CreateTextCaptureInputType = z.infer<typeof CreateTextCaptureInput>;
export type RecallInputType = z.infer<typeof RecallInput>;
export type UpdateItemInputType = z.infer<typeof UpdateItemInput>;
