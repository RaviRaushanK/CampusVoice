import { useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import FeedbackSummary from "../../components/messages/FeedbackSummary";
import { getFeedbackAggregate } from "../../services/generalFeedbackService";
const FeedbackOverview = () => {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError("");
    getFeedbackAggregate({ signal: controller.signal }).then(result => { if (active) setData(result.data); }).catch(err => { if (active && err.name !== "AbortError") setError("Unable to load feedback overview. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  return <div className="message-page sessions-page"><PageHeader title="General Feedback Overview" description="Aggregate ratings only. Individual feedback and student identities are not included." /><AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry overview</button>}{loading ? <LoadingSpinner label="Loading feedback overview" /> : !error && data && <FeedbackSummary summary={data} />}</div>;
};
export default FeedbackOverview;
