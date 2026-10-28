import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';
import { sendSyncBatch } from '../services/api.js';
import { retryChunkedBatch } from '../services/chunkRetry.js';

const batchId = process.argv[2];
if (!batchId) throw new Error('BATCH_ID_REQUIRED');

const db = new DatabaseSync('queue.db');
try {
  const result = await retryChunkedBatch(db, batchId, env.CHUNK_SIZE_RECORDS, sendSyncBatch);
  console.log(JSON.stringify(result));
  if (!result.completed) process.exitCode = 1;
} finally {
  db.close();
}
