const service = require("../services/notificationService");

const list = async (req, res, next) => {
  try { res.json({ success: true, data: await service.getNotificationsForUser(req.user._id, req.notificationQuery) }); } catch (err) { next(err); }
};
const unreadCount = async (req, res, next) => {
  try { res.json({ success: true, data: { count: await service.getUnreadCount(req.user._id) } }); } catch (err) { next(err); }
};
const markRead = async (req, res, next) => {
  try { res.json({ success: true, data: await service.markNotificationRead(req.user._id, req.params.notificationId) }); } catch (err) { next(err); }
};
const markAllRead = async (req, res, next) => {
  try { res.json({ success: true, data: await service.markAllNotificationsRead(req.user._id) }); } catch (err) { next(err); }
};

module.exports = { list, unreadCount, markRead, markAllRead };
