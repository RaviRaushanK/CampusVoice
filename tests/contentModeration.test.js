const { validateText } = require("../services/contentModerationService");
const { REJECTION_MESSAGE } = require("../utils/constants/moderation");
test.each(["Thank you for the classroom examples.", "Classical assessment and assistance are useful.", "The shiitake mushroom discussion was interesting.", "This assignment explains shell scripting.", "We discussed the Scunthorpe problem.", "The word bullshitake is not an exact blocked term.", "", "   ", "नमस्ते, please add examples."])("accepts clean text without substring false positives %#", text => expect(validateText(text)).toBe(text));
test.each(["FUCK", "ShIt", "b.a.d wording: f.u.c.k", "s h i t", "b---i___t***c...h", "sh1t", "sh!t", "b1tch", "4ssh0le", "a55hole", "b@$t@rd", "f!u!c!k", "ｆｕｃｋ", "sh\u200bit", "You are an IDIOT.", "bullshit!", "Before: f  u   c    k. After."])("rejects normalized term/evasion %#", text => expect(() => validateText(text)).toThrow(REJECTION_MESSAGE));
test("uses the same safe rejection without revealing terms or algorithm metadata", () => {
  try { validateText("shit and fuck"); } catch (err) { expect(err.statusCode).toBe(400); expect(err.message).toBe(REJECTION_MESSAGE); expect(err).not.toHaveProperty("matchedTerm"); }
});
test("bounds service processing and leaves required fields to their validator", () => {
  expect(validateText("")).toBe(""); expect(() => validateText("x".repeat(10001))).toThrow(); expect(() => validateText(null)).toThrow();
});
