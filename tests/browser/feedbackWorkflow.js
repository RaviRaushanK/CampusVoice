const assert = require("node:assert/strict");
const { resolve } = require("node:path");

// Runs inside the existing guarded browser database, as the Faculty account
// provisioned through the Phase 5 UI. Does not seed development records.
const runFeedbackWorkflow = async ({ page, frontendOrigin, apiOrigin, width, checkLayout, artifacts }) => {
  await page.goto(`${frontendOrigin}/my-sessions`);
  await page.getByText("No feedback sessions yet.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Create Session", exact: true }).click();
  const assignment = page.getByLabel("Teaching Assignment", { exact: true });
  await assignment.locator("option").nth(1).waitFor({ state: "attached" });
  await assignment.selectOption({ index: 1 });
  const title = `Lecture feedback ${width} ${"LongTitle".repeat(12)}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("Please share feedback about today's linked-list lecture.");
  await page.getByLabel("Opens At", { exact: true }).fill("2027-01-01T10:00");
  await page.getByLabel("Closes At", { exact: true }).fill("2027-01-01T11:00");
  for (const [index, type] of ["SINGLE_CHOICE", "MULTI_SELECT", "RATING", "SHORT_ANSWER"].entries()) {
    await page.getByLabel("New question type", { exact: true }).selectOption(type);
    await page.getByRole("button", { name: "Add Question", exact: true }).click();
    await page.getByLabel(`Question ${index + 1} prompt`, { exact: true }).fill(`Question ${index + 1} ${"LongQuestionText".repeat(35)}`);
    if (index < 2) {
      await page.getByLabel(`Question ${index + 1} option 1`, { exact: true }).fill(`First ${"LongOption".repeat(15)}`);
      await page.getByLabel(`Question ${index + 1} option 2`, { exact: true }).fill("Second option");
    }
  }
  await page.getByRole("button", { name: "Add Option to question 1", exact: true }).click();
  await page.getByLabel("Question 1 option 3", { exact: true }).fill("Extra option");
  await page.getByRole("button", { name: "Remove question 1 option 3", exact: true }).click();
  await page.getByLabel("Question 4 required", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Move question 4 up", exact: true }).click();
  await page.getByText("Questionnaire preview", { exact: true }).click();
  await checkLayout(page);
  await page.screenshot({ path: resolve(artifacts, `feedback-builder-${width}.png`), fullPage: true });
  const createdResponse = page.waitForResponse(response => response.url() === `${apiOrigin}/api/feedback-sessions` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  const created = await createdResponse;
  assert.equal(created.status(), 201, await created.text());
  const draft = (await created.json()).data;
  assert.equal(draft.status, "DRAFT");
  assert.deepEqual(draft.questions.map(question => question.type), ["SINGLE_CHOICE", "MULTI_SELECT", "SHORT_ANSWER", "RATING"]);
  assert.equal(draft.questions[2].required, false);
  await page.getByText("DRAFT session saved.", { exact: true }).waitFor();
  const card = page.getByRole("article", { name: title, exact: true }); await card.waitFor();
  await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `feedback-sessions-${width}.png`), fullPage: true });
  await card.getByRole("link", { name: "Edit Draft", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Teaching Assignment", { exact: true }).count(), 0);
  await page.getByLabel("Title", { exact: true }).fill(`Edited feedback ${width}`);
  await page.getByRole("button", { name: "Remove question 2", exact: true }).click();
  await page.getByRole("button", { name: "Move question 3 up", exact: true }).click();
  await page.getByLabel("Allow students to stay anonymous", { exact: true }).uncheck();
  await checkLayout(page);
  const updatedResponse = page.waitForResponse(response => response.url() === `${apiOrigin}/api/feedback-sessions/${draft.id}` && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  const updated = await updatedResponse; assert.equal(updated.status(), 200, await updated.text());
  const saved = (await updated.json()).data;
  assert.deepEqual(saved.questions.map(question => question.id), [draft.questions[0].id, draft.questions[3].id, draft.questions[2].id]);
  assert.equal(saved.allowAnonymous, false);
  await page.getByRole("article", { name: `Edited feedback ${width}`, exact: true }).waitFor();
  await page.goto(`${frontendOrigin}/faculty/dashboard`);
  await page.getByText("Draft Sessions", { exact: true }).waitFor(); await checkLayout(page);
  console.log(`PASS: Faculty draft create/all question types/options/preview/reorder/stable IDs/edit/remove and dashboard at ${width}px`);
  return saved;
};
module.exports = { runFeedbackWorkflow };
