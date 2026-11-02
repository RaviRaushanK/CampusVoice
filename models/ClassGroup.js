const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  semester: { type: Number, required: true, enum: [1, 2, 3, 4] },
  section: { type: String, trim: true, uppercase: true, maxlength: 10, default: "", match: /^[A-Z0-9-]*$/ },
  academicYear: { type: String, required: true, match: /^\d{4}-\d{4}$/ },
  batch: { type: String, default: null, match: /^\d{4}-\d{4}$/ },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
schema.index({ departmentId: 1, academicYear: 1, semester: 1, section: 1 }, { unique: true });
module.exports = mongoose.model("ClassGroup", schema);
