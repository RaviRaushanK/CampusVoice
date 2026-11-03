import RatingChoice from "../../components/common/RatingChoice";
import IdentityChoice from "../../components/common/IdentityChoice";
import "../../styles/feedback.css";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as service from "../../services/feedbackSessionService";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
const Questionnaire = () => {
  const { sessionId } = useParams(), navigate = useNavigate(), busy = useRef(false), confirmationRef = useRef(null);
  const [session, setSession] = useState(null), [values, setValues] = useState({}), [mode, setMode] = useState("ANONYMOUS");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [loadError, setLoadError] = useState(""), [attempt, setAttempt] = useState(0), [confirmation, setConfirmation] = useState(false), [saving, setSaving] = useState(false), [locked, setLocked] = useState(false);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setLoadError("");
    service.getStudentSession(sessionId, { signal: controller.signal }).then(result => { if (active) { setSession(result.data); setMode(result.data.allowAnonymous ? "ANONYMOUS" : "NAMED"); } })
      .catch(err => { if (active && err.name !== "AbortError") { setLoadError(err.message || "Unable to load questionnaire."); if (err.code === "ALREADY_SUBMITTED") setLocked(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [sessionId, attempt]);
  useEffect(() => { if (confirmation) confirmationRef.current?.focus(); }, [confirmation]);
  const set = (questionId, value) => setValues(current => ({ ...current, [questionId]: value }));
  const prepare = event => {
    event.preventDefault(); if (busy.current || locked) return;
    for (const [index, question] of session.questions.entries()) {
      const value = values[question.id];
      const empty = value === undefined || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);
      if (question.required && empty) { setError(`Answer required question ${index + 1}.`); return; }
      if (question.type === "SHORT_ANSWER" && value?.length > 1000) { setError(`Question ${index + 1}: use at most 1000 characters.`); return; }
      if (question.type === "RATING" && !empty && (!Number.isInteger(value) || value < 1 || value > 5)) { setError(`Question ${index + 1}: choose a rating from 1 to 5.`); return; }
    }
    setError(""); setConfirmation(true);
  };
  const submit = async () => {
    if (busy.current || locked) return; busy.current = true; setSaving(true); setError("");
    try {
      const answers = session.questions.flatMap(question => {
        const value = values[question.id];
        return value === undefined || value === "" || (Array.isArray(value) && !value.length) ? [] : [{ questionId: question.id, value }];
      });
      await service.submitSessionResponse(sessionId, { identityMode: mode, answers });
      navigate("/feedback-sessions?category=completed", { replace: true, state: { message: "Feedback submitted successfully. Thank you for completing this session." } });
    } catch (err) {
      setError(err.message || "Unable to submit feedback. Please try again.");
      if (["ALREADY_SUBMITTED", "SESSION_UNAVAILABLE"].includes(err.code)) setLocked(true);
      setConfirmation(false);
    } finally { busy.current = false; setSaving(false); }
  };
  return <div className="student-questionnaire sessions-page">
    <PageHeader title={session?.title || "Feedback questionnaire"} description={session?.description} />
    <Link className="btn btn-outline-secondary mb-3" to={locked ? "/feedback-sessions?category=completed" : "/feedback-sessions"}>Back to Feedback Sessions</Link>
    {loading ? <LoadingSpinner label="Loading questionnaire" /> : loadError ? <><AlertMessage type="danger" message={loadError} />{!locked && <button className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Retry questionnaire</button>}</> : session && <>
      <p>{session.subject?.code} — {session.subject?.name}<br />Faculty: {session.faculty?.name}<br />Closes: {session.closesAt ? new Date(session.closesAt).toLocaleString() : "No closing time"}</p>
      <AlertMessage type="danger" message={error} />
      {session.questions.some(question => question.type === "SHORT_ANSWER") && <p className="text-muted">Please use respectful and appropriate language.</p>}
      <form aria-label="Student feedback" onSubmit={prepare} noValidate><fieldset disabled={saving || locked || confirmation}>
        <fieldset className="panel mb-3"><legend className="h5">Your identity</legend>{session.allowAnonymous ? <><p>If you stay anonymous, your identity will not be shown to the Faculty member. Your choice cannot change after submission.</p><IdentityChoice name="identity" value={mode} onChange={setMode} /></> : <p>This session uses named responses.</p>}</fieldset>
        {session.questions.map((question, index) => <fieldset key={question.id} className="panel mb-3"><legend className="h6">{index + 1}. {question.prompt} ({question.required ? "Required" : "Optional"})</legend>
          {["SINGLE_CHOICE", "MULTI_SELECT"].includes(question.type) && question.options.map((option, position) => <label className="answer-option" key={position}><input type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name={`question-${question.id}`} checked={question.type === "SINGLE_CHOICE" ? values[question.id] === option : (values[question.id] || []).includes(option)} onChange={event => question.type === "SINGLE_CHOICE" ? set(question.id, option) : set(question.id, event.target.checked ? [...(values[question.id] || []), option] : (values[question.id] || []).filter(value => value !== option))} /><span>{option}</span></label>)}
          {question.type === "RATING" && <RatingChoice name={`question-${question.id}`} value={values[question.id]} onChange={value => set(question.id, value)} />}
          {question.type === "SHORT_ANSWER" && <><label className="form-label" htmlFor={`answer-${question.id}`}>Answer question {index + 1}</label><textarea className="form-control" id={`answer-${question.id}`} rows={4} maxLength={1000} value={values[question.id] || ""} onChange={event => set(question.id, event.target.value)} /><p className="text-muted">{(values[question.id] || "").length}/1000 characters</p></>}
        </fieldset>)}
        <button className="btn btn-primary" type="submit">Submit Feedback</button>
      </fieldset></form>
      {confirmation && <section ref={confirmationRef} tabIndex={-1} className="panel mt-3" role="alertdialog" aria-labelledby="submit-title" aria-describedby="submit-description"><h3 className="h5" id="submit-title">Submit feedback?</h3><p id="submit-description">You will not be able to edit your response or identity choice after submitting.</p><div className="d-flex flex-wrap gap-2"><button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? "Submitting..." : "Confirm Submission"}</button><button className="btn btn-outline-secondary" disabled={saving} onClick={() => setConfirmation(false)}>Keep editing</button></div></section>}
    </>}
  </div>;
};
const SessionQuestionnaire = () => { const { sessionId } = useParams(); return <Questionnaire key={sessionId} />; };
export default SessionQuestionnaire;
