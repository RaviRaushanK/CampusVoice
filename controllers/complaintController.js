const service = require("../services/complaintService");
const wrap = handler => async (req, res, next) => { try { await handler(req, res); } catch (err) { next(err); } };
exports.options = wrap(async (req, res) => res.json({ success: true, data: await service.options(req.user, req.query) }));
exports.create = wrap(async (req, res) => { require("../validators/complaintValidator").emptyQuery(req.query); res.status(201).json({ success: true, data: await service.create(req.user, req.body, req.files || []) }); });
exports.list = view => wrap(async (req, res) => res.json({ success: true, data: await service.list(req.user, view, req.query) }));
exports.get = wrap(async (req, res) => res.json({ success: true, data: await service.get(req.user, req.params.id, req.query) }));
exports.act = kind => wrap(async (req, res) => res.json({ success: true, data: await service.act(req.user, req.params.id, kind, req.body || {}, req.query) }));
exports.attachment = wrap(async (req, res) => {
  const file = await service.attachment(req.user, req.params.id, req.params.attachmentId, req.query);
  res.set({ "Content-Type": file.mimeType, "X-Content-Type-Options": "nosniff" });
  res.download(file.path, file.filename, err => { if (err && !res.headersSent) res.status(404).json({ success: false, message: "Attachment unavailable." }); });
});
