const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const checkResultsWorkflow = async ({ page, frontendOrigin, apiOrigin, sessionId, student, namedStudent, width, artifacts, checkLayout, availability }) => {
  const endpoint = `${apiOrigin}/api/feedback-sessions/${sessionId}/results`;
  const resultResponse = page.waitForResponse(res => res.url() === endpoint && res.request().method() === "GET");
  await page.getByRole("link", { name: "View Results", exact: true }).click();
  const result = await resultResponse; assert.equal(result.status(), 200, await result.text()); const data = (await result.json()).data;
  assert.equal(data.session.availability, availability); assert.deepEqual(data.summary, { eligibleStudents: 2, totalResponses: 2, responseRate: 100, anonymousResponses: 1, namedResponses: 1, totalQuestions: 4, requiredQuestions: 3 });
  const summary = page.getByRole("region", { name: "Session summary", exact: true });
  for (const [label, value] of [["Eligible Students", "2"], ["Responses", "2"], ["Response Rate", "100.0%"], ["Anonymous", "1"], ["Named", "1"]]) assert.equal(await summary.getByText(label, { exact: true }).locator("..").locator("strong").innerText(), value);
  await page.getByText(availability === "OPEN" ? "This session is still accepting responses. Results may change." : "Session closed.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("figure").count(), 3);
  const single = data.questions.find(question => question.type === "SINGLE_CHOICE"), multi = data.questions.find(question => question.type === "MULTI_SELECT"), rating = data.questions.find(question => question.type === "RATING"), short = data.questions.find(question => question.type === "SHORT_ANSWER");
  assert.deepEqual(single.options.map(option => option.count), [1, 1]); assert.deepEqual(multi.options.map(option => option.count), [1, 2]); assert.deepEqual(multi.options.map(option => option.percentage), [50, 100]); assert.equal(rating.average, 4);
  await page.getByText("Average Rating: 4.00 / 5", { exact: true }).waitFor();
  const textResponse = page.waitForResponse(res => res.url().startsWith(`${endpoint}/questions/${short.questionId}/responses?`));
  await page.getByRole("button", { name: "View text responses for question 3", exact: true }).click();
  const textResult = await textResponse; assert.equal(textResult.status(), 200); const textData = (await textResult.json()).data;
  assert.equal(textData.items.length, 2); const anonymous = textData.items.find(item => item.identityMode === "ANONYMOUS"), named = textData.items.find(item => item.identityMode === "NAMED");
  assert.deepEqual(Object.keys(anonymous).sort(), ["identityMode", "text"]); assert.deepEqual(Object.keys(named.identity).sort(), ["name", "userCode"]);
  await page.getByRole("heading", { name: "Anonymous", exact: true }).waitFor(); await page.getByRole("heading", { name: `${namedStudent.name} — ${namedStudent.userCode.toUpperCase()}`, exact: true }).waitFor();
  for (const source of [JSON.stringify(data), JSON.stringify(textData), await page.content()]) {
    for (const secret of [student.id, student.name, student.userCode, student.userCode.toUpperCase(), student.email, namedStudent.id, namedStudent.email]) assert.equal(source.includes(secret), false, `Private student field appeared in Faculty results at ${width}px`);
  }
  await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `faculty-results-${availability.toLowerCase()}-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Refresh results", exact: true }).click(); await summary.waitFor(); await checkLayout(page);
  await page.getByRole("link", { name: "Back to My Sessions", exact: true }).click(); await page.getByRole("article", { name: data.session.title, exact: true }).waitFor();
  console.log(`PASS: Faculty ${availability} summary/all question analytics/bar charts/short answers/Anonymous privacy/Named identity/refresh at ${width}px`);
};
module.exports = { checkResultsWorkflow };
