const User = require("../models/User");
const { IDENTITY_MODES } = require("../utils/constants/messages");
const summarize = rows => {
  const counts = new Map(rows.map(row => [row._id, row.count]));
  const totalFeedback = rows.reduce((sum, row) => sum + row.count, 0);
  const sum = rows.reduce((total, row) => total + row._id * row.count, 0);
  return { totalFeedback, averageRating: totalFeedback ? Number((sum / totalFeedback).toFixed(2)) : null, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: counts.get(rating) || 0 })) };
};
const readPage = async (Model, filter, query, own, hasRating) => {
  const [result] = await Model.aggregate([
    { $match: filter }, { $facet: {
      items: [
        { $sort: { createdAt: -1, _id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit },
        { $project: { message: 1, identityMode: 1, facultyId: 1, ...(own ? { submittedAt: 1 } : {}), ...(hasRating ? { rating: 1, subjectId: 1 } : {}),
          namedStudentId: own ? "$$REMOVE" : { $cond: [{ $eq: ["$identityMode", IDENTITY_MODES.NAMED] }, "$studentId", "$$REMOVE"] },
        } },
        { $lookup: { from: "users", localField: "facultyId", foreignField: "_id", pipeline: [{ $project: { _id: 0, name: 1 } }], as: "faculty" } },
        ...(hasRating ? [{ $lookup: { from: "subjects", localField: "subjectId", foreignField: "_id", pipeline: [{ $project: { _id: 0, code: 1, name: 1 } }], as: "subject" } }] : []),
      ],
      stats: hasRating ? [{ $group: { _id: "$rating", count: { $sum: 1 } } }] : [{ $count: "count" }],
    } },
  ]);
  const namedIds = result.items.flatMap(item => item.namedStudentId ? [item.namedStudentId] : []);
  const identities = namedIds.length ? await User.find({ _id: { $in: namedIds } }).select("name userCode").lean() : [];
  const names = new Map(identities.map(value => [String(value._id), { name: value.name, userCode: value.userCode }]));
  const summary = hasRating ? summarize(result.stats) : undefined;
  const total = hasRating ? summary.totalFeedback : result.stats[0]?.count || 0;
  return { items: result.items.map(item => ({ id: String(item._id), message: item.message, identityMode: item.identityMode,
    faculty: item.faculty[0] || null, ...(hasRating ? { rating: item.rating, subject: item.subject[0] || null } : {}),
    ...(own ? { submittedAt: item.submittedAt } : item.identityMode === IDENTITY_MODES.NAMED ? { identity: names.get(String(item.namedStudentId)) || null } : {}),
  })), ...(summary ? { summary } : {}), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), hasNextPage: query.page * query.limit < total, hasPreviousPage: query.page > 1 && total > 0 } };
};
module.exports = { readPage, summarize };
