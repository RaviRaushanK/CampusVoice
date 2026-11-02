const mongoose = require("mongoose");
const error = require("../utils/authError");
const { NOTIFICATION_TYPES, RESOURCE_TYPES, TITLE_MAX_LENGTH, MESSAGE_MAX_LENGTH } = require("../utils/constants/notifications");

const validateId = (value, label) => {
  if (!mongoose.isObjectIdOrHexString(value)) throw error(400, `Invalid ${label}.`);
  return value;
};
const validateCreation = input => {
  const keys = ["recipient", "type", "title", "message", "relatedResourceType", "relatedResourceId"];
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) {
    throw error(400, "Unsupported notification fields.");
  }
  const recipient = validateId(input.recipient, "recipient identifier");
  if (!Object.values(NOTIFICATION_TYPES).includes(input.type)) throw error(400, "Invalid notification type.");
  const fields = { recipient, type: input.type };
  for (const [key, max] of [["title", TITLE_MAX_LENGTH], ["message", MESSAGE_MAX_LENGTH]]) {
    if (typeof input[key] !== "string" || !input[key].trim() || input[key].trim().length > max) {
      throw error(400, `Notification ${key} must contain between 1 and ${max} characters.`);
    }
    fields[key] = input[key].trim();
  }
  fields.relatedResourceType = input.relatedResourceType ?? null;
  fields.relatedResourceId = input.relatedResourceId ?? null;
  if (fields.relatedResourceType !== null && !Object.values(RESOURCE_TYPES).includes(fields.relatedResourceType)) throw error(400, "Invalid related resource type.");
  if (fields.relatedResourceId !== null) {
    validateId(fields.relatedResourceId, "related resource identifier");
    if (!fields.relatedResourceType) throw error(400, "A resource ID requires a resource type.");
  }
  return fields;
};

const parseListQuery = (query = {}) => {
  if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).some(key => !["page", "limit", "status"].includes(key))) {
    throw error(400, "Only page, limit and status queries are supported.");
  }
  const integer = (value, fallback, max, label) => {
    if (value === undefined) return fallback;
    if ((typeof value !== "string" && typeof value !== "number") || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw error(400, `Invalid ${label}; use an integer between 1 and ${max}.`);
    }
    return Number(value);
  };
  const page = integer(query.page, 1, 1000000, "page");
  const limit = integer(query.limit, 20, 100, "limit");
  const status = query.status === undefined ? "all" : query.status;
  if (!["all", "unread", "read"].includes(status)) throw error(400, "Invalid status; use all, unread or read.");
  return { page, limit, status };
};
const validateList = (req, res, next) => {
  try { req.notificationQuery = parseListQuery(req.query); next(); } catch (err) { next(err); }
};
const validateReadId = (req, res, next) => {
  try { validateId(req.params.notificationId, "notification identifier"); next(); } catch (err) { next(err); }
};
const validateNoInput = (req, res, next) => {
  if (Object.keys(req.query).length || (req.body && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length))) {
    return next(error(400, "This operation does not accept query or body fields."));
  }
  next();
};

module.exports = { validateId, validateCreation, parseListQuery, validateList, validateReadId, validateNoInput };
