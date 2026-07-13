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

// No `next` callback param: Mongoose 9 dropped callback-style hooks (a `next`-shaped param on
// pre('save') now receives SaveOptions, not a callback - calling it throws "next is not a
// function"). Throwing synchronously is what actually aborts the operation on this version.
SecurityAuditLogSchema.pre('save', function blockExistingDocumentSave() {
  if (!this.isNew) throw immutableOperationError;
});

// { document: true, query: true } is required for deleteOne/updateOne/replaceOne specifically -
// those exist as both a Document instance method and a Model static/query method, and without
// this option Mongoose only wires the hook to one of the two, letting the other bypass it.
SecurityAuditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  { document: true, query: true },
  function blockMutableOperations() {
    throw immutableOperationError;
  }
);

SecurityAuditLogSchema.index({ createdAt: -1, action: 1 });
SecurityAuditLogSchema.index({ actorClerkId: 1, createdAt: -1 });

export const SecurityAuditLog = model('SecurityAuditLog', SecurityAuditLogSchema);
