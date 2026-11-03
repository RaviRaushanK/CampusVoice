import { useEffect, useState } from "react";
import { getAnalytics } from "../../services/analyticsService";
import AlertMessage from "../common/AlertMessage";
import LoadingSpinner from "../common/LoadingSpinner";
import { AnalyticsCards, DateFilters } from "./AnalyticsPage";
const StudentSummary = () => {
  const [opened, setOpened] = useState(false), [draft, setDraft] = useState({ dateFrom: "", dateTo: "" }), [query, setQuery] = useState({}), [attempt, setAttempt] = useState(0), [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (!opened) return; let active = true; const controller = new AbortController(); setLoading(true); setData(null); setError(""); getAnalytics("summary", query, { signal: controller.signal }).then(result => { if (active) setData(result.data); }).catch(err => { if (active && err.name !== "AbortError") setError(err.message || "Unable to load personal summary."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; controller.abort(); }; }, [opened, query, attempt]);
  return <details className="panel mb-3 analytics-page" onToggle={event => setOpened(event.currentTarget.open)}><summary>My activity by period</summary>{opened && <div className="mt-3"><p>Your own activity only.</p><DateFilters value={draft} onChange={setDraft} onApply={() => setQuery({ ...draft })} disabled={loading} /><AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Retry personal summary</button>}{loading ? <LoadingSpinner label="Loading personal summary" /> : data && <><p>{data.period.dateFrom} to {data.period.dateTo} (UTC)</p><AnalyticsCards metrics={data.summary} /></>}</div>}</details>;
};
export default StudentSummary;
