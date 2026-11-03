const SESSION_STATUSES = Object.freeze({ DRAFT: "DRAFT", OPEN: "OPEN", CLOSED: "CLOSED" });
const QUESTION_TYPES = Object.freeze({ SINGLE_CHOICE: "SINGLE_CHOICE", MULTI_SELECT: "MULTI_SELECT", RATING: "RATING", SHORT_ANSWER: "SHORT_ANSWER" });
const LIMITS = Object.freeze({ title: 160, description: 2000, questions: 50, prompt: 1000, options: 20, option: 200 });
module.exports = { SESSION_STATUSES, QUESTION_TYPES, LIMITS };
