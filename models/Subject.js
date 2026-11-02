const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30, match: /^[A-Z0-9][A-Z0-9_-]*$/ },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  semester: { type: Number, required: true, enum: [1, 2, 3, 4] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
schema.index({ departmentId: 1, code: 1 }, { unique: true });
schema.index({ departmentId: 1, semester: 1, code: 1 });
module.exports = mongoose.model("Subject", schema);
