import { EmailJob, type EmailJobType } from '../db/models/EmailJob';
import { logger } from './logger';
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendReturnStatusEmail,
  sendNewsletterSubscriptionEmail,
  type EmailData,
  type OrderStatusEmailData,
  type ReturnStatusEmailData,
  type NewsletterEmailData,
} from './email';

type EmailJobPayloadMap = {
  order_confirmation: EmailData;
  order_status_update: OrderStatusEmailData;
  return_status: ReturnStatusEmailData;
  newsletter_subscription: NewsletterEmailData;
};

const EMAIL_SENDERS: { [K in EmailJobType]: (payload: EmailJobPayloadMap[K]) => Promise<void> } = {
  order_confirmation: sendOrderConfirmationEmail,
  order_status_update: sendOrderStatusUpdateEmail,
  return_status: sendReturnStatusEmail,
  newsletter_subscription: sendNewsletterSubscriptionEmail,
};

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;
// A job stuck in "processing" past this long was almost certainly orphaned by a crash/restart
// mid-send (bun --watch restarts on every save in dev) rather than genuinely still running -
// without reclaiming it, that one job would sit there forever and never actually retry.
const STALE_PROCESSING_MS = 10 * 60_000;

function computeBackoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

/** Enqueues an email for async delivery instead of sending it inline - the caller gets back as
 * soon as the job is persisted, without waiting on the SMTP round-trip. */
export async function enqueueEmailJob<T extends EmailJobType>(
  type: T,
  payload: EmailJobPayloadMap[T],
): Promise<void> {
  await EmailJob.create({ type, payload });
}

async function reapStaleProcessingJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const stale = await EmailJob.find({ status: 'processing', updatedAt: { $lte: staleBefore } });
  for (const job of stale) {
    job.attempts += 1;
    job.lastError = 'Trabajo interrumpido (el proceso se reinició mientras se procesaba)';
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
    } else {
      job.status = 'pending';
      job.nextAttemptAt = new Date(Date.now() + computeBackoffMs(job.attempts));
    }
    await job.save();
  }
}

async function claimNextJob() {
  const now = new Date();
  return EmailJob.findOneAndUpdate(
    { status: 'pending', nextAttemptAt: { $lte: now } },
    { $set: { status: 'processing' } },
    { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
  );
}

async function runJob(job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>): Promise<void> {
  const sender = EMAIL_SENDERS[job.type as EmailJobType];
  try {
    if (!sender) throw new Error(`Tipo de trabajo de email desconocido: ${job.type}`);
    await sender(job.payload);
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
  } catch (err) {
    job.attempts += 1;
    job.lastError = err instanceof Error ? err.message : String(err);
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      logger.error(
        { jobId: job._id, type: job.type, attempts: job.attempts, err: job.lastError },
        '[EMAIL_QUEUE] Job agotó reintentos, marcado como failed',
      );
    } else {
      job.status = 'pending';
      job.nextAttemptAt = new Date(Date.now() + computeBackoffMs(job.attempts));
      logger.warn(
        { jobId: job._id, type: job.type, attempts: job.attempts, nextAttemptAt: job.nextAttemptAt, err: job.lastError },
        '[EMAIL_QUEUE] Job falló, reintentando con backoff',
      );
    }
    await job.save();
  }
}

/** Claims and runs up to `limit` due jobs, one at a time. Exported directly (not just through the
 * interval worker) so tests/scripts can drive the queue deterministically. */
export async function processEmailJobs(limit = 5): Promise<number> {
  await reapStaleProcessingJobs();
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;
    await runJob(job);
  }
  return processed;
}

let workerInterval: ReturnType<typeof setInterval> | null = null;

export function startEmailQueueWorker(intervalMs = Number(process.env.EMAIL_QUEUE_POLL_INTERVAL_MS) || 5000): void {
  if (workerInterval || process.env.NODE_ENV === 'test') return;
  workerInterval = setInterval(() => {
    processEmailJobs().catch((err) => {
      logger.error({ err }, '[EMAIL_QUEUE] Error procesando la cola');
    });
  }, intervalMs);
  // Don't let the polling timer keep the process alive on its own (relevant for one-off scripts
  // that import this module transitively, e.g. seeders).
  workerInterval.unref?.();
}

export function stopEmailQueueWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
