const { BLOCKED_TERMS, SUBSTITUTIONS, REJECTION_MESSAGE } = require("../utils/constants/moderation");
const error = require("../utils/authError");
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const separator = "[\\s\\p{P}\\p{S}]*";
const patterns = BLOCKED_TERMS.map(term => new RegExp(`(?<![\\p{L}\\p{N}])${[...term].map(letter => SUBSTITUTIONS[letter] ? `[${escape(SUBSTITUTIONS[letter])}]` : escape(letter)).join(separator)}(?![\\p{L}\\p{N}])`, "u"));
const validateText = text => {
  if (typeof text !== "string") throw error(400, "Enter valid text.");
  if (text.length > 10000) throw error(400, "Text exceeds the supported length.");
  const normalized = text.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  if (patterns.some(pattern => pattern.test(normalized))) throw error(400, REJECTION_MESSAGE);
  // Never rewrite accepted content. Field validators own required/length rules.
  return text;
};
module.exports = { validateText };
