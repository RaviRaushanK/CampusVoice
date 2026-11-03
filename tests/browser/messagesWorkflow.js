const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const runMessagesWorkflow = async ({ page, frontendOrigin, apiOrigin, width, artifacts, checkLayout, student, namedStudent, faculty, hod, principalPassword, temporaryPassword, login, logout }) => {
  const rejection = "Your message contains inappropriate language. Please revise it before submitting.";
  const anonFeedback = `General anonymous feedback: more practical examples. ${"DetailedFeedback".repeat(30)}`;
  const namedFeedback = `General named feedback: explain another exercise. ${"NamedFeedbackText".repeat(28)}`;
  const anonSuggestion = `Private anonymous suggestion: another coding workshop. ${"PrivateSuggestionText".repeat(30)}`;
  const namedSuggestion = `Private named suggestion: more practice time. ${"NamedSuggestionText".repeat(30)}`;
  const navigate = async path => { await page.goto(`${frontendOrigin}${path}`); };
  const send = async (kind, text, named = false, expected = 201) => {
    const feedback = kind === "feedback", endpoint = `${apiOrigin}/api/${feedback ? "general-feedback" : "suggestions"}`;
    await page.getByLabel(feedback ? "Faculty / Subject" : "Send To", { exact: true }).waitFor();
    const select = page.getByLabel(feedback ? "Faculty / Subject" : "Send To", { exact: true }); await select.locator("option").nth(1).waitFor({ state: "attached" });
    if (feedback) { await select.selectOption({ index: 1 }); await page.getByLabel(named ? "3" : "5", { exact: true }).check(); }
    else { await select.selectOption(faculty.id); }
    await page.getByLabel(feedback ? "Your Feedback" : "Suggestion", { exact: true }).fill(text);
    await page.getByLabel(named ? "Reveal Identity" : "Stay Anonymous", { exact: true }).check(); await checkLayout(page);
    const response = page.waitForResponse(res => res.url() === endpoint && res.request().method() === "POST");
    await page.getByRole("button", { name: feedback ? "Submit Feedback" : "Send Suggestion", exact: true }).click(); await page.getByRole("alertdialog").waitFor(); await checkLayout(page);
    await page.getByRole("button", { name: feedback ? "Confirm Feedback" : "Confirm Suggestion", exact: true }).click();
    const result = await response; assert.equal(result.status(), expected, await result.text());
    return (await result.json()).data;
  };
  await navigate("/student/general-feedback");
  // Permit only the exact expected console error while this real moderation
  // rejection is being asserted. Every other browser error still fails.
  page.expectPhase7ModerationRejection = true;
  await send("feedback", "This feedback is sh1t and must be revised.", false, 400);
  await page.getByText(rejection, { exact: true }).waitFor(); page.expectPhase7ModerationRejection = false;
  assert.equal((await (await page.request.get(`${apiOrigin}/api/general-feedback/mine`)).json()).data.pagination.total, 0);
  const firstFeedback = await send("feedback", anonFeedback); await page.getByText("General Feedback submitted successfully.", { exact: true }).waitFor(); await page.getByText(anonFeedback, { exact: true }).waitFor(); await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `general-feedback-student-${width}.png`), fullPage: true });
  await navigate("/student/suggestions"); await send("suggestion", anonSuggestion); await page.getByText("Private Suggestion sent successfully.", { exact: true }).waitFor(); await page.getByText(anonSuggestion, { exact: true }).waitFor(); await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `private-suggestion-student-${width}.png`), fullPage: true });
  await logout(); await login(namedStudent.userCode, `Academic_STUDENT_${width}!`, "STUDENT");
  await navigate("/student/general-feedback"); await send("feedback", namedFeedback, true); await page.getByText("General Feedback submitted successfully.", { exact: true }).waitFor(); assert.equal(await page.getByText(anonFeedback, { exact: true }).count(), 0);
  await navigate("/student/suggestions"); await send("suggestion", namedSuggestion, true); await page.getByText("Private Suggestion sent successfully.", { exact: true }).waitFor();
  const privacy = async response => {
    const json = JSON.stringify(response);
    for (const secret of [student.id, student.name, student.userCode, student.email, namedStudent.id, namedStudent.email]) assert.equal(json.includes(secret), false, "Student identity leaked through recipient HTTP JSON");
    const html = await page.content(); for (const secret of [student.id, student.name, student.userCode, student.userCode.toUpperCase(), student.email]) assert.equal(html.includes(secret), false, "Anonymous identity rendered");
  };
  await logout(); await login(faculty.userCode, `Academic_FACULTY_${width}!`, "FACULTY");
  await page.locator(".app-navbar").getByRole("link", { name: "Notifications, 2 unread", exact: true }).waitFor(); await navigate("/notifications"); await page.getByText("You received a new private suggestion.", { exact: true }).first().waitFor(); assert.equal(await page.getByText("You received a new private suggestion.", { exact: true }).count(), 2);
  await navigate("/faculty/general-feedback"); await page.getByText(anonFeedback, { exact: true }).waitFor(); await page.getByRole("heading", { name: `${namedStudent.name} — ${namedStudent.userCode.toUpperCase()}`, exact: true }).waitFor(); await privacy((await (await page.request.get(`${apiOrigin}/api/general-feedback/received`)).json()).data); await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `general-feedback-faculty-${width}.png`), fullPage: true });
  await navigate("/faculty/suggestions"); await page.getByText(anonSuggestion, { exact: true }).waitFor(); await page.getByText(namedSuggestion, { exact: true }).waitFor(); await privacy((await (await page.request.get(`${apiOrigin}/api/suggestions/received`)).json()).data); await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `private-suggestions-faculty-${width}.png`), fullPage: true });
  await logout(); await login("browser.faculty", temporaryPassword, "FACULTY"); await navigate("/faculty/suggestions"); await page.getByText("No messages yet.", { exact: true }).waitFor(); assert.equal((await page.request.get(`${apiOrigin}/api/general-feedback/${firstFeedback.id}`)).status(), 404);
  await logout(); await login(hod.userCode, `Academic_HOD_${width}!`, "HOD"); await navigate("/hod/general-feedback"); await page.getByText(anonFeedback, { exact: true }).waitFor(); await privacy((await (await page.request.get(`${apiOrigin}/api/general-feedback/department`)).json()).data);
  await page.getByLabel("Rating filter", { exact: true }).selectOption("5"); await page.getByText(namedFeedback, { exact: true }).waitFor({ state: "hidden" }); await page.getByText(anonFeedback, { exact: true }).waitFor(); await page.getByLabel("Rating filter", { exact: true }).selectOption(""); await page.getByText(namedFeedback, { exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Private Suggestions", exact: true }).count(), 0); assert.equal((await page.request.get(`${apiOrigin}/api/suggestions/received`)).status(), 403); await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `general-feedback-hod-${width}.png`), fullPage: true });
  await logout(); await login("browser.principal", principalPassword, "PRINCIPAL"); await navigate("/principal/feedback-overview"); await page.getByText("4.00 / 5", { exact: true }).waitFor();
  const aggregate = (await (await page.request.get(`${apiOrigin}/api/general-feedback/aggregate`)).json()).data; assert.deepEqual(Object.keys(aggregate).sort(), ["totalFeedback", "averageRating", "distribution"].sort()); assert.equal(aggregate.totalFeedback, width === 1440 ? 2 : 4); assert.equal(aggregate.averageRating, 4);
  const html = await page.content(); for (const secret of [anonFeedback, namedFeedback, anonSuggestion, namedSuggestion, student.name, student.userCode, namedStudent.name, namedStudent.userCode]) assert.equal(html.includes(secret), false);
  assert.equal(await page.getByRole("link", { name: "Private Suggestions", exact: true }).count(), 0); assert.equal((await page.request.get(`${apiOrigin}/api/suggestions/received`)).status(), 403); assert.equal((await page.request.get(`${apiOrigin}/api/general-feedback/${firstFeedback.id}`)).status(), 403);
  await checkLayout(page); await page.screenshot({ path: resolve(artifacts, `general-feedback-principal-${width}.png`), fullPage: true }); await navigate("/principal/dashboard"); await page.getByText("Workspace ready", { exact: true }).waitFor();
  console.log(`PASS: General Feedback Anonymous/Named/Faculty/HOD/Principal aggregate-only; private Suggestions/neutral notifications/other-Faculty denial; real moderation rejection and revision at ${width}px`);
};
module.exports = { runMessagesWorkflow };
