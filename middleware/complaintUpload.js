const multer = require("multer");
const { FILES } = require("../utils/constants/complaints");
const error = require("../utils/authError");
const upload = multer({ storage: multer.memoryStorage(), limits: { files: FILES.maxCount, fileSize: FILES.maxSize, fields: 5, fieldSize: 20000, parts: 8, fieldNameSize: 50 } }).array("attachments", FILES.maxCount);
module.exports = (req, res, next) => upload(req, res, err => {
  if (err) return next(error(400, err.code === "LIMIT_FILE_SIZE" ? "Each attachment must be at most 5 MB." : "Invalid upload. Attach at most 3 PDF, JPEG, PNG, MP4 or WebM files with the complaint fields."));
  next();
});
