const tones = {
  ACTIVE: "success", OPEN: "success", COMPLETED: "success", RESOLVED: "success", SUCCEEDED: "success",
  INACTIVE: "neutral", CLOSED: "neutral", DRAFT: "neutral", NORMAL: "neutral",
  HIGH: "warning", ESCALATED: "warning", SCHEDULED: "warning", UNCONFIRMED: "warning",
  URGENT: "danger", FAILED: "danger", IN_PROGRESS: "primary", ACKNOWLEDGED: "info", SUBMITTED: "info",
  ANONYMOUS: "info", NAMED: "primary",
};
export default function StatusBadge({ value, children }) {
  const label = String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  return <span className={`cv-badge cv-badge-${tones[value] || "neutral"}`}>{children || label}</span>;
}
