const ResultDistribution = ({ rows, label }) => <figure className="result-distribution" aria-label={label}>
  <figcaption className="text-muted mb-2">{label}</figcaption>
  <ul className="list-unstyled mb-0">{rows.map((row, index) => <li className="mb-3" key={index}>
    <div className="d-flex flex-wrap gap-2 justify-content-between"><span className="result-option-label">{row.label}</span><strong>{row.count} · {row.percentage.toFixed(1)}%</strong></div>
    <div className="result-bar-track mt-1" aria-hidden="true"><div className="result-bar-fill" style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }} /></div>
  </li>)}</ul>
</figure>;
export default ResultDistribution;
