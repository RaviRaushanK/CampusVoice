export const QUESTION_LABELS = { SINGLE_CHOICE: "Single Choice", MULTI_SELECT: "Multiple Select", RATING: "Rating", SHORT_ANSWER: "Short Answer" };
export const assignmentLabel = value => `${value.subject?.code || "Unavailable subject"} — ${value.subject?.name || ""} / Semester ${value.classGroup?.semester ?? "—"} / Section ${value.classGroup?.section || "Not assigned"} / ${value.classGroup?.academicYear || value.academicYear || ""}`;
export const localDate = value => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const draftError = fields => {
  if (!fields.title.trim()) return "Enter a session title.";
  if (fields.opensAt && fields.closesAt && new Date(fields.closesAt) <= new Date(fields.opensAt)) return "Closing time must be after opening time.";
  for (const [index, question] of fields.questions.entries()) {
    if (!question.prompt.trim()) return `Enter a prompt for question ${index + 1}.`;
    if (question.options) {
      if (question.options.some(option => !option.trim())) return `Question ${index + 1} has a blank option.`;
      const normalized = question.options.map(option => option.trim().normalize("NFKC").replace(/\s+/g, " ").toLowerCase());
      if (new Set(normalized).size !== normalized.length) return `Question ${index + 1} options must be unique.`;
    }
  }
  return "";
};
