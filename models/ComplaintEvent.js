const mongoose = require("mongoose");
const { EVENTS, STATUSES } = require("../utils/constants/complaints");
// Embedded event records share the complaint's atomic write, including on
// standalone MongoDB. There is no independently writable history collection.
module.exports = new mongoose.Schema({
  eventType: { type: String, enum: EVENTS, required: true, immutable: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  actorRole: { type: String, enum: ["STUDENT", "FACULTY", "HOD", "PRINCIPAL"], required: true, immutable: true },
  fromStatus: { type: String, enum: STATUSES, immutable: true }, toStatus: { type: String, enum: STATUSES, required: true, immutable: true },
  fromHandlerRole: { type: String, immutable: true }, toHandlerRole: { type: String, required: true, immutable: true },
  note: { type: String, maxlength: 2000, default: "", immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
});
