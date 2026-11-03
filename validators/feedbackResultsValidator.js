const error = require("../utils/authError");
const { id } = require("./academicValidator");
const { parseQuery } = require("./feedbackSessionValidator");
const parseResultsQuery = (query = {}, paginated = false) => {
  const allowed = paginated ? ["page", "limit"] : [];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw error(400, "Unsupported results query.");
  if (!paginated) return {};
  const { page, limit } = parseQuery(query);
  return { page, limit };
};
module.exports = { parseResultsQuery, id };
