import LoadingSpinner from "../common/LoadingSpinner";

const typeLabels = { SYSTEM: "System", ACCOUNT: "Account", SESSION: "Session", FEEDBACK: "Feedback", SUGGESTION: "Suggestion", COMPLAINT: "Complaint" };
const NotificationItem = ({ notification, onMarkRead, pending, disabled }) => {
  const date = notification.createdAt ? new Date(notification.createdAt) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  return <li>
    <article className={`panel notification-item ${notification.isRead ? "" : "is-unread"}`} aria-label={notification.title}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="small text-muted">{typeLabels[notification.type] || "Notification"}</span>
        {!notification.isRead && <span className="badge text-bg-primary">Unread</span>}
      </div>
      <h3 className="h5">{notification.title}</h3>
      <p className="notification-message">{notification.message}</p>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        {validDate ? <time className="small text-muted" dateTime={date.toISOString()}>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}</time>
          : <span className="small text-muted">Not available</span>}
        {!notification.isRead && <button className="btn btn-outline-primary btn-sm" type="button" disabled={disabled}
          aria-label={`Mark as read: ${notification.title}`} onClick={() => onMarkRead(notification.id)}>
          {pending ? <LoadingSpinner label="Marking as read..." /> : "Mark as read"}
        </button>}
      </div>
    </article>
  </li>;
};

export default NotificationItem;
