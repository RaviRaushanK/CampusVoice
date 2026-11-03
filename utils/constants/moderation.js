// Central server-only configuration. Match complete normalized terms, never
// arbitrary substrings. Extend deliberately alongside false-positive tests.
const BLOCKED_TERMS = Object.freeze(["fuck", "fucking", "fucker", "shit", "shitty", "bullshit", "bitch", "asshole", "bastard", "idiot"]);
const SUBSTITUTIONS = Object.freeze({ a: "a4@", e: "e3", i: "i1!", o: "o0", s: "s5$", t: "t7" });
const REJECTION_MESSAGE = "Your message contains inappropriate language. Please revise it before submitting.";
module.exports = { BLOCKED_TERMS, SUBSTITUTIONS, REJECTION_MESSAGE };
