const { mkdir, writeFile, unlink } = require("node:fs/promises");
const { resolve, extname, basename, sep } = require("node:path");
const { randomUUID } = require("node:crypto");
const { FILES } = require("./constants/complaints");
const error = require("./authError");
const root = () => {
  if (process.env.NODE_ENV === "test" && !process.env.COMPLAINT_UPLOAD_DIR) throw new Error("An isolated complaint upload directory is required for tests.");
  return resolve(process.env.COMPLAINT_UPLOAD_DIR || resolve(__dirname, "../uploads/complaints"));
};
const pathFor = name => { if (!/^[a-f0-9-]{36}\.(pdf|jpg|png|mp4|webm)$/.test(name)) throw error(404, "Attachment unavailable."); const value = resolve(root(), name); if (!value.startsWith(`${root()}${sep}`)) throw error(404, "Attachment unavailable."); return value; };
const signature = (bytes, mime) => mime.startsWith("video/") ? require("./videoSignature")(bytes, mime) : mime === "application/pdf" ? bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
const validate = files => {
  if (files.length > FILES.maxCount) throw error(400, "Attach at most 3 files.");
  return files.map(file => {
    const name = basename(file.originalname.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(-180) || "evidence";
    const extension = extname(name).toLowerCase(), mimeType = FILES.types[extension];
    if (!mimeType || mimeType !== file.mimetype || !file.size || file.size > FILES.maxSize || !signature(file.buffer, mimeType)) throw error(400, "Attachments must be PDF, JPEG, PNG, MP4 or WebM files with matching content headers, up to 5 MB each.");
    return { storageName: `${randomUUID()}${mimeType === "image/jpeg" ? ".jpg" : extension}`, originalName: name, mimeType, size: file.size, buffer: file.buffer };
  });
};
const cleanup = async files => { await Promise.all(files.map(async file => { try { await unlink(pathFor(file.storageName)); } catch (err) { if (err.code !== "ENOENT") throw err; } })); };
const save = async files => {
  if (!files.length) return [];
  const written = [];
  try { await mkdir(root(), { recursive: true }); for (const file of files) { await writeFile(pathFor(file.storageName), file.buffer, { flag: "wx", mode: 0o600 }); written.push(file); } }
  catch (err) { await cleanup(written); throw err; }
  return files.map(({ buffer, ...metadata }) => metadata);
};
module.exports = { root, pathFor, validate, save, cleanup };
