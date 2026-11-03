const service = require("../services/feedbackSessionService");
const respond = (operation, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await operation(req) }); } catch (err) { next(err); }
};
module.exports = {
  list: respond(req => service.list(req.user, req.query)),
  get: respond(req => service.get(req.user, req.params.sessionId)),
  create: respond(req => service.create(req.user, req.body), 201),
  update: respond(req => service.update(req.user, req.params.sessionId, req.body)),
  remove: respond(req => service.remove(req.user, req.params.sessionId)),
};
