import { useEffect, useState } from "react";
import { getShortAnswerResults } from "../../services/feedbackSessionService";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";
const ShortAnswerResults = ({ sessionId, questionId, questionNumber, answeredCount }) => {
  const [expanded, setExpanded] = useState(false), [page, setPage] = useState(1), [attempt, setAttempt] = useState(0);
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!expanded) return;
    let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    getShortAnswerResults(sessionId, questionId, { page, limit: 20 }, { signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError("Unable to load short answers. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [expanded, page, attempt, sessionId, questionId]);
  if (!answeredCount) return <p>No text responses yet.</p>;
  return <section aria-label={`Short answers for question ${questionNumber}`}>
    <button className="btn btn-outline-primary mb-3" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide" : "View"} text responses for question {questionNumber}</button>
    {expanded && <>
      <AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry short answers</button>}
      {loading ? <LoadingSpinner label="Loading short answers" /> : data && <>
        {!data.items.length && <p>No text responses on this page.</p>}
        {data.items.map((item, index) => <article className="short-answer-card mb-3" key={`${page}-${index}`}>
          <h4 className="h6">{item.identityMode === "ANONYMOUS" ? "Anonymous" : item.identity ? `${item.identity.name} — ${item.identity.userCode.toUpperCase()}` : "Named student unavailable"}</h4>
          <p className="mb-0 result-answer-text">{item.text}</p>
        </article>)}
        {data.pagination.totalPages > 0 && <nav className="d-flex flex-wrap gap-3 align-items-center" aria-label={`Short answer pagination for question ${questionNumber}`}><button className="btn btn-outline-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(value => value - 1)}>Previous answers</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button className="btn btn-outline-secondary" disabled={!data.pagination.hasNextPage} onClick={() => setPage(value => value + 1)}>Next answers</button></nav>}
      </>}
    </>}
  </section>;
};
export default ShortAnswerResults;
