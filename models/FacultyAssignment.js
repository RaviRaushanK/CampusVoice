const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  classGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassGroup", required: true },
  academicYear: { type: String, required: true, match: /^\d{4}-\d{4}$/ },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
schema.index({ facultyId: 1, subjectId: 1, classGroupId: 1, academicYear: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
schema.index({ departmentId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model("FacultyAssignment", schema);
