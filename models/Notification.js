const mongoose = require("mongoose");
const { NOTIFICATION_TYPES, RESOURCE_TYPES, TITLE_MAX_LENGTH, MESSAGE_MAX_LENGTH } = require("../utils/constants/notifications");

const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
  title: { type: String, required: true, trim: true, maxlength: TITLE_MAX_LENGTH },
  message: { type: String, required: true, trim: true, maxlength: MESSAGE_MAX_LENGTH },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  relatedResourceType: { type: String, enum: Object.values(RESOURCE_TYPES), default: null },
  relatedResourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

schema.pre("validate", function (next) {
  if (this.relatedResourceId && !this.relatedResourceType) this.invalidate("relatedResourceType", "A resource ID requires a resource type.");
  if ((this.isRead && !this.readAt) || (!this.isRead && this.readAt)) this.invalidate("readAt", "Read state and timestamp must agree.");
  next();
});
// Support newest-first listing, including filtered listing, and unread counts.
schema.index({ recipient: 1, createdAt: -1, _id: -1 });
schema.index({ recipient: 1, isRead: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model("Notification", schema);
