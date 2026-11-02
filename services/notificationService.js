const Notification = require("../models/Notification");
const User = require("../models/User");
const error = require("../utils/authError");
const { validateId, validateCreation, parseListQuery } = require("../validators/notificationValidator");

const responseFields = "_id type title message isRead readAt relatedResourceType relatedResourceId createdAt";
const toSafeNotification = notification => ({
  id: String(notification._id), type: notification.type, title: notification.title, message: notification.message,
  isRead: notification.isRead, readAt: notification.readAt, relatedResourceType: notification.relatedResourceType,
  relatedResourceId: notification.relatedResourceId, createdAt: notification.createdAt,
});

const createNotification = async input => {
  const fields = validateCreation(input);
  if (!await User.exists({ _id: fields.recipient })) throw error(400, "Notification recipient is unavailable.");
  return toSafeNotification(await Notification.create(fields));
};
const getNotificationsForUser = async (recipient, options = {}) => {
  validateId(recipient, "recipient identifier");
  const { page, limit, status } = parseListQuery(options);
  const filter = { recipient, ...(status !== "all" ? { isRead: status === "read" } : {}) };
  const [notifications, total] = await Promise.all([
    Notification.find(filter).select(responseFields).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / limit);
  return {
    notifications: notifications.map(toSafeNotification),
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 && total > 0 },
  };
};
const getUnreadCount = async recipient => {
  validateId(recipient, "recipient identifier");
  return Notification.countDocuments({ recipient, isRead: false });
};
const markNotificationRead = async (recipient, notificationId) => {
  validateId(recipient, "recipient identifier");
  validateId(notificationId, "notification identifier");
  const filter = { _id: notificationId, recipient };
  const updated = await Notification.findOneAndUpdate({ ...filter, isRead: false }, {
    $set: { isRead: true, readAt: new Date() },
  }, { new: true, runValidators: true }).select(responseFields).lean();
  // Already-read records are returned without rewriting their original timestamp.
  const notification = updated || await Notification.findOne(filter).select(responseFields).lean();
  if (!notification) throw error(404, "Notification unavailable.");
  return toSafeNotification(notification);
};
const markAllNotificationsRead = async recipient => {
  validateId(recipient, "recipient identifier");
  const result = await Notification.updateMany({ recipient, isRead: false }, { $set: { isRead: true, readAt: new Date() } }, { runValidators: true });
  return { modifiedCount: result.modifiedCount };
};

module.exports = { createNotification, getNotificationsForUser, getUnreadCount, markNotificationRead, markAllNotificationsRead };
