import { Link } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";

const NotificationBell = () => {
  const { unreadCount, countError } = useNotifications();
  const label = countError ? "Notifications, unread count unavailable"
    : unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";
  return <Link to="/notifications" className="btn btn-icon notification-bell" aria-label={label} title={label}>
    <i className="bi bi-bell" aria-hidden="true" />
    {unreadCount > 0 && <span className="notification-badge badge text-bg-danger" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
  </Link>;
};

export default NotificationBell;
