exports.list = async (req, res, next) => { try { res.json({ success: true, data: await require("../services/auditService").list(req.user, req.query) }); } catch (err) { next(err); } };
