import { Schema, model } from 'mongoose';

const PerformanceMetricSchema = new Schema(
  {
    method: { type: String, required: true, index: true },
    route: { type: String, required: true, index: true },
    statusCode: { type: Number, required: true, index: true },
    latencyMs: { type: Number, required: true, min: 0 },
    slow: { type: Boolean, default: false, index: true },
    error: { type: Boolean, default: false, index: true },
    userId: { type: String, index: true },
    userRole: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

PerformanceMetricSchema.index({ createdAt: -1 });
PerformanceMetricSchema.index({ route: 1, method: 1, createdAt: -1 });

export const PerformanceMetric = model('PerformanceMetric', PerformanceMetricSchema);
