import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSessionResults } from "../../services/feedbackSessionService";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import StatCard from "../../components/common/StatCard";
import ResultDistribution from "../../components/feedback/ResultDistribution";
import ShortAnswerResults from "../../components/feedback/ShortAnswerResults";
import { QUESTION_LABELS } from "./feedbackFields";
const date = value => value ? new Date(value).toLocaleString() : "Not configured";
const SessionResults = () => {
  const { sessionId } = useParams();
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    getSessionResults(sessionId, { signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError(err.status === 409 ? "Results are available only for published sessions." : "Unable to load session results. The session may be unavailable. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [sessionId, attempt]);
  return <div className="session-results sessions-page">
    <PageHeader title="Session Results" description="Feedback from your published questionnaire." />
    <div className="d-flex flex-wrap gap-2 mb-3"><Link className="btn btn-outline-secondary" to="/my-sessions">Back to My Sessions</Link><button className="btn btn-outline-primary" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh results</button></div>
    <AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry results</button>}
    {loading ? <LoadingSpinner label="Loading session results" /> : data && <>
      <section className="panel mb-3" aria-label="Session information"><h3 className="h4">{data.session.title}</h3><p>{data.session.subject?.code} — {data.session.subject?.name}</p><p>Semester {data.session.classGroup?.semester} · Section {data.session.classGroup?.section || "Not assigned"} · {data.session.classGroup?.academicYear}</p><p>Status: <strong>{data.session.availability}</strong><br />Opens: {date(data.session.opensAt)}<br />Closes: {date(data.session.closesAt)}</p></section>
      <AlertMessage message={data.session.availability === "OPEN" ? "This session is still accepting responses. Results may change." : data.session.availability === "SCHEDULED" ? "Scheduled session. Students can respond when the opening time arrives." : "Session closed."} />
      <section aria-label="Session summary" className="row g-3 mb-3">{[
        ["Eligible Students", data.summary.eligibleStudents], ["Responses", data.summary.totalResponses], ["Response Rate", `${data.summary.responseRate.toFixed(1)}%`], ["Anonymous", data.summary.anonymousResponses], ["Named", data.summary.namedResponses],
      ].map(([label, value]) => <div className="col-sm-6 col-xl-4" key={label}><StatCard label={label} value={value} icon="bi-clipboard-data" /></div>)}</section>
      <p className="text-muted">Eligible Students means currently active students matching the published class criteria. Earlier responses remain counted; the rate can exceed 100% if class membership changes. With no eligible students, the rate is 0%.</p>
      <p>{data.summary.totalQuestions} questions · {data.summary.requiredQuestions} required</p>
      {!data.summary.totalResponses && <AlertMessage message="No responses have been submitted yet." />}
      {data.questions.map((question, index) => <section className="panel mb-3 result-question" key={question.questionId} aria-label={`Question ${index + 1} results`}>
        <h3 className="h5">Question {index + 1}: {question.prompt}</h3><p>{QUESTION_LABELS[question.type]} · {question.required ? "Required" : "Optional"}</p><p>Answered: {question.answeredCount} · Skipped: {question.skippedCount}</p>
        {question.options && <><p className="text-muted">{question.type === "MULTI_SELECT" ? "Percentages use students who answered this question. Multiple selections can make percentages total more than 100%." : "Percentages use students who answered this question."}</p><ResultDistribution label={`Question ${index + 1} option distribution`} rows={question.options.map(option => ({ label: option.option, count: option.count, percentage: option.percentage }))} /></>}
        {question.type === "RATING" && <><p className="fw-semibold">{question.average === null ? "No rating responses yet." : `Average Rating: ${question.average.toFixed(2)} / 5`}</p><ResultDistribution label={`Question ${index + 1} rating distribution`} rows={question.distribution.map(row => ({ label: `Rating ${row.rating}`, count: row.count, percentage: row.percentage }))} /></>}
        {question.type === "SHORT_ANSWER" && <ShortAnswerResults sessionId={sessionId} questionId={question.questionId} questionNumber={index + 1} answeredCount={question.answeredCount} />}
      </section>)}
    </>}
  </div>;
};
export default SessionResults;
