const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20, match: /^[A-Z0-9][A-Z0-9_-]*$/ },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
schema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model("Department", schema);
