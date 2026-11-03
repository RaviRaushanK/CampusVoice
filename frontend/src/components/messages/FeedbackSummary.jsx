import "../../styles/feedback.css";
import StatCard from "../common/StatCard";
import ResultDistribution from "../feedback/ResultDistribution";
const FeedbackSummary = ({ summary }) => <section aria-label="Feedback summary" className="mb-3">
  <div className="row g-3 mb-3"><div className="col-sm-6"><StatCard label="Total Feedback" value={summary.totalFeedback} icon="bi-chat-square-text" /></div><div className="col-sm-6"><StatCard label="Average Rating" value={summary.averageRating === null ? "No ratings yet" : `${summary.averageRating.toFixed(2)} / 5`} icon="bi-star" /></div></div>
  <ResultDistribution label="Feedback rating distribution" rows={summary.distribution.map(row => ({ label: `Rating ${row.rating}`, count: row.count, percentage: summary.totalFeedback ? row.count / summary.totalFeedback * 100 : 0 }))} />
</section>;
export default FeedbackSummary;
