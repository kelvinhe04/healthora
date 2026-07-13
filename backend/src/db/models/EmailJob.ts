import { Schema, model } from 'mongoose';

export const EMAIL_JOB_TYPES = [
  'order_confirmation',
  'order_status_update',
  'return_status',
  'newsletter_subscription',
] as const;
export type EmailJobType = (typeof EMAIL_JOB_TYPES)[number];

export const EMAIL_JOB_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export type EmailJobStatus = (typeof EMAIL_JOB_STATUSES)[number];

const EmailJobSchema = new Schema(
  {
    type: { type: String, enum: EMAIL_JOB_TYPES, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: EMAIL_JOB_STATUSES, default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String },
    // Due date for the next processing attempt - a job is only eligible to run once this has
    // passed, which is how retry backoff is implemented (push it into the future on failure).
    nextAttemptAt: { type: Date, default: () => new Date(), index: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

EmailJobSchema.index({ status: 1, nextAttemptAt: 1 });
EmailJobSchema.index({ createdAt: -1 });

export const EmailJob = model('EmailJob', EmailJobSchema);
