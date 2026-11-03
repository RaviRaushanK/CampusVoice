const mongoose = require("mongoose");
const { ACTIONS, PUBLIC_RESOURCES, SAFE_FIELDS } = require("../utils/constants/audit");
const schema = new mongoose.Schema({
  operationId: { type: String, required: true, immutable: true, match: /^[a-f0-9-]{36}$/ },
  isRoot: { type: Boolean, required: true, immutable: true },
  phase: { type: String, enum: ["ATTEMPT", "SUCCEEDED", "FAILED"], required: true, immutable: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", immutable: true }, actorRole: { type: String, enum: ["PRINCIPAL", "HOD", "FACULTY", "STUDENT"], immutable: true },
  action: { type: String, enum: ACTIONS, required: true, immutable: true }, resourceType: { type: String, enum: [...PUBLIC_RESOURCES, "COMPLAINT"], required: true, immutable: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, immutable: true },
  metadata: { type: new mongoose.Schema({ changedFields: [{ type: String, enum: SAFE_FIELDS }], isActive: Boolean, reason: { type: String, enum: ["INVALID_CREDENTIALS", "OPERATION_REJECTED", "OPERATION_FAILED"] } }, { _id: false, strict: "throw" }), immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { strict: "throw", autoCreate: false, autoIndex: false });
schema.index({ operationId: 1, phase: 1 }, { unique: true });
schema.index({ isRoot: 1, createdAt: -1, _id: -1 });
schema.index({ isRoot: 1, action: 1, createdAt: -1, _id: -1 });
schema.index({ isRoot: 1, resourceType: 1, createdAt: -1, _id: -1 });
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"]) schema.pre(operation, function () { throw new Error("Audit records are append-only."); });
schema.pre("save", function () { if (!this.isNew) throw new Error("Audit records are append-only."); });
module.exports = mongoose.model("AuditLog", schema);
