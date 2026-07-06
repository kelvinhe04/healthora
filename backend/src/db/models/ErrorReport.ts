import { Schema, model } from 'mongoose';

const ErrorReportSchema = new Schema(
  {
    source: { type: String, enum: ['backend', 'frontend'], required: true, index: true },
    name: { type: String },
    message: { type: String, required: true },
    stack: { type: String },
    severity: { type: String, enum: ['error', 'fatal'], default: 'error', index: true },
    route: { type: String, index: true },
    method: { type: String },
    statusCode: { type: Number },
    userId: { type: String, index: true },
    userEmail: { type: String },
    posthogDistinctId: { type: String },
    posthogSessionId: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ErrorReportSchema.index({ createdAt: -1 });
ErrorReportSchema.index({ source: 1, createdAt: -1 });

export const ErrorReport = model('ErrorReport', ErrorReportSchema);
