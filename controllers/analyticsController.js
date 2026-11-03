const service = require("../services/analyticsService");
exports.get = kind => async (req, res, next) => { try { res.json({ success: true, data: kind === "complaint-processing" ? await service.processing(req.user, req.query) : await service.get(req.user, kind, req.query) }); } catch (err) { next(err); } };
