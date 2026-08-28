import { z } from 'zod';

// --- Enums ---

export const CaptureStatus = z.enum([
  'UPLOADED',
  'EXTRACTING',
  'EXTRACTED',
  'UNDERSTANDING',
  'READY',
  'FAILED',
]);

export const CaptureType = z.enum(['TEXT', 'IMAGE', 'PDF', 'AUDIO']);

export const ItemType = z.enum(['TASK', 'IDEA', 'NOTE', 'FOLLOW_UP', 'PROJECT']);

export const ItemStatus = z.enum(['OPEN', 'COMPLETE', 'NEEDS_REVIEW']);

export const Priority = z.enum(['HIGH', 'MEDIUM', 'LOW']);

// --- Core entity schemas ---

export const CaptureSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  type: CaptureType,
  status: CaptureStatus,
  rawText: z.string().optional(),
  s3Key: z.string().optional(),
  errorMessage: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  schemaVersion: z.number().int().positive(),
  externalJobId: z.string().optional(),
  taskToken: z.string().optional(),
});

export const ItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  type: ItemType,
  title: z.string().min(1),
  person: z.string().optional(),
  personDisplay: z.string().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  project: z.string().optional(),
  priority: Priority,
  status: ItemStatus,
  sourceCaptureId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  schemaVersion: z.number().int().positive(),
  confidence: z.number().min(0).max(1).optional(),
  parentItemId: z.string().uuid().optional(),
  hasSubtasks: z.boolean().default(false).optional(),
});

// --- Extraction response envelope (parsed from LLM output) ---

export const ExtractionItemSchema = z.object({
  type: ItemType,
  title: z.string().min(1),
  person: z.string().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  project: z.string().nullable().optional(),
  priority: Priority,
  confidence: z.number().min(0).max(1),
});

export const ExtractionResponseSchema = z.object({
  items: z.array(ExtractionItemSchema),
});

// --- API input schemas (parsed at the edge) ---

export const CreateTextCaptureInput = z.object({
  type: z.literal('TEXT'),
  text: z.string().min(1).max(50_000),
});

export const CreateMediaCaptureInput = z.object({
  type: z.enum(['IMAGE', 'PDF', 'AUDIO']),
  s3Key: z.string().min(1).max(1024),
});

export const RecallInput = z.object({
  question: z.string().min(1).max(2_000),
});

export const UpdateItemInput = z.object({
  title: z.string().min(1).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: ItemStatus.optional(),
  priority: Priority.optional(),
  person: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  parentItemId: z.string().uuid().optional(),
  hasSubtasks: z.boolean().optional(),
});
