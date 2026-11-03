const service = require("../services/feedbackSessionService");
const students = require("../services/studentFeedbackService");
const analytics = require("../services/feedbackAnalyticsService");
const respond = (operation, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await operation(req) }); } catch (err) { next(err); }
};
module.exports = {
  list: respond(req => service.list(req.user, req.query)),
  get: respond(req => service.get(req.user, req.params.sessionId)),
  create: respond(req => service.create(req.user, req.body), 201),
  update: respond(req => service.update(req.user, req.params.sessionId, req.body)),
  remove: respond(req => service.remove(req.user, req.params.sessionId)),
  publish: respond(req => service.publish(req.user, req.params.sessionId)),
  close: respond(req => service.close(req.user, req.params.sessionId)),
  studentList: respond(req => students.list(req.user, req.query)),
  studentGet: respond(req => students.get(req.user, req.params.sessionId)),
  submit: respond(req => students.submit(req.user, req.params.sessionId, req.body), 201),
  results: respond(req => analytics.getResults(req.user, req.params.sessionId, req.query)),
  shortAnswers: respond(req => analytics.getShortAnswers(req.user, req.params.sessionId, req.params.questionId, req.query)),
};
