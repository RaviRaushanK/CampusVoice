const feedback = require("../services/generalFeedbackService");
const suggestions = require("../services/suggestionService");
const respond = (operation, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await operation(req) }); } catch (err) { next(err); }
};
const handlers = service => ({
  options: respond(req => service.options(req.user, req.query)), create: respond(req => service.create(req.user, req.body), 201),
  mine: respond(req => service.list(req.user, "mine", req.query)), received: respond(req => service.list(req.user, "received", req.query)),
  get: respond(req => service.get(req.user, req.params.id, req.query)),
});
module.exports = { feedback: { ...handlers(feedback), department: respond(req => feedback.list(req.user, "department", req.query)), aggregate: respond(req => feedback.aggregate(req.user, req.query)) }, suggestions: handlers(suggestions) };
