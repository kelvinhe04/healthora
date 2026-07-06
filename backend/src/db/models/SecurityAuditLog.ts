import { Schema, model } from 'mongoose';

const immutableOperationError = new Error('Security audit logs are append-only');

const SecurityAuditLogSchema = new Schema(
  {
    actorClerkId: { type: String, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String, index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    resource: { type: String, index: true },
    targetClerkId: { type: String, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    targetEmail: { type: String, index: true },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, immutable: true, index: true },
  },
  {
    versionKey: false,
  }
);

SecurityAuditLogSchema.pre('save', function blockExistingDocumentSave(next) {
  if (!this.isNew) return next(immutableOperationError);
  return next();
});

SecurityAuditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function blockMutableOperations(next) {
    next(immutableOperationError);
  }
);

SecurityAuditLogSchema.index({ createdAt: -1, action: 1 });
SecurityAuditLogSchema.index({ actorClerkId: 1, createdAt: -1 });

export const SecurityAuditLog = model('SecurityAuditLog', SecurityAuditLogSchema);
