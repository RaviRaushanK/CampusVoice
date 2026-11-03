const mongoose = require("mongoose");
const { TYPES, STATUSES, PRIORITIES } = require("../utils/constants/complaints");
const reference = (required = true) => ({ type: mongoose.Schema.Types.ObjectId, ref: "User", required, immutable: true });
const schema = new mongoose.Schema({
  studentId: { ...reference(), select: false }, departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true, immutable: true },
  type: { type: String, enum: Object.values(TYPES), required: true, immutable: true },
  title: { type: String, required: true, minlength: 5, maxlength: 150, immutable: true },
  description: { type: String, required: true, minlength: 20, maxlength: 5000, immutable: true },
  identityMode: { type: String, enum: ["ANONYMOUS", "NAMED"], default: "ANONYMOUS", immutable: true },
  targetFacultyId: reference(false), targetHodId: reference(false), initialHandlerId: reference(), initialHandlerRole: { type: String, required: true, immutable: true },
  currentHandlerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, currentHandlerRole: { type: String, enum: ["FACULTY", "HOD", "PRINCIPAL"], required: true },
  priorHandlers: { type: [new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true }, role: { type: String, required: true } }, { _id: false })], default: [] },
  status: { type: String, enum: STATUSES, default: "SUBMITTED" }, priority: { type: String, enum: PRIORITIES, default: "NORMAL" },
  escalationLevel: { type: Number, min: 0, max: 2, default: 0 }, escalationRequestedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null }, closedAt: { type: Date, default: null }, resolutionSummary: { type: String, maxlength: 2000, default: "" },
  attachments: { type: [new mongoose.Schema({ storageName: { type: String, required: true }, originalName: { type: String, required: true, maxlength: 180 }, mimeType: { type: String, required: true }, size: { type: Number, required: true } })], immutable: true, default: [] },
  events: { type: [require("./ComplaintEvent")], required: true },
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ studentId: 1, createdAt: -1, _id: -1 });
schema.index({ currentHandlerId: 1, currentHandlerRole: 1, createdAt: -1, _id: -1 });
schema.index({ "priorHandlers.userId": 1, "priorHandlers.role": 1, createdAt: -1, _id: -1 });
schema.set("toJSON", { transform(doc, value) { for (const field of ["studentId", "events", "attachments", "priorHandlers", "initialHandlerId", "targetFacultyId", "targetHodId"]) delete value[field]; return value; } });
module.exports = mongoose.model("Complaint", schema);
