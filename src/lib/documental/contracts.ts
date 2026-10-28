import { z } from 'zod';

export const relativePathSchema = z.string().min(1).max(1024).refine(value =>
  !/^[\\/]/.test(value) && !/^[a-zA-Z]:/.test(value) &&
  !value.split(/[\\/]/).some(part => part === '..') && !value.includes('\0'));

export const searchInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('search').optional().default('search'),
  query: z.string().trim().min(2).max(120),
  forceFresh: z.boolean().optional(),
}).strict();

export const extractPetitionInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('extract_petition'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  forceFresh: z.boolean().optional(),
}).strict();

export const analyzeSignaturesInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('analyze_signatures'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  forceFresh: z.boolean().optional(),
}).strict();

export const documentJobInput = z.union([
  searchInput,
  extractPetitionInput,
  analyzeSignaturesInput,
]);

export const documentResult = z.object({
  files: z.array(z.object({
    rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
    relativePath: relativePathSchema,
    name: z.string().min(1).max(255),
    size: z.number().int().nonnegative(),
    modifiedAt: z.string().datetime(),
  }).strict()).max(100),
  partial: z.boolean(),
  unavailableRoots: z.array(z.string().max(32)).max(10),
}).strict();

export const connectorMessage = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim'), connectorId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal('complete'), connectorId: z.string().min(1).max(128), id: z.string().uuid(), result: z.union([documentResult, z.record(z.any()), z.array(z.any())]) }).strict(),
  z.object({ action: z.literal('fail'), connectorId: z.string().min(1).max(128), id: z.string().uuid() }).strict(),
]);

